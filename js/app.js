// ============================================================================
// MAIN APPLICATION CONTROLLER (js/app.js) — "Under the Same Night Sky"
// Private Long-Distance Couple PWA for Dyko (La Fortuna) & Peyton (Calgary)
// ============================================================================

import { APP_CONFIG, isSupabaseConfigured } from "./config.js";
import { startTwoWorldsClocks, refreshTwoWorldsWeather } from "./weather.js";
import {
  registerServiceWorker,
  getPushSubscriptionStatus,
  subscribeToWebPush,
  sendPartnerPushNotification
} from "./push.js";
import {
  supabaseClient,
  SEED_DAILY_QUESTIONS,
  getLocalStore,
  saveLocalStore,
  resolvePartnerKeyFromEmail,
  getPreviewPartnerKey,
  setPreviewPartnerKey,
  subscribeToRealtimeUpdates
} from "./supabase.js";

// ============================================================================
// APPLICATION STATE
// ============================================================================
const state = {
  authMode: "preview", // 'supabase' | 'preview'
  userId: null,
  currentPartnerKey: null, // 'dyko' | 'peyton'
  activeTab: "presence",
  selectedQuestionDay: 1,
  letterFilter: "all",
  wheelRotation: 0,
  isWheelSpinning: false,

  // Data collections
  userStatus: {
    dyko: null,
    peyton: null
  },
  pulses: [],
  dailyQuestions: [...SEED_DAILY_QUESTIONS],
  dailyAnswers: [],
  letters: [],
  reunionPlan: null,
  bucketList: [],
  dateIdeas: []
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelativeTime(isoString) {
  if (!isoString) return "just now";
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  );
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function formatReadableDate(isoString) {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(isoString));
  } catch (_e) {
    return isoString;
  }
}

