// ============================================================================
// WEB PUSH NOTIFICATIONS MODULE (js/push.js)
// Native Web Push API with VAPID keys + Supabase Edge Function ("send-push")
// Compatible with iOS Safari PWA (16.4+) & Huawei devices (Firefox / Huawei Browser)
// ============================================================================

import { APP_CONFIG, isSupabaseConfigured } from "./config.js";

/**
 * Converts a URL-safe base64 VAPID public key string into a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Detects a friendly device label for the push_subscriptions table
 */
function detectDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone Safari PWA";
  if (/Huawei|HarmonyOS/i.test(ua) && /Firefox/i.test(ua))
    return "Huawei Firefox PWA";
  if (/Huawei|HarmonyOS/i.test(ua)) return "Huawei Browser PWA";
  if (/Firefox/i.test(ua)) return "Firefox Mobile PWA";
  if (/Android/i.test(ua)) return "Android PWA";
  return "Desktop / Web PWA";
}

/**
 * Registers the Service Worker (sw.js)
 */
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./"
    });
    return registration;
  } catch (err) {
    console.warn("[Push] Service Worker registration warning:", err);
    return null;
  }
}

/**
 * Returns the current browser Notification & PushSubscription state
 */
export async function getPushSubscriptionStatus() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
      message:
        "Web Push requires an installed Home Screen PWA (iOS 16.4+ Safari or Firefox on Huawei)."
    };
  }

  const permission = Notification.permission;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: Boolean(subscription),
      subscription,
      message: subscription
        ? `Push active on ${detectDeviceLabel()}`
        : permission === "granted"
        ? "Permission granted — tap Enable Push to link VAPID endpoint"
        : "Tap Enable Push to receive Silent Pulses & letters"
    };
  } catch (_e) {
    return {
      supported: true,
      permission,
      subscribed: false,
      message: "Tap Enable Push to activate notifications"
    };
  }
}

/**
 * Requests permission, subscribes to Web Push with VAPID key, and saves to Supabase
 */
export async function subscribeToWebPush(supabaseClient, partnerKey, userId) {
  if (!("Notification" in window)) {
    throw new Error(
      "This browser does not expose the Notification API. On iPhone, add this app to your Home Screen first."
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Notification permission was not granted. Please allow notifications in your browser settings."
    );
  }

  const registration =
    (await registerServiceWorker()) || (await navigator.serviceWorker.ready);

  const vapidKeyConfigured =
    APP_CONFIG.VAPID_PUBLIC_KEY &&
    !APP_CONFIG.VAPID_PUBLIC_KEY.includes("YOUR_VAPID_PUBLIC_KEY");

  if (!vapidKeyConfigured) {
    // Local / Demo notification mode when VAPID key isn't entered yet
    if (registration && registration.showNotification) {
      await registration.showNotification("Under the Same Night Sky ✨", {
        body: "Local push notifications enabled! Add your VAPID_PUBLIC_KEY in js/config.js for remote push.",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      });
    }
    return {
      mode: "local",
      message:
        "Browser notifications granted! Configure VAPID_PUBLIC_KEY in js/config.js for remote cross-device push."
    };
  }

  // Subscribe with VAPID Public Key
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(
      APP_CONFIG.VAPID_PUBLIC_KEY
    );
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint;
  const p256dh = subJson.keys?.p256dh || "";
  const auth = subJson.keys?.auth || "";

  if (supabaseClient && isSupabaseConfigured()) {
    const { error } = await supabaseClient.from("push_subscriptions").upsert(
      {
        user_id: userId || null,
        partner_key: partnerKey,
        endpoint,
        p256dh,
        auth,
        device_label: detectDeviceLabel(),
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
  }

  return {
    mode: "vapid",
    subscription,
    message: `Web Push active on ${detectDeviceLabel()}!`
  };
}

/**
 * Triggers the Supabase Edge Function `send-push` to notify the partner's phone
 */
export async function sendPartnerPushNotification(
  supabaseClient,
  { recipientKey, senderName, eventType, title, body, tab = "presence" }
) {
  // 1. If connected to real Supabase, invoke the `send-push` Edge Function
  if (supabaseClient && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "send-push",
        {
          body: {
            recipient_key: recipientKey,
            sender_name: senderName,
            event_type: eventType,
            title,
            body,
            tab,
            url: `./index.html?tab=${tab}`
          }
        }
      );
      if (error) {
        console.warn("[Push] Edge Function invoke warning:", error.message);
      }
      return data;
    } catch (err) {
      console.warn("[Push] Could not reach send-push Edge Function:", err);
    }
  }

  // 2. When testing locally or if the user asked for a test push, also show a local SW notification if granted
  if (
    eventType === "test" &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    "serviceWorker" in navigator
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
        tag: `night-sky-${eventType}`,
        vibrate: [120, 60, 140],
        data: { tab }
      });
    } catch (_e) {
      // Fallback to window Notification
      new Notification(title, { body, icon: "./icons/icon-192.png" });
    }
  }
}
