// ============================================================================
// CONFIGURATION (js/config.js) — "Under the Same Night Sky"
// Replace SUPABASE_URL, SUPABASE_ANON_KEY, and VAPID_PUBLIC_KEY with your own
// project values from the README.md setup guide.
// ============================================================================

export const APP_CONFIG = {
  // 1. Supabase Project URL & Public Anon Key
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // 2. Web Push VAPID Public Key (Base64 URL-safe string generated via web-push)
  VAPID_PUBLIC_KEY: "YOUR_VAPID_PUBLIC_KEY",

  // 3. Couple Account Mapping
  // Maps authenticated email addresses (or email prefixes) to partner profiles
  PARTNERS: {
    dyko: {
      key: "dyko",
      name: "Dyko",
      partnerKey: "peyton",
      partnerName: "Peyton",
      city: "La Fortuna",
      region: "Arenal, Costa Rica",
      country: "Costa Rica",
      emoji: "🌋",
      timezone: "America/Costa_Rica",
      lat: 10.4678,
      lon: -84.6427,
      emailHint: "dyko"
    },
    peyton: {
      key: "peyton",
      name: "Peyton",
      partnerKey: "dyko",
      partnerName: "Dyko",
      city: "Calgary",
      region: "Alberta, Canada",
      country: "Canada",
      emoji: "🏔️",
      timezone: "America/Edmonton",
      lat: 51.0447,
      lon: -114.0719,
      emailHint: "peyton"
    }
  },

  // 4. Exact 4 Silent Pulses (2x2 Symmetrical Grid)
  SILENT_PULSES: [
    {
      type: "miss_you",
      message: "I miss you",
      icon: "🌙"
    },
    {
      type: "wish_with_you",
      message: "I wish I were with you",
      icon: "✨"
    },
    {
      type: "eat_drink",
      message: "Eat well & drink water",
      icon: "🍵"
    },
    {
      type: "thinking_of_you",
      message: "Thinking of you",
      icon: "🕯️"
    }
  ]
};

/**
 * Checks whether real Supabase credentials have been configured in config.js
 */
export function isSupabaseConfigured() {
  return (
    Boolean(APP_CONFIG.SUPABASE_URL) &&
    Boolean(APP_CONFIG.SUPABASE_ANON_KEY) &&
    !APP_CONFIG.SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
    !APP_CONFIG.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
}