export function showToast(message, icon = "✨") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto sky-card-gold rounded-2xl px-4 py-3 text-xs text-parchment shadow-2xl border border-amberGold/45 flex items-center gap-2.5 animate-unseal";
  toast.innerHTML = `
    <span class="text-base shrink-0">${icon}</span>
    <span class="leading-snug">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.35s ease";
    setTimeout(() => toast.remove(), 360);
  }, 3600);
}

function getMyProfile() {
  return APP_CONFIG.PARTNERS[state.currentPartnerKey || "dyko"];
}

function getPartnerProfile() {
  const me = getMyProfile();
  return APP_CONFIG.PARTNERS[me.partnerKey];
}

// ============================================================================
// CONSTELLATION HEADER ANIMATION (TWO WORLDS BRIDGE)
// ============================================================================
let constellationTimeout = null;

export function triggerConstellationGlow(bannerText, direction = "to-partner") {
  const header = document.getElementById("two-worlds-header");
  const banner = document.getElementById("sky-pulse-banner");
  const bannerLabel = document.getElementById("sky-pulse-banner-text");
  const traveler = document.getElementById("pulse-traveler");

  if (!header) return;

  header.classList.add("constellation-active");

  if (banner && bannerLabel && bannerText) {
    bannerLabel.textContent = bannerText;
    banner.classList.remove("opacity-0");
    banner.classList.add("opacity-100");
  }

  // Animate the star particle along the quadratic Bezier curve M 56 86 Q 210 18 364 86
  if (traveler) {
    const startX = direction === "from-calgary" ? 56 : 364;
    const endX = direction === "from-calgary" ? 364 : 56;
    const startTime = performance.now();
    const duration = 1250;

    const animateDot = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      // Quadratic bezier interpolation with control point (210, 18)
      const inv = 1 - t;
      const x = inv * inv * startX + 2 * inv * t * 210 + t * t * endX;
      const y = inv * inv * 86 + 2 * inv * t * 18 + t * t * 86;
      traveler.setAttribute("cx", x.toFixed(1));
      traveler.setAttribute("cy", y.toFixed(1));
      if (t < 1) {
        requestAnimationFrame(animateDot);
      }
    };
    requestAnimationFrame(animateDot);
  }

  if (constellationTimeout) clearTimeout(constellationTimeout);
  constellationTimeout = setTimeout(() => {
    header.classList.remove("constellation-active");
    if (banner) {
      banner.classList.remove("opacity-100");
      banner.classList.add("opacity-0");
    }
  }, 3400);
}

// ============================================================================
// DATA LOADING & SYNCHRONIZATION (SUPABASE OR LOCAL SANCTUARY STORE)
// ============================================================================
async function loadAllSanctuaryData() {
  if (state.authMode === "supabase" && supabaseClient) {
    try {
      const [
        statusRes,
        pulsesRes,
        questionsRes,
        answersRes,
        lettersRes,
        reunionRes,
        bucketRes,
        datesRes
      ] = await Promise.all([
        supabaseClient.from("user_status").select("*"),
        supabaseClient
          .from("pulses")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseClient
          .from("daily_questions")
          .select("*")
          .order("day_number", { ascending: true }),
        supabaseClient.from("daily_answers").select("*"),
        supabaseClient
          .from("letters")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient.from("reunion_plan").select("*").eq("id", 1).maybeSingle(),
        supabaseClient
          .from("bucket_list")
          .select("*")
          .order("created_at", { ascending: true }),
        supabaseClient
          .from("date_ideas")
          .select("*")
          .order("created_at", { ascending: true })
      ]);

      const localFallback = getLocalStore();

      // 1. User status
      state.userStatus = { ...localFallback.user_status };
      if (statusRes.data && statusRes.data.length > 0) {
        statusRes.data.forEach((row) => {
          state.userStatus[row.partner_key] = row;
        });
      }

      // 2. Pulses
      state.pulses =
        pulsesRes.data && pulsesRes.data.length > 0
          ? pulsesRes.data
          : localFallback.pulses;

      // 3. Daily Questions
      state.dailyQuestions =
        questionsRes.data && questionsRes.data.length > 0
          ? questionsRes.data
          : SEED_DAILY_QUESTIONS;

      // 4. Daily Answers
      state.dailyAnswers = answersRes.data || [];

      // 5. Time-Capsule Letters
      state.letters = lettersRes.data || [];

      // 6. Reunion Plan
      state.reunionPlan = reunionRes.data || localFallback.reunion_plan;

      // 7. Bucket List
      state.bucketList = bucketRes.data || [];

      // 8. Date Wheel Ideas
      state.dateIdeas =
        datesRes.data && datesRes.data.length > 0
          ? datesRes.data
          : localFallback.date_ideas;
    } catch (err) {
      console.warn("[Data] Falling back to local store:", err);
      hydrateFromLocalStore();
    }
  } else {
    hydrateFromLocalStore();
  }

  renderAllViews();
}

function hydrateFromLocalStore() {
  const store = getLocalStore();
  state.userStatus = store.user_status;
  state.pulses = store.pulses || [];
  state.dailyQuestions =
    store.daily_questions && store.daily_questions.length > 0
      ? store.daily_questions
      : SEED_DAILY_QUESTIONS;
  state.dailyAnswers = store.daily_answers || [];
  state.letters = store.letters || [];
  state.reunionPlan = store.reunion_plan;
  state.bucketList = store.bucket_list || [];
  state.dateIdeas = store.date_ideas || [];
}

// ============================================================================
// RENDER ALL UI SECTIONS
// ============================================================================
function renderAllViews() {
  renderHeaderIdentity();
  renderStatusCards();
  renderLastPulseLog();
  renderDailyQuestionTab();
  renderLettersTab();
  renderReunionAndSavings();
  renderDateWheel();
  renderBucketList();
}

function renderHeaderIdentity() {
  const me = getMyProfile();
  const badgeName = document.getElementById("active-user-badge-name");
  const settingsAccountLabel = document.getElementById("settings-account-label");
  const previewSwitcher = document.getElementById("preview-switcher-section");

  if (badgeName) {
    badgeName.textContent = `${me.emoji} ${me.name}`;
  }
  if (settingsAccountLabel) {
    settingsAccountLabel.textContent = `Signed in as ${me.name} (${me.city}, ${me.country})`;
  }
  if (previewSwitcher) {
    previewSwitcher.classList.toggle("hidden", state.authMode === "supabase");
  }
}

// ============================================================================
// TAB 1: PRESENCE — STATUS CARDS & SILENT PULSES
// ============================================================================
function getMoodIcon(mood = "") {
  if (mood.includes("call")) return "📞";
  if (mood.includes("Working")) return "💻";
  if (mood.includes("Resting")) return "🌙";
  if (mood.includes("Out")) return "🌿";
  return "✨";
}

function renderStatusCards() {
  const container = document.getElementById("status-cards-container");
  if (!container) return;

  const me = getMyProfile();
  const partner = getPartnerProfile();
  const myStatus = state.userStatus[me.key] || {
    display_name: me.name,
    city: me.city,
    battery: 85,
    mood: "Missing you",
    note: "",
    updated_at: new Date().toISOString()
  };
  const partnerStatus = state.userStatus[partner.key] || {
    display_name: partner.name,
    city: partner.city,
    battery: 80,
    mood: "Missing you",
    note: "",
    updated_at: new Date().toISOString()
  };

  const buildCardHtml = (profile, status, isMe) => `
    <article
      ${isMe ? 'id="my-status-card" role="button" tabindex="0"' : ""}
      class="sky-card p-4 relative ${
        isMe
          ? "sky-card-interactive cursor-pointer border-amberGold/30"
          : "border-amberGold/15"
      }"
    >
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-midnight/85 border border-amberGold/30 flex items-center justify-center text-lg shadow-inner">
            ${profile.emoji}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h3 class="font-serif-editorial text-xl font-semibold text-parchment leading-none">
                ${escapeHtml(profile.name)}
              </h3>
              <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isMe
                  ? "bg-amberGold/20 text-softGold border border-amberGold/35"
                  : "bg-midnight/70 text-cream/70 border border-amberGold/15"
              }">
                ${isMe ? "You · Tap to edit" : "Live"}
              </span>
            </div>
            <p class="text-[11px] text-cream/65 mt-1">
              ${escapeHtml(profile.city)} &bull; Updated ${formatRelativeTime(
    status.updated_at
  )}
            </p>
          </div>
        </div>
      </div>

      <!-- Social Battery Bar -->
      <div class="mb-3">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-cream/75 text-[11px]">Social Battery</span>
          <span class="font-serif-editorial text-base font-semibold text-softGold">
            ${Number(status.battery) || 0}%
          </span>
        </div>
        <div class="battery-track">
          <div class="battery-fill" style="width: ${Math.min(
            100,
            Math.max(0, Number(status.battery) || 0)
          )}%"></div>
        </div>
      </div>

      <!-- Current Mood Pill -->
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-midnight/75 border border-amberGold/25 text-xs text-softGold font-medium">
          <span>${getMoodIcon(status.mood)}</span>
          <span>${escapeHtml(status.mood || "Missing you")}</span>
        </span>
      </div>

      <!-- Optional 1-Line Note -->
      <p class="text-xs text-cream/85 italic font-serif-editorial text-sm leading-snug min-h-[1.25rem]">
        ${
          status.note
            ? `&ldquo;${escapeHtml(status.note)}&rdquo;`
            : `<span class="text-cream/40">Quietly under the stars...</span>`
        }
      </p>
    </article>
  `;

  container.innerHTML =
    buildCardHtml(me, myStatus, true) +
    buildCardHtml(partner, partnerStatus, false);

  const myCard = document.getElementById("my-status-card");
  if (myCard) {
    myCard.addEventListener("click", openStatusModal);
  }
}

function openStatusModal() {
  const me = getMyProfile();
  const current = state.userStatus[me.key] || {
    battery: 85,
    mood: "Missing you",
    note: ""
  };

  const batteryInput = document.getElementById("status-battery-input");
  const batteryVal = document.getElementById("status-battery-value");
  const noteInput = document.getElementById("status-note-input");
  const noteCount = document.getElementById("status-note-count");

  if (batteryInput) batteryInput.value = current.battery ?? 85;
  if (batteryVal) batteryVal.textContent = `${current.battery ?? 85}%`;
  if (noteInput) noteInput.value = current.note || "";
  if (noteCount)
    noteCount.textContent = `${(current.note || "").length} / 100`;

  const radios = document.querySelectorAll('input[name="mood"]');
  radios.forEach((r) => {
    r.checked = r.value === (current.mood || "Missing you");
  });

  document.getElementById("status-modal")?.classList.remove("hidden");
}

async function handleSaveStatus(e) {
  e.preventDefault();
  const me = getMyProfile();
  const battery = Number(
    document.getElementById("status-battery-input")?.value ?? 85
  );
  const selectedRadio = document.querySelector('input[name="mood"]:checked');
  const mood = selectedRadio ? selectedRadio.value : "Missing you";
  const note = (
    document.getElementById("status-note-input")?.value || ""
  ).trim();
  const nowIso = new Date().toISOString();

  const updatedRow = {
    partner_key: me.key,
    display_name: me.name,
    city: me.city,
    battery,
    mood,
    note,
    updated_at: nowIso
  };

  state.userStatus[me.key] = updatedRow;

  if (state.authMode === "supabase" && supabaseClient) {
    const { error } = await supabaseClient
      .from("user_status")
      .upsert(updatedRow, { onConflict: "partner_key" });
    if (error) {
      showToast(`Could not update status: ${error.message}`, "⚠️");
      return;
    }
  } else {
    const store = getLocalStore();
    store.user_status[me.key] = updatedRow;
    saveLocalStore(store, { table: "user_status", partner_key: me.key });
  }

  document.getElementById("status-modal")?.classList.add("hidden");
  renderStatusCards();
  showToast("Your presence card has been updated.", "🌙");
}

// ============================================================================
// SILENT PULSES (2x2 GRID)
// ============================================================================
function renderLastPulseLog() {
  const logEl = document.getElementById("last-pulse-log");
  const timeEl = document.getElementById("last-pulse-time");
  if (!logEl) return;

  if (!state.pulses || state.pulses.length === 0) {
    logEl.textContent = "No pulses sent yet tonight — tap any card above";
    if (timeEl) timeEl.textContent = "";
    return;
  }

  const latest = state.pulses[0];
  logEl.textContent = `${latest.sender_name} sent "${latest.message}"`;
  if (timeEl) {
    timeEl.textContent = formatRelativeTime(latest.created_at);
  }
}

async function handleSendSilentPulse(btn, event) {
  const pulseType = btn.getAttribute("data-pulse-type");
  const pulseMessage = btn.getAttribute("data-pulse-message");
  if (!pulseType || !pulseMessage) return;

  // 1. Tactile Golden Ripple Animation at tap point
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height);
  const x = (event?.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (event?.clientY || rect.top + rect.height / 2) - rect.top - size / 2;

  ripple.className = "golden-ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  btn.appendChild(ripple);
  btn.classList.add("sending");

  setTimeout(() => {
    ripple.remove();
    btn.classList.remove("sending");
  }, 950);

  const me = getMyProfile();
  const partner = getPartnerProfile();

  // 2. Light up the Constellation Arc in the "Two Worlds" header
  const direction = me.key === "peyton" ? "from-calgary" : "from-lafortuna";
  triggerConstellationGlow(
    `✨ Sent "${pulseMessage}" to ${partner.name} in ${partner.city}`,
    direction
  );

  // 3. Insert into pulses table
  const newPulse = {
    id: crypto.randomUUID ? crypto.randomUUID() : `pulse-${Date.now()}`,
    sender_key: me.key,
    sender_name: me.name,
    recipient_key: partner.key,
    pulse_type: pulseType,
    message: pulseMessage,
    created_at: new Date().toISOString()
  };

  state.pulses = [newPulse, ...state.pulses.slice(0, 19)];
  renderLastPulseLog();

  if (state.authMode === "supabase" && supabaseClient) {
    const { error } = await supabaseClient.from("pulses").insert({
      sender_key: newPulse.sender_key,
      sender_name: newPulse.sender_name,
      recipient_key: newPulse.recipient_key,
      pulse_type: newPulse.pulse_type,
      message: newPulse.message
    });
    if (error) {
      console.warn("[Pulse] Insert warning:", error.message);
    }
  } else {
    const store = getLocalStore();
    store.pulses = state.pulses;
    saveLocalStore(store, {
      table: "pulses",
      pulse: newPulse
    });
  }

  // 4. Trigger real Web Push notification to partner's phone
  await sendPartnerPushNotification(supabaseClient, {
    recipientKey: partner.key,
    senderName: me.name,
    eventType: "pulse",
    title: `${me.name} (${me.city}) ✨`,
    body: pulseMessage,
    tab: "presence"
  });

  showToast(`Pulse sent to ${partner.name}: "${pulseMessage}"`, "✨");
}

// ============================================================================
// TAB 2: DAILY (LOCKED DAILY QUESTION & SEALED ENVELOPE MECHANIC)
// ============================================================================
function getCurrentQuestion() {
  return (
    state.dailyQuestions.find(
      (q) => Number(q.day_number) === Number(state.selectedQuestionDay)
    ) || state.dailyQuestions[0]
  );
}

function renderDailyQuestionTab() {
  const question = getCurrentQuestion();
  if (!question) return;

  const totalDays = state.dailyQuestions.length || 30;
  const dayBadge = document.getElementById("daily-question-day-badge");
  const catEl = document.getElementById("daily-question-category");
  const promptEl = document.getElementById("daily-question-prompt");
  const prevBtn = document.getElementById("prev-question-btn");
  const nextBtn = document.getElementById("next-question-btn");
  const sealPill = document.getElementById("daily-seal-status-pill");
  const area = document.getElementById("daily-answers-area");

  if (dayBadge)
    dayBadge.textContent = `Day ${question.day_number} of ${totalDays}`;
  if (catEl) catEl.textContent = question.category;
  if (promptEl) promptEl.textContent = `“${question.prompt}”`;
  if (prevBtn) prevBtn.disabled = question.day_number <= 1;
  if (nextBtn) nextBtn.disabled = question.day_number >= totalDays;

  const me = getMyProfile();
  const partner = getPartnerProfile();

  const myAnswer = state.dailyAnswers.find(
    (a) =>
      Number(a.question_id) === Number(question.id) && a.partner_key === me.key
  );
  const partnerAnswer = state.dailyAnswers.find(
    (a) =>
      Number(a.question_id) === Number(question.id) &&
      a.partner_key === partner.key
  );

  const bothAnswered = Boolean(myAnswer && partnerAnswer);

  if (sealPill) {
    sealPill.innerHTML = bothAnswered
      ? `<span class="text-softGold">✨ Both Unsealed</span>`
      : `<span class="text-amberGold">🕯️ Wax-Sealed Ritual</span>`;
  }

  if (!area) return;

  // CASE A: BOTH PARTNERS HAVE ANSWERED -> UNSEAL BOTH ENVELOPES SIDE-BY-SIDE
  if (bothAnswered) {
    area.innerHTML = `
      <div class="rounded-2xl bg-amberGold/12 border border-amberGold/35 px-4 py-2.5 text-center animate-unseal">
        <p class="text-xs text-softGold font-medium">
          ✨ Both wax seals have broken — Day ${question.day_number} is unlocked
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-unseal">
        <!-- My Unsealed Answer -->
        <article class="parchment-surface rounded-2xl p-4 sm:p-5">
          <div class="flex items-center justify-between mb-2.5 pb-2 border-b border-amberGold/20">
            <span class="text-xs font-semibold text-softGold flex items-center gap-1.5">
              <span>${me.emoji}</span> ${escapeHtml(me.name)}'s Answer
            </span>
            <span class="text-[11px] text-cream/55">${formatRelativeTime(
              myAnswer.created_at
            )}</span>
          </div>
          <p class="font-serif-editorial text-lg text-parchment leading-relaxed whitespace-pre-line">
            ${escapeHtml(myAnswer.answer_text)}
          </p>
        </article>

        <!-- Partner's Unsealed Answer -->
        <article class="parchment-surface rounded-2xl p-4 sm:p-5">
          <div class="flex items-center justify-between mb-2.5 pb-2 border-b border-amberGold/20">
            <span class="text-xs font-semibold text-softGold flex items-center gap-1.5">
              <span>${partner.emoji}</span> ${escapeHtml(partner.name)}'s Answer
            </span>
            <span class="text-[11px] text-cream/55">${formatRelativeTime(
              partnerAnswer.created_at
            )}</span>
          </div>
          <p class="font-serif-editorial text-lg text-parchment leading-relaxed whitespace-pre-line">
            ${escapeHtml(partnerAnswer.answer_text)}
          </p>
        </article>
      </div>
    `;
    return;
  }

  // CASE B: NOT BOTH ANSWERED YET -> SHOW PARTNER'S WAX-SEALED ENVELOPE + MY COMPOSER OR SEALED CARD
  const partnerEnvelopeState = partnerAnswer
    ? {
        headline: `${partner.name} has answered — write yours to unseal`,
        subline: `Submitted ${formatRelativeTime(
          partnerAnswer.created_at
        )} from ${partner.city}. Locked behind the golden wax seal until your answer is saved.`,
        badge: "Ready to Unseal"
      }
    : {
        headline: `Waiting for ${partner.name}...`,
        subline: `As soon as both of you have written your reflections for Day ${question.day_number}, both envelopes unseal together.`,
        badge: "Awaiting Partner"
      };

  const mySectionHtml = myAnswer
    ? `
      <div class="sky-card p-5 border-amberGold/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-softGold">
            ${me.emoji} Your Sealed Reflection
          </span>
          <span class="text-[11px] text-amberGold">Saved ${formatRelativeTime(
            myAnswer.created_at
          )}</span>
        </div>
        <p class="font-serif-editorial text-lg text-parchment/90 leading-relaxed whitespace-pre-line">
          ${escapeHtml(myAnswer.answer_text)}
        </p>
        <p class="text-[11px] text-cream/60 mt-3 pt-2.5 border-t border-amberGold/15">
          🕯️ Your envelope is sealed and waiting for ${escapeHtml(
            partner.name
          )} to answer.
        </p>
      </div>
    `
    : `
      <form id="daily-answer-form" class="sky-card p-4 sm:p-5 space-y-3">
        <div class="flex items-center justify-between">
          <label for="daily-answer-textarea" class="text-xs uppercase tracking-wider text-softGold font-semibold">
            ${me.emoji} Write Your Reflection (${escapeHtml(me.name)})
          </label>
          <span class="text-[11px] text-cream/55">Day ${question.day_number}</span>
        </div>
        <textarea
          id="daily-answer-textarea"
          rows="4"
          required
          placeholder="Write your honest answer for ${escapeHtml(partner.name)}..."
          class="w-full rounded-2xl bg-midnight/80 border border-amberGold/25 p-3.5 text-base font-serif-editorial text-parchment placeholder-cream/40 focus:outline-none focus:border-amberGold leading-relaxed"
        ></textarea>
        <button
          type="submit"
          class="w-full rounded-xl bg-gradient-to-r from-candleGold via-amberGold to-softGold text-midnight font-semibold py-3 text-xs shadow-lg hover:brightness-105 transition"
        >
          ${
            partnerAnswer
              ? `✒️ Seal Answer & Unseal ${escapeHtml(partner.name)}'s Envelope`
              : "✒️ Seal My Answer for Tonight"
          }
        </button>
      </form>
    `;

  area.innerHTML = `
    <!-- Partner's Wax-Sealed Envelope -->
    <div class="wax-envelope p-6 text-center">
      <div class="flex justify-center mb-3 mt-1">
        <div class="wax-seal-medal">
          <span class="font-serif-editorial text-lg font-bold text-midnight select-none">
            ${partner.name.charAt(0)}
          </span>
        </div>
      </div>
      <span class="inline-block px-2.5 py-0.5 rounded-full bg-amberGold/15 border border-amberGold/30 text-[10px] uppercase tracking-widest text-softGold mb-1.5">
        ${partnerEnvelopeState.badge}
      </span>
      <h4 class="font-serif-editorial text-xl font-semibold text-parchment">
        ${escapeHtml(partnerEnvelopeState.headline)}
      </h4>
      <p class="text-xs text-cream/70 mt-1 max-w-sm mx-auto leading-relaxed">
        ${escapeHtml(partnerEnvelopeState.subline)}
      </p>
    </div>

    ${mySectionHtml}
  `;

  const form = document.getElementById("daily-answer-form");
  if (form) {
    form.addEventListener("submit", handleDailyAnswerSubmit);
  }
}

async function handleDailyAnswerSubmit(e) {
  e.preventDefault();
  const textarea = document.getElementById("daily-answer-textarea");
  const answerText = (textarea?.value || "").trim();
  if (!answerText) return;

  const question = getCurrentQuestion();
  const me = getMyProfile();
  const partner = getPartnerProfile();

  const newAnswer = {
    id: crypto.randomUUID ? crypto.randomUUID() : `ans-${Date.now()}`,
    question_id: question.id,
    partner_key: me.key,
    author_name: me.name,
    answer_text: answerText,
    created_at: new Date().toISOString()
  };

  // Update state
  state.dailyAnswers = [
    ...state.dailyAnswers.filter(
      (a) =>
        !(
          Number(a.question_id) === Number(question.id) &&
          a.partner_key === me.key
        )
    ),
    newAnswer
  ];

  if (state.authMode === "supabase" && supabaseClient) {
    const { error } = await supabaseClient.from("daily_answers").upsert(
      {
        question_id: question.id,
        partner_key: me.key,
        author_name: me.name,
        answer_text: answerText,
        updated_at: new Date().toISOString()
      },
      { onConflict: "question_id,partner_key" }
    );
    if (error) {
      showToast(`Error saving answer: ${error.message}`, "⚠️");
      return;
    }
  } else {
    const store = getLocalStore();
    store.daily_answers = state.dailyAnswers;
    saveLocalStore(store, {
      table: "daily_answers",
      question_id: question.id
    });
  }

  const partnerAlreadyAnswered = state.dailyAnswers.some(
    (a) =>
      Number(a.question_id) === Number(question.id) &&
      a.partner_key === partner.key
  );

  renderDailyQuestionTab();
  triggerConstellationGlow(
    partnerAlreadyAnswered
      ? `✨ Day ${question.day_number} unsealed for both of you!`
      : `🕯️ Sealed Day ${question.day_number} answer for ${partner.name}`
  );

  await sendPartnerPushNotification(supabaseClient, {
    recipientKey: partner.key,
    senderName: me.name,
    eventType: partnerAlreadyAnswered ? "daily_unsealed" : "daily_answer",
    title: partnerAlreadyAnswered
      ? `Day ${question.day_number} Unsealed! ✨`
      : `${me.name} answered today's question 🕯️`,
    body: partnerAlreadyAnswered
      ? `Both of you have answered Day ${question.day_number} — tap to read ${me.name}'s reflection.`
      : `Write your answer to break the wax seal on Day ${question.day_number}.`,
    tab: "daily"
  });

  showToast(
    partnerAlreadyAnswered
      ? `Wax seal broken! Both Day ${question.day_number} answers are now revealed.`
      : `Your answer is sealed. Waiting for ${partner.name}!`,
    "🕯️"
  );
}

