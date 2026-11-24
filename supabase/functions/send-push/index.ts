// ============================================================================
// SUPABASE EDGE FUNCTION: send-push
// Sends real Web Push notifications (VAPID) to Dyko or Peyton's devices
// Supports iOS Safari PWA (16.4+) and Huawei devices (Firefox / Huawei Browser)
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushRequestPayload {
  recipient_key: "dyko" | "peyton";
  sender_name?: string;
  event_type: "pulse" | "daily_answer" | "daily_unsealed" | "letter" | "test";
  title: string;
  body: string;
  tab?: "presence" | "daily" | "letters" | "plans";
  url?: string;
  tag?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:sky@underthesamenightsky.app";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set in Supabase Edge Function secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify caller is an authenticated user (Dyko or Peyton)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized request" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse payload
    const payload: PushRequestPayload = await req.json();
    const {
      recipient_key,
      event_type = "pulse",
      title = "Under the Same Night Sky",
      body = "A new moment is waiting for you under the stars.",
      tab = "presence",
      url = "/",
      tag = `night-sky-${event_type}`,
    } = payload;

    if (!recipient_key || !["dyko", "peyton"].includes(recipient_key)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid recipient_key. Must be 'dyko' or 'peyton'.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Configure web-push VAPID details
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Query active subscriptions for recipient using service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscriptions, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, device_label")
      .eq("partner_key", recipient_key);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          sent: 0,
          message: `No active push subscriptions registered for ${recipient_key}.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      renotify: true,
      vibrate: [120, 60, 140],
      data: {
        url,
        tab,
        event_type,
        recipient_key,
        timestamp: new Date().toISOString(),
      },
    });

    let sentCount = 0;
    const expiredIds: string[] = [];
    const errors: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload, {
            TTL: 86400, // 24 hours TTL so offline devices receive it
            urgency: "high",
          });
          sentCount += 1;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // 404 or 410 means the subscription is no longer valid
          if (statusCode === 404 || statusCode === 410) {
            expiredIds.push(sub.id);
          } else {
            errors.push(
              `${sub.device_label}: ${(err as Error)?.message || "Push error"}`
            );
          }
        }
      })
    );

    // Clean up expired subscriptions automatically
    if (expiredIds.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        total_subscriptions: subscriptions.length,
        cleaned_expired: expiredIds.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error)?.message || "Internal Edge Function error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
