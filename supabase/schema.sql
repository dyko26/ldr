-- ============================================================================
-- "UNDER THE SAME NIGHT SKY" — SUPABASE DATABASE SCHEMA & SEED DATA
-- Private Long-Distance Couple PWA for Dyko (La Fortuna) & Peyton (Calgary)
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE
-- Maps Supabase Auth users to either 'dyko' or 'peyton'
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  partner_key text not null unique check (partner_key in ('dyko', 'peyton')),
  display_name text not null,
  city text not null,
  country text not null,
  timezone text not null,
  latitude numeric(8,4) not null,
  longitude numeric(8,4) not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. USER STATUS TABLE (Presence & Social Battery)
-- Keyed by partner_key ('dyko' | 'peyton') so both cards always exist
-- ============================================================================
create table if not exists public.user_status (
  partner_key text primary key check (partner_key in ('dyko', 'peyton')),
  display_name text not null,
  city text not null,
  battery integer not null default 80 check (battery >= 0 and battery <= 100),
  mood text not null default 'Missing you' check (
    mood in (
      'Up for a call',
      'Working, text only',
      'Resting / recharging',
      'Missing you',
      'Out & about'
    )
  ),
  note text not null default '' check (char_length(note) <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- ============================================================================
-- 3. SILENT PULSES TABLE
-- Stores the 4 tactile pulses sent across the night sky
-- ============================================================================
create table if not exists public.pulses (
  id uuid primary key default gen_random_uuid(),
  sender_key text not null check (sender_key in ('dyko', 'peyton')),
  sender_name text not null,
  recipient_key text not null check (recipient_key in ('dyko', 'peyton')),
  pulse_type text not null check (
    pulse_type in ('miss_you', 'wish_with_you', 'eat_drink', 'thinking_of_you')
  ),
  message text not null check (
    message in (
      'I miss you',
      'I wish I were with you',
      'Eat well & drink water',
      'Thinking of you'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_pulses_created_at on public.pulses(created_at desc);

-- ============================================================================
-- 4. DAILY QUESTIONS TABLE
-- 30 curated questions tailored to Dyko & Peyton's relationship stage
-- ============================================================================
create table if not exists public.daily_questions (
  id serial primary key,
  day_number integer not null unique,
  category text not null,
  prompt text not null,
  active_date date unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. DAILY ANSWERS TABLE
-- Sealed envelope mechanic: both must answer to unseal a question
-- ============================================================================
create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  question_id integer not null references public.daily_questions(id) on delete cascade,
  partner_key text not null check (partner_key in ('dyko', 'peyton')),
  author_name text not null,
  answer_text text not null check (char_length(trim(answer_text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, partner_key)
);

create index if not exists idx_daily_answers_question on public.daily_answers(question_id);

-- ============================================================================
-- 6. LETTERS (TIME CAPSULES) TABLE
-- Supports Date-Locked ('date') and Open-When ('moment') capsules
-- ============================================================================
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  sender_key text not null check (sender_key in ('dyko', 'peyton')),
  sender_name text not null,
  recipient_key text not null check (recipient_key in ('dyko', 'peyton')),
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  unlock_type text not null check (unlock_type in ('date', 'moment')),
  unlock_date timestamptz,
  moment_label text,
  is_manually_opened boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_letters_created_at on public.letters(created_at desc);

-- ============================================================================
-- 7. REUNION PLAN TABLE (Single Shared Row: id = 1)
-- Holds the live Reunion Countdown and Shared Savings Tracker
-- ============================================================================
create table if not exists public.reunion_plan (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Until our first real reunion',
  target_date timestamptz not null default (now() + interval '45 days'),
  location text not null default 'Somewhere under the same stars',
  currency text not null default 'USD',
  savings_goal numeric(10,2) not null default 1800.00 check (savings_goal >= 0),
  savings_current numeric(10,2) not null default 450.00 check (savings_current >= 0),
  dyko_contribution numeric(10,2) not null default 225.00 check (dyko_contribution >= 0),
  peyton_contribution numeric(10,2) not null default 225.00 check (peyton_contribution >= 0),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 8. BUCKET LIST ("Things We Haven't Done Yet")
-- ============================================================================
create table if not exists public.bucket_list (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  category text not null default 'Reunion' check (category in ('Reunion', 'Night Out', 'Cozy', 'Adventure')),
  added_by text not null check (added_by in ('dyko', 'peyton')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bucket_list_created on public.bucket_list(created_at asc);

-- ============================================================================
-- 9. LONG-DISTANCE DATE IDEAS (For the Date Wheel Spinner)
-- ============================================================================
create table if not exists public.date_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  vibe text not null default 'Cozy Night',
  added_by text not null default 'dyko' check (added_by in ('dyko', 'peyton')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 10. PUSH SUBSCRIPTIONS TABLE
-- Stores Web Push endpoints & keys for iOS Safari PWA and Huawei Firefox
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  partner_key text not null check (partner_key in ('dyko', 'peyton')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text not null default 'Mobile PWA',
  user_agent text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_partner on public.push_subscriptions(partner_key);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — STRICT AUTHENTICATED-ONLY ACCESS
-- Only the 2 pre-created authenticated accounts can read or write
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.user_status enable row level security;
alter table public.pulses enable row level security;
alter table public.daily_questions enable row level security;
alter table public.daily_answers enable row level security;
alter table public.letters enable row level security;
alter table public.reunion_plan enable row level security;
alter table public.bucket_list enable row level security;
alter table public.date_ideas enable row level security;
alter table public.push_subscriptions enable row level security;

-- Drop existing policies if re-running migration
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'user_status', 'pulses', 'daily_questions',
        'daily_answers', 'letters', 'reunion_plan', 'bucket_list',
        'date_ideas', 'push_subscriptions'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Profiles: authenticated couple can read both profiles and upsert their own
create policy "Authenticated couple can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Authenticated users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Authenticated users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User Status: authenticated couple can read & update status cards
create policy "Authenticated couple can read status"
  on public.user_status for select
  to authenticated
  using (true);

create policy "Authenticated couple can update status"
  on public.user_status for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated couple can insert status"
  on public.user_status for insert
  to authenticated
  with check (true);

-- Pulses: authenticated couple can read and insert pulses
create policy "Authenticated couple can read pulses"
  on public.pulses for select
  to authenticated
  using (true);

create policy "Authenticated couple can send pulses"
  on public.pulses for insert
  to authenticated
  with check (true);

-- Daily Questions: authenticated couple can read and update active dates
create policy "Authenticated couple can read daily questions"
  on public.daily_questions for select
  to authenticated
  using (true);

-- Daily Answers: authenticated couple can read, insert, and update answers
create policy "Authenticated couple can read daily answers"
  on public.daily_answers for select
  to authenticated
  using (true);

create policy "Authenticated couple can insert daily answers"
  on public.daily_answers for insert
  to authenticated
  with check (true);

create policy "Authenticated couple can update daily answers"
  on public.daily_answers for update
  to authenticated
  using (true)
  with check (true);

-- Letters: authenticated couple can read, write, and unseal letters
create policy "Authenticated couple can read letters"
  on public.letters for select
  to authenticated
  using (true);

create policy "Authenticated couple can insert letters"
  on public.letters for insert
  to authenticated
  with check (true);

create policy "Authenticated couple can update letters"
  on public.letters for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated couple can delete own letters"
  on public.letters for delete
  to authenticated
  using (true);

-- Reunion Plan: authenticated couple can read and update
create policy "Authenticated couple can read reunion plan"
  on public.reunion_plan for select
  to authenticated
  using (true);

create policy "Authenticated couple can update reunion plan"
  on public.reunion_plan for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated couple can insert reunion plan"
  on public.reunion_plan for insert
  to authenticated
  with check (true);

-- Bucket List: authenticated couple can read, add, toggle, and delete items
create policy "Authenticated couple can read bucket list"
  on public.bucket_list for select
  to authenticated
  using (true);

create policy "Authenticated couple can insert bucket list"
  on public.bucket_list for insert
  to authenticated
  with check (true);

create policy "Authenticated couple can update bucket list"
  on public.bucket_list for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated couple can delete bucket list"
  on public.bucket_list for delete
  to authenticated
  using (true);

-- Date Ideas: authenticated couple can read, add, and delete date ideas
create policy "Authenticated couple can read date ideas"
  on public.date_ideas for select
  to authenticated
  using (true);

create policy "Authenticated couple can insert date ideas"
  on public.date_ideas for insert
  to authenticated
  with check (true);

create policy "Authenticated couple can delete date ideas"
  on public.date_ideas for delete
  to authenticated
  using (true);

-- Push Subscriptions: authenticated couple can manage subscriptions
create policy "Authenticated couple can read push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (true);

create policy "Authenticated couple can insert push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (true);

create policy "Authenticated couple can update push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated couple can delete push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (true);

-- ============================================================================
-- ENABLE SUPABASE REALTIME ON LIVE TABLES
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_status'
  ) then
    alter publication supabase_realtime add table public.user_status;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pulses'
  ) then
    alter publication supabase_realtime add table public.pulses;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_answers'
  ) then
    alter publication supabase_realtime add table public.daily_answers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'letters'
  ) then
    alter publication supabase_realtime add table public.letters;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reunion_plan'
  ) then
    alter publication supabase_realtime add table public.reunion_plan;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bucket_list'
  ) then
    alter publication supabase_realtime add table public.bucket_list;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'date_ideas'
  ) then
    alter publication supabase_realtime add table public.date_ideas;
  end if;
end $$;

-- ============================================================================
-- SEED DATA: INITIAL STATUS CARDS, REUNION PLAN, BUCKET LIST, DATE IDEAS,
-- LETTERS, AND 30 STAGE-APPROPRIATE DAILY QUESTIONS
-- ============================================================================

-- 1. Seed Initial Status Rows for Dyko & Peyton
insert into public.user_status (partner_key, display_name, city, battery, mood, note, updated_at)
values
  ('dyko', 'Dyko', 'La Fortuna', 86, 'Up for a call', 'Listening to the tropical rain & thinking of our nights together', now() - interval '14 minutes'),
  ('peyton', 'Peyton', 'Calgary', 78, 'Missing you', 'Cozy under a blanket watching the stars over the Rockies', now() - interval '7 minutes')
on conflict (partner_key) do nothing;

-- 2. Seed Initial Reunion Plan (id = 1)
insert into public.reunion_plan (
  id, title, target_date, location, currency, savings_goal, savings_current, dyko_contribution, peyton_contribution
)
values (
  1,
  'Until our first real reunion',
  (date_trunc('day', now()) + interval '42 days 20 hours'),
  'Under the same night sky',
  'USD',
  1800.00,
  540.00,
  270.00,
  270.00
)
on conflict (id) do nothing;

-- 3. Seed 30 Thoughtful Daily Questions (Memories of their first two night dates,
--    daily rhythms, emotional closeness across distance, & their first reunion)
insert into public.daily_questions (day_number, category, prompt, active_date)
values
  (1, 'Our First Two Nights', 'Thinking back to our very first night date, what was the exact moment you felt the nervous energy turn into "I really want to stay right here with this person"?', current_date),
  (2, 'Our First Two Nights', 'On our second night together, what is one small detail—a look, a laugh, or something about the night air—that still replays in your mind?', current_date + 1),
  (3, 'Across the Map', 'At what point during your day in Calgary or La Fortuna do you find yourself wishing the other person were right next to you the most?', current_date + 2),
  (4, 'Getting to Know You', 'What is a quiet evening ritual or comfort habit you have at home that I haven''t gotten to see in person yet?', current_date + 3),
  (5, 'Our First Reunion', 'Picture the first ten minutes after we finally see each other again at the airport. What does that moment look and feel like to you?', current_date + 4),
  (6, 'Our First Two Nights', 'Before our first date ended, what was something you wanted to say or do that you held back at the time?', current_date + 5),
  (7, 'Emotional Closeness', 'When the distance between Canada and Costa Rica feels extra wide, what kind of gesture or message makes you feel closest to me?', current_date + 6),
  (8, 'Getting to Know You', 'What song reminds you of the feeling of our first two nights together, and why does it fit us?', current_date + 7),
  (9, 'Two Worlds', 'If you could teleport me into your city for just two hours tonight—no flights, no packing—where would we go and what would we do?', current_date + 8),
  (10, 'Getting to Know You', 'What is something about the way I look at you or talk to you that made you feel safe opening up so quickly?', current_date + 9),
  (11, 'Our First Reunion', 'On our very first morning waking up in the same place during our reunion trip, what does your ideal slow morning together look like?', current_date + 10),
  (12, 'Emotional Closeness', 'What is a small insecurity or worry about starting a long-distance relationship that we can hold gently and talk through together?', current_date + 11),
  (13, 'Getting to Know You', 'What is a favorite childhood or family memory that shaped how you show affection today?', current_date + 12),
  (14, 'Our First Two Nights', 'Between our first night date and our second night date, what did you tell yourself (or a close friend) about me?', current_date + 13),
  (15, 'Two Worlds', 'What is one piece of your daily environment—a view, a café, a sound at night—that you cannot wait to introduce me to in person?', current_date + 14),
  (16, 'Getting to Know You', 'When you have had a long, draining day and your social battery is near 10%, how do you best like to be cared for?', current_date + 15),
  (17, 'Our First Reunion', 'Since our story started at night, how should we spend our very first night together when we reunite as an official couple?', current_date + 16),
  (18, 'Getting to Know You', 'What is a dream or personal goal you are working toward right now that you want me to cheer you on for?', current_date + 17),
  (19, 'Emotional Closeness', 'What has surprised you the most about how it feels to start building this connection with me from miles away?', current_date + 18),
  (20, 'Getting to Know You', 'If we were cooking dinner together in the same kitchen tonight, what would be our roles and what would be playing in the background?', current_date + 19),
  (21, 'Our First Two Nights', 'If you could freeze one 30-second frame from either of our two night dates and step back inside it right now, which moment would you pick?', current_date + 20),
  (22, 'Emotional Closeness', 'What are three little things about my personality or voice that you have already grown fond of?', current_date + 21),
  (23, 'Our First Reunion', 'What is one adventure—big or small—we absolutely have to cross off together during our first real trip as a couple?', current_date + 22),
  (24, 'Getting to Know You', 'What does falling in love at a healthy, intentional pace look like to you?', current_date + 23),
  (25, 'Two Worlds', 'Look outside or picture your sky tonight: if you could send one sensory detail from your night air to mine, what would it be?', current_date + 24),
  (26, 'Getting to Know You', 'What is a book, film, or place that feels like a secret window into who you are?', current_date + 25),
  (27, 'Emotional Closeness', 'When we are on a voice or video call, what moment makes you forget there is a screen between us?', current_date + 26),
  (28, 'Our First Reunion', 'What is something simple and everyday—not touristy at all—that you are most excited to do side by side when we reunite?', current_date + 27),
  (29, 'Getting to Know You', 'What is a promise you want us to keep to each other while we navigate these early months of distance?', current_date + 28),
  (30, 'Under the Same Night Sky', 'Looking ahead from those first two night dates to everything still in front of us, what makes you most excited about "us"?', current_date + 29)
on conflict (day_number) do update set
  category = excluded.category,
  prompt = excluded.prompt;

-- 4. Seed Default Bucket List Items ("Things We Haven't Done Yet")
insert into public.bucket_list (title, category, added_by, is_completed)
select * from (values
  ('Have our third night date in person—without having to say a long-distance goodbye', 'Night Out', 'dyko', false),
  ('Soak in the volcanic hot springs under the stars in La Fortuna together', 'Adventure', 'dyko', false),
  ('Stargaze near the Rocky Mountains outside Calgary wrapped in one blanket', 'Night Out', 'peyton', false),
  ('Cook our first real dinner together in the same kitchen with music playing', 'Cozy', 'peyton', false),
  ('Take a slow morning coffee walk holding hands with nowhere to rush to', 'Reunion', 'dyko', false),
  ('Fall asleep in the same bed without a phone screen between us', 'Cozy', 'peyton', false)
) as v(title, category, added_by, is_completed)
where not exists (select 1 from public.bucket_list limit 1);

-- 5. Seed Default Long-Distance Date Wheel Ideas
insert into public.date_ideas (title, vibe, added_by)
select * from (values
  ('Watch a movie in sync by candlelight', 'Cinema Night', 'peyton'),
  ('Cook the same meal together on video', 'Kitchen Date', 'dyko'),
  ('Late-night 20 questions in bed', 'Deep Talk', 'peyton'),
  ('Stargazing voice call on the balcony/porch', 'Under the Stars', 'dyko'),
  ('Play an online co-op game together', 'Playful Night', 'peyton'),
  ('Build a shared playlist for our first reunion trip', 'Music & Memories', 'dyko'),
  ('Order each other a surprise dessert or coffee delivery', 'Sweet Surprise', 'peyton'),
  ('Virtual sunset-to-night walk on FaceTime', 'Two Horizons', 'dyko')
) as v(title, vibe, added_by)
where not exists (select 1 from public.date_ideas limit 1);

-- 6. Seed Starter Time-Capsule Letters
insert into public.letters (
  sender_key, sender_name, recipient_key, title, body, unlock_type, unlock_date, moment_label, is_manually_opened
)
select * from (values
  (
    'dyko',
    'Dyko',
    'peyton',
    'From La Fortuna to Calgary — On Our Two Night Dates',
    E'Peyton,\n\nEven with thousands of miles between the tropical rain here in La Fortuna and the night air in Calgary, I still keep thinking about our first two nights together.\n\nIt takes something rare for two evenings to leave such an unmistakable gravity behind. Whenever you open this, remember that we are looking up at the exact same sky—and every day brings us one sunset closer to our third night date in person.\n\nYours,\nDyko',
    'moment',
    null::timestamptz,
    'Open when the distance feels heavy',
    false
  ),
  (
    'peyton',
    'Peyton',
    'dyko',
    'For the Night Before Our Reunion Flight',
    E'Dyko,\n\nIf you are reading this, it means the countdown we have been watching finally reached its last night. Pack your bag, take a deep breath, and look up at the stars one last time from your side of the map.\n\nTomorrow, there are no timezones between us.\n\nCan''t wait to hold you,\nPeyton',
    'date',
    (date_trunc('day', now()) + interval '41 days 20 hours'),
    null,
    false
  )
) as v(sender_key, sender_name, recipient_key, title, body, unlock_type, unlock_date, moment_label, is_manually_opened)
where not exists (select 1 from public.letters limit 1);