function renderPastQuestionsModal() {
  const listEl = document.getElementById("past-questions-list");
  if (!listEl) return;

  const me = getMyProfile();
  const partner = getPartnerProfile();

  listEl.innerHTML = state.dailyQuestions
    .map((q) => {
      const myAns = state.dailyAnswers.some(
        (a) => Number(a.question_id) === Number(q.id) && a.partner_key === me.key
      );
      const partnerAns = state.dailyAnswers.some(
        (a) =>
          Number(a.question_id) === Number(q.id) && a.partner_key === partner.key
      );
      const both = myAns && partnerAns;

      return `
        <button
          type="button"
          data-jump-day="${q.day_number}"
          class="w-full text-left rounded-2xl p-3.5 border transition flex items-start justify-between gap-3 ${
            Number(q.day_number) === Number(state.selectedQuestionDay)
              ? "bg-amberGold/20 border-amberGold/50"
              : "bg-midnight/65 border-amberGold/15 hover:border-amberGold/35"
          }"
        >
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-amberGold">
                Day ${q.day_number}
              </span>
              <span class="text-[11px] text-cream/60">&bull; ${escapeHtml(
                q.category
              )}</span>
            </div>
            <p class="font-serif-editorial text-base text-parchment leading-snug">
              ${escapeHtml(q.prompt)}
            </p>
          </div>
          <span class="shrink-0 text-xs px-2.5 py-1 rounded-full ${
            both
              ? "bg-amberGold/25 text-softGold border border-amberGold/40"
              : myAns || partnerAns
              ? "bg-midnight text-amberGold border border-amberGold/25"
              : "bg-midnight/70 text-cream/50 border border-amberGold/10"
          }">
            ${both ? "✨ Unsealed" : myAns || partnerAns ? "1 / 2" : "Sealed"}
          </span>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-jump-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedQuestionDay = Number(btn.getAttribute("data-jump-day"));
      document.getElementById("past-questions-modal")?.classList.add("hidden");
      renderDailyQuestionTab();
    });
  });
}

// ============================================================================
// TAB 3: LETTERS (TIME CAPSULES — DATE-LOCKED & "OPEN WHEN...")
// ============================================================================
function isLetterUnlocked(letter) {
  if (letter.unlock_type === "date") {
    if (!letter.unlock_date) return true;
    return Date.now() >= new Date(letter.unlock_date).getTime();
  }
  // For 'moment' ("Open When...") capsules:
  return Boolean(letter.is_manually_opened);
}

function renderLettersTab() {
  const container = document.getElementById("letters-list-container");
  if (!container) return;

  const me = getMyProfile();
  let filtered = [...state.letters];

  if (state.letterFilter === "received") {
    filtered = filtered.filter((l) => l.recipient_key === me.key);
  } else if (state.letterFilter === "sent") {
    filtered = filtered.filter((l) => l.sender_key === me.key);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sky-card p-8 text-center">
        <p class="font-serif-editorial text-xl text-parchment">No time capsules in this view yet</p>
        <p class="text-xs text-cream/65 mt-1">Tap "Write Letter" above to seal a message for your partner.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((letter) => {
      const unlocked = isLetterUnlocked(letter);
      const isRecipient = letter.recipient_key === me.key;
      const conditionLabel =
        letter.unlock_type === "date"
          ? `⏳ Unseals on ${formatReadableDate(letter.unlock_date)}`
          : `🕯️ ${letter.moment_label || "Open when needed"}`;

      if (!unlocked) {
        // Vintage Wax-Sealed Envelope Card
        return `
          <article class="wax-envelope p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="inline-block px-2.5 py-0.5 rounded-full bg-amberGold/15 border border-amberGold/30 text-[10px] uppercase tracking-wider text-softGold mb-1.5">
                  ${escapeHtml(conditionLabel)}
                </span>
                <h3 class="font-serif-editorial text-xl font-semibold text-parchment">
                  ${escapeHtml(letter.title)}
                </h3>
                <p class="text-xs text-cream/70 mt-0.5">
                  From <span class="text-softGold">${escapeHtml(
                    letter.sender_name
                  )}</span> &rarr; To <span class="text-softGold">${
          letter.recipient_key === "dyko" ? "Dyko" : "Peyton"
        }</span>
                </p>
              </div>
              <div class="wax-seal-medal shrink-0">
                <span class="font-serif-editorial text-base font-bold text-midnight">
                  ${letter.sender_name.charAt(0)}
                </span>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-amberGold/15 flex items-center justify-between">
              <span class="text-[11px] text-cream/55">
                Sealed ${formatRelativeTime(letter.created_at)}
              </span>
              ${
                letter.unlock_type === "moment" && isRecipient
                  ? `<button
                      type="button"
                      data-break-seal-id="${letter.id}"
                      class="rounded-full bg-gradient-to-r from-candleGold to-amberGold text-midnight font-semibold px-3.5 py-1.5 text-xs shadow hover:brightness-105 transition"
                    >
                      🕯️ Break Wax Seal &amp; Read
                    </button>`
                  : letter.unlock_type === "date"
                  ? `<span class="text-xs text-amberGold/80 italic font-serif-editorial">
                      Locked until future date arrives
                    </span>`
                  : `<span class="text-xs text-amberGold/80 italic font-serif-editorial">
                      Waiting for ${
                        letter.recipient_key === "dyko" ? "Dyko" : "Peyton"
                      } to break the seal
                    </span>`
              }
            </div>
          </article>
        `;
      }

      // Unlocked Parchment Preview Card
      return `
        <article
          data-open-letter-id="${letter.id}"
          class="parchment-surface rounded-2xl p-5 cursor-pointer hover:border-amberGold/60 transition"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="inline-block px-2.5 py-0.5 rounded-full bg-amberGold/20 border border-amberGold/40 text-[10px] uppercase tracking-wider text-softGold mb-1.5">
                ✨ Unsealed &bull; ${escapeHtml(
                  letter.unlock_type === "date"
                    ? "Date Capsule"
                    : letter.moment_label || "Open When"
                )}
              </span>
              <h3 class="font-serif-editorial text-2xl font-semibold text-parchment">
                ${escapeHtml(letter.title)}
              </h3>
              <p class="text-xs text-cream/70 mt-0.5">
                Written by ${escapeHtml(letter.sender_name)} &bull; ${formatRelativeTime(
        letter.created_at
      )}
              </p>
            </div>
            <span class="text-xs text-softGold font-medium shrink-0">Read &rarr;</span>
          </div>
          <p class="font-serif-editorial text-base text-cream/85 line-clamp-2 mt-3 italic">
            &ldquo;${escapeHtml(letter.body.slice(0, 140))}...&rdquo;
          </p>
        </article>
      `;
    })
    .join("");

  // Bind Break Wax Seal buttons
  container.querySelectorAll("[data-break-seal-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-break-seal-id");
      await handleBreakLetterSeal(id);
    });
  });

  // Bind Open Unlocked Letter Reader
  container.querySelectorAll("[data-open-letter-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-open-letter-id");
      openLetterReaderModal(id);
    });
  });
}

async function handleBreakLetterSeal(letterId) {
  const letter = state.letters.find((l) => String(l.id) === String(letterId));
  if (!letter) return;

  const nowIso = new Date().toISOString();
  letter.is_manually_opened = true;
  letter.opened_at = nowIso;

  if (state.authMode === "supabase" && supabaseClient) {
    await supabaseClient
      .from("letters")
      .update({ is_manually_opened: true, opened_at: nowIso })
      .eq("id", letter.id);
  } else {
    const store = getLocalStore();
    store.letters = state.letters;
    saveLocalStore(store, { table: "letters", id: letter.id });
  }

  renderLettersTab();
  openLetterReaderModal(letter.id);

  const me = getMyProfile();
  const partner = getPartnerProfile();
  await sendPartnerPushNotification(supabaseClient, {
    recipientKey: partner.key,
    senderName: me.name,
    eventType: "letter",
    title: `${me.name} broke the wax seal on your letter 🕯️`,
    body: `"${letter.title}" has been opened under the night sky.`,
    tab: "letters"
  });
}

function openLetterReaderModal(letterId) {
  const letter = state.letters.find((l) => String(l.id) === String(letterId));
  if (!letter) return;

  document.getElementById("reader-title").textContent = letter.title;
  document.getElementById(
    "reader-subtitle"
  ).textContent = `From ${letter.sender_name} • Written ${formatReadableDate(
    letter.created_at
  )}`;
  document.getElementById("reader-body").textContent = letter.body;
  document.getElementById("reader-condition-note").textContent =
    letter.unlock_type === "date"
      ? `Unlocked on ${formatReadableDate(letter.unlock_date)}`
      : letter.moment_label || "Unsealed under the night sky";

  document.getElementById("letter-reader-modal")?.classList.remove("hidden");
}

async function handleCreateLetter(e) {
  e.preventDefault();
  const me = getMyProfile();
  const partner = getPartnerProfile();

  const title = (
    document.getElementById("letter-title-input")?.value || ""
  ).trim();
  const unlockType =
    document.getElementById("letter-unlock-type")?.value || "moment";
  const momentLabel = (
    document.getElementById("letter-moment-input")?.value || ""
  ).trim();
  const rawDate = document.getElementById("letter-date-input")?.value;
  const body = (
    document.getElementById("letter-body-input")?.value || ""
  ).trim();

  if (!title || !body) return;

  let unlockDateIso = null;
  if (unlockType === "date") {
    if (!rawDate) {
      showToast("Please choose an unseal date & time.", "⏳");
      return;
    }
    unlockDateIso = new Date(rawDate).toISOString();
  }

  const newLetter = {
    id: crypto.randomUUID ? crypto.randomUUID() : `letter-${Date.now()}`,
    sender_key: me.key,
    sender_name: me.name,
    recipient_key: partner.key,
    title,
    body,
    unlock_type: unlockType,
    unlock_date: unlockDateIso,
    moment_label:
      unlockType === "moment"
        ? momentLabel || "Open when the distance feels heavy"
        : null,
    is_manually_opened: false,
    opened_at: null,
    created_at: new Date().toISOString()
  };

  state.letters = [newLetter, ...state.letters];

  if (state.authMode === "supabase" && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("letters")
      .insert({
        sender_key: newLetter.sender_key,
        sender_name: newLetter.sender_name,
        recipient_key: newLetter.recipient_key,
        title: newLetter.title,
        body: newLetter.body,
        unlock_type: newLetter.unlock_type,
        unlock_date: newLetter.unlock_date,
        moment_label: newLetter.moment_label,
        is_manually_opened: false
      })
      .select()
      .maybeSingle();

    if (error) {
      showToast(`Could not seal letter: ${error.message}`, "⚠️");
      return;
    }
    if (data) {
      state.letters[0] = data;
    }
  } else {
    const store = getLocalStore();
    store.letters = state.letters;
    saveLocalStore(store, { table: "letters", letter: newLetter });
  }

  document.getElementById("letter-composer-form")?.reset();
  document.getElementById("letter-composer-modal")?.classList.add("hidden");
  renderLettersTab();
  triggerConstellationGlow(`✒️ Sealed a new letter for ${partner.name}`);

  await sendPartnerPushNotification(supabaseClient, {
    recipientKey: partner.key,
    senderName: me.name,
    eventType: "letter",
    title: `New Time-Capsule Letter from ${me.name} ✉️`,
    body:
      unlockType === "moment"
        ? `"${title}" (${newLetter.moment_label})`
        : `"${title}" — sealed until ${formatReadableDate(unlockDateIso)}`,
    tab: "letters"
  });

  showToast(`Time-capsule letter sealed for ${partner.name}!`, "✉️");
}

// ============================================================================
// TAB 4: PLANS (REUNION COUNTDOWN, SAVINGS TRACKER, DATE WHEEL, BUCKET LIST)
// ============================================================================
function renderReunionAndSavings() {
  const plan = state.reunionPlan;
  if (!plan) return;

  const titleEl = document.getElementById("reunion-title-display");
  const locEl = document.getElementById("reunion-location-display");
  const dateLabelEl = document.getElementById("reunion-target-date-label");

  if (titleEl) titleEl.textContent = plan.title || "Until our first real reunion";
  if (locEl)
    locEl.textContent = `📍 ${plan.location || "Under the same night sky"}`;
  if (dateLabelEl) {
    dateLabelEl.textContent = `Target Reunion: ${formatReadableDate(
      plan.target_date
    )}`;
  }

  updateCountdownDigits();

  // Savings Tracker
  const goal = Math.max(1, Number(plan.savings_goal) || 1800);
  const dykoAmt = Number(plan.dyko_contribution) || 0;
  const peytonAmt = Number(plan.peyton_contribution) || 0;
  const current = dykoAmt + peytonAmt;
  const pct = Math.min(100, Math.round((current / goal) * 100));

  const amtLabel = document.getElementById("savings-amount-label");
  const pctLabel = document.getElementById("savings-percent-label");
  const bar = document.getElementById("savings-progress-bar");
  const dykoEl = document.getElementById("savings-dyko-display");
  const peytonEl = document.getElementById("savings-peyton-display");

  if (amtLabel)
    amtLabel.textContent = `$${current.toLocaleString()} / $${goal.toLocaleString()} ${
      plan.currency || "USD"
    }`;
  if (pctLabel) pctLabel.textContent = `${pct}% saved`;
  if (bar) bar.style.width = `${pct}%`;
  if (dykoEl) dykoEl.textContent = `$${dykoAmt.toLocaleString()}`;
  if (peytonEl) peytonEl.textContent = `$${peytonAmt.toLocaleString()}`;
}

function updateCountdownDigits() {
  const plan = state.reunionPlan;
  if (!plan || !plan.target_date) return;

  const diffMs = Math.max(0, new Date(plan.target_date).getTime() - Date.now());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const dEl = document.getElementById("cd-days");
  const hEl = document.getElementById("cd-hours");
  const mEl = document.getElementById("cd-minutes");
  const sEl = document.getElementById("cd-seconds");

  if (dEl) dEl.textContent = String(days);
  if (hEl) hEl.textContent = String(hours).padStart(2, "0");
  if (mEl) mEl.textContent = String(minutes).padStart(2, "0");
  if (sEl) sEl.textContent = String(seconds).padStart(2, "0");
}

function openReunionModal() {
  const plan = state.reunionPlan || {};
  const titleInput = document.getElementById("reunion-title-input");
  const dateInput = document.getElementById("reunion-date-input");
  const locInput = document.getElementById("reunion-location-input");
  const goalInput = document.getElementById("savings-goal-input");
  const dykoInput = document.getElementById("savings-dyko-input");
  const peytonInput = document.getElementById("savings-peyton-input");

  if (titleInput) titleInput.value = plan.title || "Until our first real reunion";
  if (locInput) locInput.value = plan.location || "Under the same night sky";
  if (dateInput && plan.target_date) {
    const dt = new Date(plan.target_date);
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    dateInput.value = localIso;
  }
  if (goalInput) goalInput.value = plan.savings_goal ?? 1800;
  if (dykoInput) dykoInput.value = plan.dyko_contribution ?? 270;
  if (peytonInput) peytonInput.value = plan.peyton_contribution ?? 270;

  document.getElementById("reunion-modal")?.classList.remove("hidden");
}

async function handleSaveReunionPlan(e) {
  e.preventDefault();
  const title = (
    document.getElementById("reunion-title-input")?.value || ""
  ).trim();
  const rawDate = document.getElementById("reunion-date-input")?.value;
  const location = (
    document.getElementById("reunion-location-input")?.value || ""
  ).trim();
  const savings_goal = Number(
    document.getElementById("savings-goal-input")?.value || 1800
  );
  const dyko_contribution = Number(
    document.getElementById("savings-dyko-input")?.value || 0
  );
  const peyton_contribution = Number(
    document.getElementById("savings-peyton-input")?.value || 0
  );

  const updated = {
    id: 1,
    title: title || "Until our first real reunion",
    target_date: rawDate
      ? new Date(rawDate).toISOString()
      : state.reunionPlan.target_date,
    location: location || "Under the same night sky",
    currency: "USD",
    savings_goal,
    savings_current: dyko_contribution + peyton_contribution,
    dyko_contribution,
    peyton_contribution,
    updated_at: new Date().toISOString()
  };

  state.reunionPlan = updated;

  if (state.authMode === "supabase" && supabaseClient) {
    await supabaseClient.from("reunion_plan").upsert(updated, { onConflict: "id" });
  } else {
    const store = getLocalStore();
    store.reunion_plan = updated;
    saveLocalStore(store, { table: "reunion_plan" });
  }

  document.getElementById("reunion-modal")?.classList.add("hidden");
  renderReunionAndSavings();
  showToast("Reunion countdown & shared savings updated!", "✨");
}

// ============================================================================
// LONG-DISTANCE DATE WHEEL (ILLUSTRATED SVG ROULETTE SPINNER)
// ============================================================================
function renderDateWheel() {
  const svg = document.getElementById("date-wheel-rotor");
  const chipsContainer = document.getElementById("date-ideas-chips");
  if (!svg) return;

  const ideas =
    state.dateIdeas.length > 0
      ? state.dateIdeas
      : [{ id: "fallback", title: "Stargazing voice call" }];

  const count = ideas.length;
  const cx = 130;
  const cy = 130;
  const r = 122;
  const sliceAngle = (2 * Math.PI) / count;

  const palette = [
    "#131B36",
    "#1A2444",
    "#17203D",
    "#0F162D",
    "#1E294D",
    "#151E3B"
  ];

  let pathsHtml = "";
  ideas.forEach((idea, i) => {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const midAngle = startAngle + sliceAngle / 2;
    const labelR = r * 0.63;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const deg = (midAngle * 180) / Math.PI;

    const shortLabel =
      idea.title.length > 20 ? `${idea.title.slice(0, 19)}…` : idea.title;
    const fill = palette[i % palette.length];

    if (count === 1) {
      pathsHtml += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#E6B979" stroke-width="2" />`;
    } else {
      pathsHtml += `
        <path
          d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(
        2
      )} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z"
          fill="${fill}"
          stroke="rgba(230, 185, 121, 0.35)"
          stroke-width="1.4"
        />
      `;
    }

    pathsHtml += `
      <text
        x="${lx.toFixed(2)}"
        y="${ly.toFixed(2)}"
        fill="#F5EFE6"
        font-size="8.2"
        font-family="Plus Jakarta Sans, sans-serif"
        font-weight="500"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(${deg.toFixed(1)}, ${lx.toFixed(2)}, ${ly.toFixed(2)})"
      >
        ${escapeHtml(shortLabel)}
      </text>
    `;
  });

  // Outer Gold Rim + Star Studs
  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${
    r + 4
  }" fill="none" stroke="#E6B979" stroke-opacity="0.55" stroke-width="3" />
    ${pathsHtml}
  `;

  if (chipsContainer) {
    chipsContainer.innerHTML = ideas
      .map(
        (idea) => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-midnight/75 border border-amberGold/20 text-[11px] text-cream">
          <span>✨ ${escapeHtml(idea.title)}</span>
          ${
            ideas.length > 2
              ? `<button
                  type="button"
                  data-delete-date-id="${idea.id}"
                  class="text-cream/45 hover:text-red-300 ml-0.5 font-bold"
                  title="Remove date idea"
                >&times;</button>`
              : ""
          }
        </span>
      `
      )
      .join("");

    chipsContainer.querySelectorAll("[data-delete-date-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-date-id");
        await handleDeleteDateIdea(id);
      });
    });
  }
}

