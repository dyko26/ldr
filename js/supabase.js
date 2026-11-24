// ============================================================================
// SUPABASE CLIENT, REALTIME & DATA LAYER (js/supabase.js)
// Handles Supabase Auth, PostgreSQL queries, Supabase Realtime subscriptions,
// and an instant cross-tab Local Sanctuary Store for zero-config previewing.
// ============================================================================

import { APP_CONFIG, isSupabaseConfigured } from "./config.js";

const LOCAL_STORAGE_KEY = "night_sky_couple_sanctuary_v1";
const LOCAL_AUTH_KEY = "night_sky_preview_partner_v1";

// Initialize Supabase JS v2 client if credentials are set
export const supabaseClient =
  isSupabaseConfigured() && window.supabase
    ? window.supabase.createClient(
        APP_CONFIG.SUPABASE_URL,
        APP_CONFIG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        }
      )
    : null;

// Cross-tab BroadcastChannel for real-time sync in Local Preview mode
const localBroadcast =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("night_sky_realtime_channel")
    : null;

// ============================================================================
// 30 CURATED STAGE-APPROPRIATE DAILY QUESTIONS (Matches supabase/schema.sql)
// ============================================================================
export const SEED_DAILY_QUESTIONS = [
  {
    id: 1,
    day_number: 1,
    category: "Our First Two Nights",
    prompt:
      'Thinking back to our very first night date, what was the exact moment you felt the nervous energy turn into "I really want to stay right here with this person"?'
  },
  {
    id: 2,
    day_number: 2,
    category: "Our First Two Nights",
    prompt:
      "On our second night together, what is one small detail—a look, a laugh, or something about the night air—that still replays in your mind?"
  },
  {
    id: 3,
    day_number: 3,
    category: "Across the Map",
    prompt:
      "At what point during your day in Calgary or La Fortuna do you find yourself wishing the other person were right next to you the most?"
  },
  {
    id: 4,
    day_number: 4,
    category: "Getting to Know You",
    prompt:
      "What is a quiet evening ritual or comfort habit you have at home that I haven't gotten to see in person yet?"
  },
  {
    id: 5,
    day_number: 5,
    category: "Our First Reunion",
    prompt:
      "Picture the first ten minutes after we finally see each other again at the airport. What does that moment look and feel like to you?"
  },
  {
    id: 6,
    day_number: 6,
    category: "Our First Two Nights",
    prompt:
      "Before our first date ended, what was something you wanted to say or do that you held back at the time?"
  },
  {
    id: 7,
    day_number: 7,
    category: "Emotional Closeness",
    prompt:
      "When the distance between Canada and Costa Rica feels extra wide, what kind of gesture or message makes you feel closest to me?"
  },
  {
    id: 8,
    day_number: 8,
    category: "Getting to Know You",
    prompt:
      "What song reminds you of the feeling of our first two nights together, and why does it fit us?"
  },
  {
    id: 9,
    day_number: 9,
    category: "Two Worlds",
    prompt:
      "If you could teleport me into your city for just two hours tonight—no flights, no packing—where would we go and what would we do?"
  },
  {
    id: 10,
    day_number: 10,
    category: "Getting to Know You",
    prompt:
      "What is something about the way I look at you or talk to you that made you feel safe opening up so quickly?"
  },
  {
    id: 11,
    day_number: 11,
    category: "Our First Reunion",
    prompt:
      "On our very first morning waking up in the same place during our reunion trip, what does your ideal slow morning together look like?"
  },
  {
    id: 12,
    day_number: 12,
    category: "Emotional Closeness",
    prompt:
      "What is a small insecurity or worry about starting a long-distance relationship that we can hold gently and talk through together?"
  },
  {
    id: 13,
    day_number: 13,
    category: "Getting to Know You",
    prompt:
      "What is a favorite childhood or family memory that shaped how you show affection today?"
  },
  {
    id: 14,
    day_number: 14,
    category: "Our First Two Nights",
    prompt:
      "Between our first night date and our second night date, what did you tell yourself (or a close friend) about me?"
  },
  {
    id: 15,
    day_number: 15,
    category: "Two Worlds",
    prompt:
      "What is one piece of your daily environment—a view, a café, a sound at night—that you cannot wait to introduce me to in person?"
  },
  {
    id: 16,
    day_number: 16,
    category: "Getting to Know You",
    prompt:
      "When you have had a long, draining day and your social battery is near 10%, how do you best like to be cared for?"
  },
  {
    id: 17,
    day_number: 17,
    category: "Our First Reunion",
    prompt:
      "Since our story started at night, how should we spend our very first night together when we reunite as an official couple?"
  },
  {
    id: 18,
    day_number: 18,
    category: "Getting to Know You",
    prompt:
      "What is a dream or personal goal you are working toward right now that you want me to cheer you on for?"
  },
  {
    id: 19,
    day_number: 19,
    category: "Emotional Closeness",
    prompt:
      "What has surprised you the most about how it feels to start building this connection with me from miles away?"
  },
  {
    id: 20,
    day_number: 20,
    category: "Getting to Know You",
    prompt:
      "If we were cooking dinner together in the same kitchen tonight, what would be our roles and what would be playing in the background?"
  },
  {
    id: 21,
    day_number: 21,
    category: "Our First Two Nights",
    prompt:
      "If you could freeze one 30-second frame from either of our two night dates and step back inside it right now, which moment would you pick?"
  },
  {
    id: 22,
    day_number: 22,
    category: "Emotional Closeness",
    prompt:
      "What are three little things about my personality or voice that you have already grown fond of?"
  },
  {
    id: 23,
    day_number: 23,
    category: "Our First Reunion",
    prompt:
      "What is one adventure—big or small—we absolutely have to cross off together during our first real trip as a couple?"
  },
  {
    id: 24,
    day_number: 24,
    category: "Getting to Know You",
    prompt:
      "What does falling in love at a healthy, intentional pace look like to you?"
  },
  {
    id: 25,
    day_number: 25,
    category: "Two Worlds",
    prompt:
      "Look outside or picture your sky tonight: if you could send one sensory detail from your night air to mine, what would it be?"
  },
  {
    id: 26,
    day_number: 26,
    category: "Getting to Know You",
    prompt:
      "What is a book, film, or place that feels like a secret window into who you are?"
  },
  {
    id: 27,
    day_number: 27,
    category: "Emotional Closeness",
    prompt:
      "When we are on a voice or video call, what moment makes you forget there is a screen between us?"
  },
  {
    id: 28,
    day_number: 28,
    category: "Our First Reunion",
    prompt:
      "What is something simple and everyday—not touristy at all—that you are most excited to do side by side when we reunite?"
  },
  {
    id: 29,
    day_number: 29,
    category: "Getting to Know You",
    prompt:
      "What is a promise you want us to keep to each other while we navigate these early months of distance?"
  },
  {
    id: 30,
    day_number: 30,
    category: "Under the Same Night Sky",
    prompt:
      'Looking ahead from those first two night dates to everything still in front of us, what makes you most excited about "us"?'
  }
];

