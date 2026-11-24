# Under the Same Night Sky ✨ — Private Long-Distance Couple PWA

A complete, private, $0/month Progressive Web App built exclusively for **Dyko** (La Fortuna, Costa Rica 🌋) and **Peyton** (Calgary, Canada 🏔️).

Designed around the warm night-sky aesthetic of your first two night dates, with live clocks and weather across both horizons, real-time presence and social battery cards, tactile 2×2 Silent Pulses with Web Push notifications, wax-sealed daily questions, time-capsule letters, and reunion planning.

---

## 📁 Project Structure

```text
under-the-same-night-sky/
├── index.html                              # Main mobile-first PWA shell (4 bottom tabs + modals)
├── styles.css                              # Custom night-sky theme, glassmorphic cards & wax-seal animations
├── manifest.json                           # PWA Web App Manifest for Home Screen installation
├── sw.js                                   # Service Worker (offline caching + Web Push notifications)
├── icons/
│   ├── icon.svg                            # Custom vector night-sky crest (Calgary & La Fortuna horizons)
│   ├── icon-192.png                        # 192×192 Home Screen / Push Badge icon
│   ├── icon-512.png                        # 512×512 Splash & Maskable PWA icon
│   └── apple-touch-icon.png                # 180×180 iOS Safari Home Screen icon
├── js/
│   ├── config.js                           # Supabase URL, Anon Key, VAPID Public Key & partner profiles
│   ├── supabase.js                         # Supabase Auth, Realtime subscriptions & Local Sanctuary store
│   ├── weather.js                          # Live Open-Meteo weather & timezone clocks (Calgary & La Fortuna)
│   ├── push.js                             # VAPID Web Push subscription & Edge Function invoker
│   └── app.js                              # Main UI controller for Presence, Daily, Letters & Plans
└── supabase/
    ├── schema.sql                          # Full PostgreSQL schema, RLS policies, Realtime & 30 seeded questions
    └── functions/
        └── send-push/
            └── index.ts                    # Supabase Edge Function sending real Web Push alerts via VAPID
```

---

## 🚀 Quick Local Preview (Zero Setup Required)

You can preview and test the entire app immediately on your computer before connecting Supabase:

1. Serve the folder with any static HTTP server:
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
2. Open `http://localhost:8080` in your browser.
3. On the login card, click **"🌋 Enter as Dyko"** or **"🏔️ Enter as Peyton"** under *Instant Interactive Preview Mode*.
4. Open a second browser tab in parallel and select the other partner—thanks to `BroadcastChannel` sync, sending a **Silent Pulse** or answering a **Daily Question** in one tab lights up the constellation arc and unseals envelopes in the other tab in real time!

---

## 🛠️ Step-by-Step Production Setup ($0/month Free Tier)

### Step 1: Create Your Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project (e.g., `under-the-same-night-sky`).
2. Save your **Database Password** in a safe place and wait ~1 minute for the project to provision.

### Step 2: Run the Database Schema & 30-Day Seed (`supabase/schema.sql`)
1. In your Supabase Dashboard, open **SQL Editor** from the left sidebar and click **New query**.
2. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it into the editor.
3. Click **Run**.
   - This creates all 10 tables (`profiles`, `user_status`, `pulses`, `daily_questions`, `daily_answers`, `letters`, `reunion_plan`, `bucket_list`, `date_ideas`, `push_subscriptions`), enables **Row Level Security (RLS)** so only authenticated users have access, enables **Supabase Realtime**, and seeds the **30 curated relationship questions** and initial rows.