function spinDateWheel() {
  if (state.isWheelSpinning || state.dateIdeas.length === 0) return;
  state.isWheelSpinning = true;

  const rotor = document.getElementById("date-wheel-rotor");
  const resultTitle = document.getElementById("wheel-result-title");
  if (!rotor) return;

  const count = state.dateIdeas.length;
  const winningIndex = Math.floor(Math.random() * count);
  const sliceDeg = 360 / count;
  // Pointer is at the top (0 deg). Align winning slice center to top:
  const targetSliceCenterDeg = winningIndex * sliceDeg + sliceDeg / 2;
  const extraSpins = 5 * 360;
  const currentMod = state.wheelRotation % 360;
  const nextRotation =
    state.wheelRotation +
    extraSpins +
    (360 - targetSliceCenterDeg - currentMod + 360) % 360;

  state.wheelRotation = nextRotation;
  rotor.style.transform = `rotate(${nextRotation}deg)`;

  if (resultTitle) {
    resultTitle.textContent = "Spinning under the night sky...";
  }

  setTimeout(() => {
    state.isWheelSpinning = false;
    const winner = state.dateIdeas[winningIndex];
    if (resultTitle && winner) {
      resultTitle.textContent = `✨ ${winner.title}`;
    }
    if (winner) {
      showToast(`Tonight's date pick: "${winner.title}"`, "🕯️");
    }
  }, 4250);
}