function createDefaultLocalStore() {
  const now = Date.now();
  const reunionTarget = new Date(now + 42 * 86400000 + 14 * 3600000).toISOString();

  return {
    user_status: {
      dyko: {
        partner_key: "dyko",
        display_name: "Dyko",
        city: "La Fortuna",
        battery: 88,
        mood: "Up for a call",
        note: "Listening to the tropical night rain & thinking of our two night dates",
        updated_at: new Date(now - 11 * 60000).toISOString()
      },
      peyton: {
        partner_key: "peyton",
        display_name: "Peyton",
        city: "Calgary",
        battery: 79,
        mood: "Missing you",
        note: "Cozy with tea looking out at the stars over Calgary",
        updated_at: new Date(now - 6 * 60000).toISOString()
      }
    },
    pulses: [
      {
        id: "seed-pulse-1",
        sender_key: "peyton",
        sender_name: "Peyton",
        recipient_key: "dyko",
        pulse_type: "thinking_of_you",
        message: "Thinking of you",
        created_at: new Date(now - 12 * 60000).toISOString()
      }
    ],
    daily_questions: SEED_DAILY_QUESTIONS,
    daily_answers: [
      {
        id: "seed-ans-1",
        question_id: 1,
        partner_key: "peyton",
        author_name: "Peyton",
        answer_text:
          "When we stopped noticing how late it was getting on our first night—and neither of us wanted to be the one to say goodnight first.",
        created_at: new Date(now - 45 * 60000).toISOString()
      }
    ],
    letters: [
      {
        id: "seed-letter-1",
        sender_key: "dyko",
        sender_name: "Dyko",
        recipient_key: "peyton",
        title: "From La Fortuna to Calgary — After Our First Two Nights",
        body: "Peyton,\n\nEven with thousands of miles between the tropical rain here in La Fortuna and the night air in Calgary, I still keep replaying our first two nights together.\n\nIt takes something rare for two evenings under the stars to leave such an unmistakable pull behind. Whenever you break the seal on this envelope, remember that we are looking up at the exact same night sky—and every sunset brings us one day closer to our first real reunion.\n\nYours,\nDyko",
        unlock_type: "moment",
        unlock_date: null,
        moment_label: "Open when the distance feels heavy",
        is_manually_opened: false,
        opened_at: null,
        created_at: new Date(now - 3600000 * 18).toISOString()
      },
      {
        id: "seed-letter-2",
        sender_key: "peyton",
        sender_name: "Peyton",
        recipient_key: "dyko",
        title: "For the Night Before Our Reunion Flight",
        body: "Dyko,\n\nIf you are reading this, it means the countdown we have been watching finally reached its last night. Pack your bag, take a deep breath, and look up at the stars one last time from your side of the map.\n\nTomorrow, there are no timezones between us.\n\nCan't wait to hold you,\nPeyton",
        unlock_type: "date",
        unlock_date: new Date(now + 41 * 86400000).toISOString(),
        moment_label: null,
        is_manually_opened: false,
        opened_at: null,
        created_at: new Date(now - 3600000 * 10).toISOString()
      },
      {
        id: "seed-letter-3",
        sender_key: "peyton",
        sender_name: "Peyton",
        recipient_key: "dyko",
        title: "A Quiet Reminder from Calgary",
        body: "Dyko,\n\nI wanted to leave a note waiting for you here inside our night sky. Starting this adventure together after two unforgettable night dates feels both brave and completely natural.\n\nThank you for making the miles between Canada and Costa Rica feel so warm already.\n\nWith all my affection,\nPeyton",
        unlock_type: "moment",
        unlock_date: null,
        moment_label: "Open whenever you want to smile",
        is_manually_opened: true,
        opened_at: new Date(now - 3600000 * 3).toISOString(),
        created_at: new Date(now - 3600000 * 24).toISOString()
      }
    ],
    reunion_plan: {
      id: 1,
      title: "Until our first real reunion",
      target_date: reunionTarget,
      location: "Under the same night sky",
      currency: "USD",
      savings_goal: 1800,
      savings_current: 540,
      dyko_contribution: 270,
      peyton_contribution: 270
    },
    bucket_list: [
      {
        id: "seed-bucket-1",
        title:
          "Have our third night date in person—without having to say a long-distance goodbye",
        category: "Night Out",
        added_by: "dyko",
        is_completed: false
      },
      {
        id: "seed-bucket-2",
        title:
          "Soak in the volcanic hot springs under the stars in La Fortuna together",
        category: "Adventure",
        added_by: "dyko",
        is_completed: false
      },
      {
        id: "seed-bucket-3",
        title:
          "Stargaze near the Rocky Mountains outside Calgary wrapped in one blanket",
        category: "Night Out",
        added_by: "peyton",
        is_completed: false
      },
      {
        id: "seed-bucket-4",
        title:
          "Cook our first real dinner together in the same kitchen with music playing",
        category: "Cozy",
        added_by: "peyton",
        is_completed: false
      },
      {
        id: "seed-bucket-5",
        title:
          "Take a slow morning coffee walk holding hands with nowhere to rush to",
        category: "Reunion",
        added_by: "dyko",
        is_completed: false
      },
      {
        id: "seed-bucket-6",
        title: "Fall asleep in the same bed without a phone screen between us",
        category: "Cozy",
        added_by: "peyton",
        is_completed: false
      }
    ],
    date_ideas: [
      {
        id: "seed-date-1",
        title: "Watch a movie in sync by candlelight",
        vibe: "Cinema Night",
        added_by: "peyton"
      },
      {
        id: "seed-date-2",
        title: "Cook the same meal together on video",
        vibe: "Kitchen Date",
        added_by: "dyko"
      },
      {
        id: "seed-date-3",
        title: "Late-night 20 questions in bed",
        vibe: "Deep Talk",
        added_by: "peyton"
      },
      {
        id: "seed-date-4",
        title: "Stargazing voice call on the balcony",
        vibe: "Under the Stars",
        added_by: "dyko"
      },
      {
        id: "seed-date-5",
        title: "Play an online co-op game together",
        vibe: "Playful Night",
        added_by: "peyton"
      },
      {
        id: "seed-date-6",
        title: "Build our first reunion trip playlist",
        vibe: "Music & Memories",
        added_by: "dyko"
      }
    ]
  };
}