### Step 3: Create the 2 Accounts (Dyko & Peyton) & Disable Public Signups
1. In the Supabase Dashboard, go to **Authentication** → **Users**.
2. Click **Add user** → **Create new user**:
   - **Account 1 (Dyko):** Enter Dyko's email (e.g., `dyko@yourdomain.com`), a strong password, and check **Auto Confirm User**.
   - **Account 2 (Peyton):** Enter Peyton's email (e.g., `peyton@yourdomain.com`), a strong password, and check **Auto Confirm User**.
   *(Tip: The app automatically maps any email containing `peyton` to Peyton's Calgary profile and Dyko's email to Dyko's La Fortuna profile. You can also explicitly link their `auth.users` UUIDs in the `profiles` table if using custom emails).*
3. **Disable Public Signups:**
   - Go to **Authentication** → **Providers** → **Email** (or **Authentication** → **Sign In / Up**).
   - Toggle **OFF** *"Allow new users to sign up"*, and click **Save**. Now no one else on the internet can ever register an account.

### Step 4: Generate Free VAPID Keys for Web Push
Run this single command in your terminal (requires Node.js):

```bash
npx web-push generate-vapid-keys
```

It will print a **Public Key** and a **Private Key**:
```text
Public Key:
BEl62i... (copy this for config.js and Supabase secrets)

Private Key:
UUxI4O... (keep secret — copy this for Supabase secrets only)
```

### Step 5: Deploy the `send-push` Supabase Edge Function
1. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```
2. Log in and link your project (find your Project Reference ID in Supabase **Project Settings** → **General**):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```
3. Store your VAPID keys securely in Supabase Secrets:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY" VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY" VAPID_SUBJECT="mailto:your-email@example.com"
   ```
4. Deploy the `send-push` Edge Function:
   ```bash
   supabase functions deploy send-push
   ```

### Step 6: Configure `js/config.js`
Open [`js/config.js`](./js/config.js) and replace the 3 placeholder values with your Supabase URL, Supabase Anon Key (found in **Project Settings** → **API**), and your VAPID Public Key:

```javascript
export const APP_CONFIG = {
  SUPABASE_URL: "https://abcdefghijklm.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  VAPID_PUBLIC_KEY: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  // ...
};
```

### Step 7: Deploy Static Frontend to Netlify or GitHub Pages ($0/month)
- **Option A — Netlify (Recommended):**
  1. Drag and drop the `under-the-same-night-sky` folder into [app.netlify.com/drop](https://app.netlify.com/drop), or connect your private GitHub repository to Netlify.
  2. Build command: *(leave blank — static site)*
  3. Publish directory: `.` (root)
  4. Netlify automatically serves over `https://`, which is required for Service Workers and Web Push.
- **Option B — GitHub Pages:**
  1. Push this directory to a GitHub repository.
  2. Go to **Settings** → **Pages**, select your branch (`main`) and root folder (`/`), and save.

---

## 📱 Installing the PWA & Enabling Push on iPhone & Huawei

### 🏔️ For Peyton — iPhone (iOS 16.4+ Safari)
Apple supports native Web Push **only when the site is installed to the Home Screen**:
1. Open your deployed `https://...` URL in **Safari** on iPhone.
2. Tap the **Share** button (square with upward arrow) at the bottom of Safari.
3. Scroll down and tap **"Add to Home Screen"** → tap **Add**.
4. Close Safari and open **"Night Sky"** from your iPhone Home Screen icon.
5. Sign in as Peyton, tap the **Settings gear (⚙️)** in the top right of the *"Two Worlds"* header, and tap **"🔔 Enable Push"** → tap **Allow**.
6. Tap **"✨ Send Test Push"** to verify!

### 🌋 For Dyko — Huawei Phone (HarmonyOS / EMUI without Google Play Services)
Because standard Chrome on Android relies on Google Play Services (FCM) for Web Push, Huawei devices without GMS should use **Firefox for Android** (which uses Mozilla's independent autopush service) or **Huawei Browser**:
1. Install **Firefox** on your Huawei phone and open your deployed `https://...` URL.
2. Tap the three-dot menu (**⋮**) → tap **"Add app to Home screen"** (or **"Install"**).
3. Open **"Night Sky"** from your Home Screen and sign in as Dyko.
4. Tap the **Settings gear (⚙️)** in the top right → tap **"🔔 Enable Push"** → tap **Allow**.
5. Make sure Firefox is allowed to run in the background under Huawei *Settings → Apps → App Launch → Firefox (Manage manually: Auto-launch, Secondary launch, Run in background)*.