async function handleAddDateIdea(e) {
  e.preventDefault();
  const input = document.getElementById("new-date-idea-input");
  const title = (input?.value || "").trim();
  if (!title) return;

  const me = getMyProfile();
  const newIdea = {
    id: crypto.randomUUID ? crypto.randomUUID() : `date-${Date.now()}`,
    title,
    vibe: "Night Date",
    added_by: me.key,
    created_at: new Date().toISOString()
  };

  state.dateIdeas.push(newIdea);
  if (input) input.value = "";

  if (state.authMode === "supabase" && supabaseClient) {
    const { data } = await supabaseClient
      .from("date_ideas")
      .insert({
        title: newIdea.title,
        vibe: newIdea.vibe,
        added_by: newIdea.added_by
      })
      .select()
      .maybeSingle();
    if (data) {
      state.dateIdeas[state.dateIdeas.length - 1] = data;
    }
  } else {
    const store = getLocalStore();
    store.date_ideas = state.dateIdeas;
    saveLocalStore(store, { table: "date_ideas" });
  }

  renderDateWheel();
  showToast(`Added "${title}" to the Date Wheel!`, "✨");
}

async function handleDeleteDateIdea(id) {
  state.dateIdeas = state.dateIdeas.filter((i) => String(i.id) !== String(id));
  if (state.authMode === "supabase" && supabaseClient) {
    await supabaseClient.from("date_ideas").delete().eq("id", id);
  } else {
    const store = getLocalStore();
    store.date_ideas = state.dateIdeas;
    saveLocalStore(store, { table: "date_ideas" });
  }
  renderDateWheel();
}