export function getLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const seeded = createDefaultLocalStore();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch (_e) {
    return createDefaultLocalStore();
  }
}

export function saveLocalStore(store, eventDetail = null) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    if (localBroadcast && eventDetail) {
      localBroadcast.postMessage(eventDetail);
    }
  } catch (err) {
    console.warn("[Store] Failed to persist local store:", err);
  }
}

/**
 * Resolves which partner ('dyko' or 'peyton') an authenticated Supabase user maps to
 */
export function resolvePartnerKeyFromEmail(email = "", userMetadata = {}) {
  if (
    userMetadata?.partner_key === "dyko" ||
    userMetadata?.partner_key === "peyton"
  ) {
    return userMetadata.partner_key;
  }
  const lower = (email || "").toLowerCase();
  if (lower.includes("peyton") || lower.includes("calgary")) {
    return "peyton";
  }
  return "dyko";
}

/**
 * Helper to get or set the current preview user ('dyko' | 'peyton')
 */
export function getPreviewPartnerKey() {
  return localStorage.getItem(LOCAL_AUTH_KEY);
}

export function setPreviewPartnerKey(partnerKey) {
  if (!partnerKey) {
    localStorage.removeItem(LOCAL_AUTH_KEY);
  } else {
    localStorage.setItem(LOCAL_AUTH_KEY, partnerKey);
  }
}