// ============================================================================
// BUCKET LIST ("THINGS WE HAVEN'T DONE YET")
// ============================================================================
function renderBucketList() {
  const container = document.getElementById("bucket-list-container");
  const badge = document.getElementById("bucket-progress-badge");
  if (!container) return;

  const completedCount = state.bucketList.filter((b) => b.is_completed).length;
  if (badge) {
    badge.textContent = `${completedCount} / ${state.bucketList.length} completed`;
  }

  container.innerHTML = state.bucketList
    .map(
      (item) => `
      <div class="rounded-2xl bg-midnight/65 border ${
        item.is_completed
          ? "border-amberGold/35 bg-amberGold/10"
          : "border-amberGold/15"
      } px-3.5 py-3 flex items-center justify-between gap-3 transition">
        <label class="flex items-start gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            data-toggle-bucket-id="${item.id}"
            ${item.is_completed ? "checked" : ""}
            class="mt-0.5 w-4 h-4 rounded accent-amberGold cursor-pointer"
          />
          <div class="text-xs">
            <p class="${
              item.is_completed
                ? "line-through text-cream/50"
                : "text-parchment font-medium"
            } leading-snug">
              ${escapeHtml(item.title)}
            </p>
            <span class="inline-block text-[10px] text-amberGold/80 mt-0.5">
              ${escapeHtml(item.category || "Reunion")} &bull; Added by ${
        item.added_by === "peyton" ? "Peyton" : "Dyko"
      }
            </span>
          </div>
        </label>
        <button
          type="button"
          data-delete-bucket-id="${item.id}"
          class="text-cream/40 hover:text-red-300 text-sm px-1.5"
          title="Remove item"
        >
          &times;
        </button>
      </div>
    `
    )
    .join("");

  container.querySelectorAll("[data-toggle-bucket-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const id = checkbox.getAttribute("data-toggle-bucket-id");
      await handleToggleBucketItem(id, checkbox.checked);
    });
  });

  container.querySelectorAll("[data-delete-bucket-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-bucket-id");
      await handleDeleteBucketItem(id);
    });
  });
}

async function handleAddBucketItem(e) {
  e.preventDefault();
  const titleInput = document.getElementById("new-bucket-title");
  const catSelect = document.getElementById("new-bucket-category");
  const title = (titleInput?.value || "").trim();
  const category = catSelect?.value || "Reunion";
  if (!title) return;

  const me = getMyProfile();
  const newItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : `bucket-${Date.now()}`,
    title,
    category,
    added_by: me.key,
    is_completed: false,
    created_at: new Date().toISOString()
  };

  state.bucketList.push(newItem);
  if (titleInput) titleInput.value = "";

  if (state.authMode === "supabase" && supabaseClient) {
    const { data } = await supabaseClient
      .from("bucket_list")
      .insert({
        title: newItem.title,
        category: newItem.category,
        added_by: newItem.added_by,
        is_completed: false
      })
      .select()
      .maybeSingle();
    if (data) {
      state.bucketList[state.bucketList.length - 1] = data;
    }
  } else {
    const store = getLocalStore();
    store.bucket_list = state.bucketList;
    saveLocalStore(store, { table: "bucket_list" });
  }

  renderBucketList();
  showToast("Added to Things We Haven't Done Yet!", "🌙");
}

async function handleToggleBucketItem(id, isCompleted) {
  const item = state.bucketList.find((b) => String(b.id) === String(id));
  if (!item) return;
  item.is_completed = isCompleted;
  item.completed_at = isCompleted ? new Date().toISOString() : null;

  if (state.authMode === "supabase" && supabaseClient) {
    await supabaseClient
      .from("bucket_list")
      .update({
        is_completed: item.is_completed,
        completed_at: item.completed_at
      })
      .eq("id", id);
  } else {
    const store = getLocalStore();
    store.bucket_list = state.bucketList;
    saveLocalStore(store, { table: "bucket_list" });
  }

  renderBucketList();
}

async function handleDeleteBucketItem(id) {
  state.bucketList = state.bucketList.filter((b) => String(b.id) !== String(id));
  if (state.authMode === "supabase" && supabaseClient) {
    await supabaseClient.from("bucket_list").delete().eq("id", id);
  } else {
    const store = getLocalStore();
    store.bucket_list = state.bucketList;
    saveLocalStore(store, { table: "bucket_list" });
  }
  renderBucketList();
}