/**
 * Subscribes to real-time updates (both Supabase Realtime & cross-tab BroadcastChannel)
 */
export function subscribeToRealtimeUpdates(onEventCallback) {
  // 1. Cross-tab BroadcastChannel listener
  if (localBroadcast) {
    localBroadcast.onmessage = (ev) => {
      if (ev.data) {
        onEventCallback(ev.data);
      }
    };
  }

  window.addEventListener("storage", (ev) => {
    if (ev.key === LOCAL_STORAGE_KEY) {
      onEventCallback({ table: "all", eventType: "SYNC" });
    }
  });

  // 2. Supabase Realtime Postgres Changes subscription
  if (!supabaseClient) return null;

  const channel = supabaseClient
    .channel("night-sky-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_status" },
      (payload) => onEventCallback({ table: "user_status", payload })
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pulses" },
      (payload) => onEventCallback({ table: "pulses", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "daily_answers" },
      (payload) => onEventCallback({ table: "daily_answers", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "letters" },
      (payload) => onEventCallback({ table: "letters", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reunion_plan" },
      (payload) => onEventCallback({ table: "reunion_plan", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bucket_list" },
      (payload) => onEventCallback({ table: "bucket_list", payload })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "date_ideas" },
      (payload) => onEventCallback({ table: "date_ideas", payload })
    )
    .subscribe();

  return channel;
}