// ============================================================================
// NAVIGATION TABS & MODALS
// ============================================================================
export function switchTab(tabName) {
  const validTabs = ["presence", "daily", "letters", "plans"];
  const target = validTabs.includes(tabName) ? tabName : "presence";
  state.activeTab = target;

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${target}`);
  });

  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-tab-target") === target
    );
  });
}

async function refreshPushStatusUI() {
  const statusText = document.getElementById("push-status-text");
  const statusDot = document.getElementById("push-status-dot");
  const status = await getPushSubscriptionStatus();

  if (statusText) {
    statusText.textContent = status.message;
  }
  if (statusDot) {
    statusDot.className = `w-2.5 h-2.5 rounded-full ${
      status.subscribed || status.permission === "granted"
        ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
        : "bg-amberGold/60"
    }`;
  }
}

// ============================================================================
// AUTHENTICATION FLOW (SUPABASE AUTH + PREVIEW SANCTUARY ENTRY)
// ============================================================================
async function enterSanctuary({ mode, partnerKey, userId = null }) {
  state.authMode = mode;
  state.currentPartnerKey = partnerKey;
  state.userId = userId;

  document.getElementById("auth-screen")?.classList.add("hidden");
  document.getElementById("app-shell")?.classList.remove("hidden");
  document.getElementById("bottom-nav")?.classList.remove("hidden");

  await loadAllSanctuaryData();

  // Check URL query parameter for deep-linked tab (from Web Push notification click)
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  if (tabParam) {
    switchTab(tabParam);
  }
}

function showLoginScreen() {
  document.getElementById("auth-screen")?.classList.remove("hidden");
  document.getElementById("app-shell")?.classList.add("hidden");
  document.getElementById("bottom-nav")?.classList.add("hidden");
}

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================
async function initApp() {
  // 1. Start Live Calgary & La Fortuna Clocks and fetch Open-Meteo Weather
  startTwoWorldsClocks();
  refreshTwoWorldsWeather();
  setInterval(refreshTwoWorldsWeather, 15 * 60 * 1000);
  setInterval(updateCountdownDigits, 1000);

  // 2. Register Service Worker for Offline Caching & Web Push
  await registerServiceWorker();

  // Listen for Service Worker messages (e.g. Push Received or Notification Click)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NAVIGATE_TAB" && event.data.tab) {
        switchTab(event.data.tab);
      } else if (event.data?.type === "PUSH_RECEIVED") {
        triggerConstellationGlow(
          `✨ ${event.data.payload?.body || "New moment received"}`
        );
        loadAllSanctuaryData();
      }
    });
  }

  // 3. Subscribe to Realtime Updates (Supabase Realtime + BroadcastChannel)
  subscribeToRealtimeUpdates((event) => {
    if (event.table === "pulses" || event.pulse) {
      const incoming = event.payload?.new || event.pulse;
      if (incoming && incoming.sender_key !== state.currentPartnerKey) {
        triggerConstellationGlow(
          `✨ ${incoming.sender_name} sent "${incoming.message}"`,
          incoming.sender_key === "peyton" ? "from-calgary" : "from-lafortuna"
        );
        showToast(
          `${incoming.sender_name} sent a pulse: "${incoming.message}"`,
          "✨"
        );
      }
    }
    loadAllSanctuaryData();
  });

  // 4. Bind Bottom Navigation Tabs
  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab-target"));
    });
  });

  // 5. Bind Modal Close Buttons
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      document.getElementById(modalId)?.classList.add("hidden");
    });
  });

  // 6. Bind Presence Status Editor
  document
    .getElementById("edit-my-status-btn")
    ?.addEventListener("click", openStatusModal);

  document
    .getElementById("status-battery-input")
    ?.addEventListener("input", (e) => {
      const valEl = document.getElementById("status-battery-value");
      if (valEl) valEl.textContent = `${e.target.value}%`;
    });

  document
    .getElementById("status-note-input")
    ?.addEventListener("input", (e) => {
      const countEl = document.getElementById("status-note-count");
      if (countEl) countEl.textContent = `${e.target.value.length} / 100`;
    });

  document
    .getElementById("status-form")
    ?.addEventListener("submit", handleSaveStatus);

  // 7. Bind 2x2 Silent Pulses Grid
  document
    .querySelectorAll("#silent-pulses-grid [data-pulse-type]")
    .forEach((btn) => {
      btn.addEventListener("click", (ev) => handleSendSilentPulse(btn, ev));
    });

  // 8. Bind Daily Question Controls
  document.getElementById("prev-question-btn")?.addEventListener("click", () => {
    if (state.selectedQuestionDay > 1) {
      state.selectedQuestionDay -= 1;
      renderDailyQuestionTab();
    }
  });

  document.getElementById("next-question-btn")?.addEventListener("click", () => {
    if (state.selectedQuestionDay < state.dailyQuestions.length) {
      state.selectedQuestionDay += 1;
      renderDailyQuestionTab();
    }
  });

  document
    .getElementById("open-past-questions-btn")
    ?.addEventListener("click", () => {
      renderPastQuestionsModal();
      document
        .getElementById("past-questions-modal")
        ?.classList.remove("hidden");
    });

  // 9. Bind Time-Capsule Letters Controls
  document
    .getElementById("open-letter-composer-btn")
    ?.addEventListener("click", () => {
      const partner = getPartnerProfile();
      const sub = document.getElementById("letter-recipient-subtitle");
      if (sub) {
        sub.textContent = `To ${partner.name} in ${partner.city}`;
      }
      document
        .getElementById("letter-composer-modal")
        ?.classList.remove("hidden");
    });

  document.querySelectorAll(".unlock-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-unlock-type");
      document.getElementById("letter-unlock-type").value = type;

      document.querySelectorAll(".unlock-type-btn").forEach((b) => {
        const active = b.getAttribute("data-unlock-type") === type;
        b.className = active
          ? "unlock-type-btn active rounded-xl bg-amberGold/20 border border-amberGold/50 px-3 py-2.5 text-xs text-softGold font-medium text-left"
          : "unlock-type-btn rounded-xl bg-midnight/75 border border-amberGold/20 px-3 py-2.5 text-xs text-cream text-left";
      });

      document
        .getElementById("letter-moment-field")
        ?.classList.toggle("hidden", type !== "moment");
      document
        .getElementById("letter-date-field")
        ?.classList.toggle("hidden", type !== "date");
    });
  });

  document
    .getElementById("letter-composer-form")
    ?.addEventListener("submit", handleCreateLetter);

  document.querySelectorAll(".letter-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.letterFilter = btn.getAttribute("data-letter-filter") || "all";
      document.querySelectorAll(".letter-filter-btn").forEach((b) => {
        const active =
          b.getAttribute("data-letter-filter") === state.letterFilter;
        b.className = active
          ? "letter-filter-btn active px-3.5 py-1.5 rounded-full text-xs font-medium bg-amberGold/20 border border-amberGold/45 text-softGold transition"
          : "letter-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-midnight/60 border border-amberGold/20 text-cream/75 hover:text-parchment transition";
      });
      renderLettersTab();
    });
  });

  // 10. Bind Plans (Reunion, Savings, Date Wheel, Bucket List)
  document
    .getElementById("edit-reunion-btn")
    ?.addEventListener("click", openReunionModal);
  document
    .getElementById("edit-savings-btn")
    ?.addEventListener("click", openReunionModal);
  document
    .getElementById("reunion-form")
    ?.addEventListener("submit", handleSaveReunionPlan);

  document
    .getElementById("spin-wheel-btn")
    ?.addEventListener("click", spinDateWheel);
  document
    .getElementById("wheel-center-spin-btn")
    ?.addEventListener("click", spinDateWheel);
  document
    .getElementById("add-date-idea-form")
    ?.addEventListener("submit", handleAddDateIdea);

  document
    .getElementById("add-bucket-form")
    ?.addEventListener("submit", handleAddBucketItem);

  // 11. Bind Settings & Web Push Modal
  document
    .getElementById("open-settings-btn")
    ?.addEventListener("click", async () => {
      await refreshPushStatusUI();
      document.getElementById("settings-modal")?.classList.remove("hidden");
    });

  document
    .getElementById("enable-push-btn")
    ?.addEventListener("click", async () => {
      try {
        const result = await subscribeToWebPush(
          supabaseClient,
          state.currentPartnerKey,
          state.userId
        );
        await refreshPushStatusUI();
        showToast(result.message, "🔔");
      } catch (err) {
        showToast(err.message || "Could not enable Web Push", "⚠️");
      }
    });

  document
    .getElementById("test-push-btn")
    ?.addEventListener("click", async () => {
      const me = getMyProfile();
      const partner = getPartnerProfile();
      await sendPartnerPushNotification(supabaseClient, {
        recipientKey: partner.key,
        senderName: me.name,
        eventType: "test",
        title: `Night Sky Test Push ✨`,
        body: `From ${me.name} in ${me.city} to ${partner.name} in ${partner.city}!`,
        tab: "presence"
      });
      triggerConstellationGlow("✨ Test push signal sent across the stars");
      showToast("Test push notification triggered!", "✨");
    });

  // 12. Bind Perspective Switcher (Preview Mode)
  document.querySelectorAll(".switch-partner-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetKey = btn.getAttribute("data-switch-partner");
      if (!targetKey) return;
      setPreviewPartnerKey(targetKey);
      state.currentPartnerKey = targetKey;
      renderAllViews();
      document.getElementById("settings-modal")?.classList.add("hidden");
      const me = getMyProfile();
      showToast(`Switched perspective to ${me.name} (${me.city})`, me.emoji);
    });
  });

  document.getElementById("active-user-pill")?.addEventListener("click", () => {
    if (state.authMode === "preview") {
      const nextKey = state.currentPartnerKey === "dyko" ? "peyton" : "dyko";
      setPreviewPartnerKey(nextKey);
      state.currentPartnerKey = nextKey;
      renderAllViews();
      const me = getMyProfile();
      showToast(`Viewing as ${me.name} (${me.city})`, me.emoji);
    } else {
      document.getElementById("open-settings-btn")?.click();
    }
  });

  // 13. Bind Login Form & Sign Out
  document
    .getElementById("login-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (
        document.getElementById("login-email")?.value || ""
      ).trim();
      const password = document.getElementById("login-password")?.value || "";
      const errBox = document.getElementById("login-error");
      if (errBox) errBox.classList.add("hidden");

      if (supabaseClient && isSupabaseConfigured()) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          if (errBox) {
            errBox.textContent = error.message;
            errBox.classList.remove("hidden");
          }
          return;
        }
        const partnerKey = resolvePartnerKeyFromEmail(
          data.user?.email,
          data.user?.user_metadata
        );
        await enterSanctuary({
          mode: "supabase",
          partnerKey,
          userId: data.user?.id
        });
      } else {
        // When config.js hasn't been populated with Supabase keys yet, infer partner from email
        const partnerKey = resolvePartnerKeyFromEmail(email);
        setPreviewPartnerKey(partnerKey);
        await enterSanctuary({ mode: "preview", partnerKey });
        showToast(
          `Signed in as ${APP_CONFIG.PARTNERS[partnerKey].name} (Local Sanctuary Mode)`,
          "🌙"
        );
      }
    });

  document.querySelectorAll(".preview-login-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const partnerKey = btn.getAttribute("data-preview-user") || "dyko";
      setPreviewPartnerKey(partnerKey);
      await enterSanctuary({ mode: "preview", partnerKey });
    });
  });

  document
    .getElementById("sign-out-btn")
    ?.addEventListener("click", async () => {
      if (state.authMode === "supabase" && supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      setPreviewPartnerKey(null);
      document.getElementById("settings-modal")?.classList.add("hidden");
      showLoginScreen();
    });

  // 14. Check Existing Session on Boot
  if (supabaseClient && isSupabaseConfigured()) {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();
    if (session?.user) {
      const partnerKey = resolvePartnerKeyFromEmail(
        session.user.email,
        session.user.user_metadata
      );
      await enterSanctuary({
        mode: "supabase",
        partnerKey,
        userId: session.user.id
      });
      return;
    }
  }

  const savedPreviewPartner = getPreviewPartnerKey();
  if (savedPreviewPartner === "dyko" || savedPreviewPartner === "peyton") {
    await enterSanctuary({
      mode: "preview",
      partnerKey: savedPreviewPartner
    });
  } else {
    showLoginScreen();
  }
}

document.addEventListener("DOMContentLoaded", initApp);
