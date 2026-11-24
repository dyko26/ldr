// ============================================================================
// WEATHER & LIVE CLOCKS MODULE (js/weather.js)
// Uses Open-Meteo Free API (no API key required) for Calgary & La Fortuna
// ============================================================================

import { APP_CONFIG } from "./config.js";

/**
 * Maps WMO Weather interpretation codes from Open-Meteo to night-sky icons & labels
 */
function interpretWmoCode(code, isDay = 0) {
  const map = {
    0: { icon: isDay ? "☀️" : "🌙", label: isDay ? "Clear sky" : "Starlit sky" },
    1: { icon: isDay ? "🌤️" : "🌙", label: "Mostly clear" },
    2: { icon: "⛅", label: "Partly cloudy" },
    3: { icon: "☁️", label: "Overcast clouds" },
    45: { icon: "🌫️", label: "Misty air" },
    48: { icon: "🌫️", label: "Freezing fog" },
    51: { icon: "🌦️", label: "Light drizzle" },
    53: { icon: "🌦️", label: "Gentle drizzle" },
    55: { icon: "🌧️", label: "Dense drizzle" },
    61: { icon: "🌧️", label: "Soft rain" },
    63: { icon: "🌧️", label: "Steady rain" },
    65: { icon: "🌧️", label: "Heavy rain" },
    71: { icon: "❄️", label: "Light snow" },
    73: { icon: "❄️", label: "Snowfall" },
    75: { icon: "❄️", label: "Heavy snow" },
    77: { icon: "❄️", label: "Snow grains" },
    80: { icon: "🌦️", label: "Rain showers" },
    81: { icon: "🌧️", label: "Tropical shower" },
    82: { icon: "⛈️", label: "Heavy downpour" },
    85: { icon: "🌨️", label: "Snow showers" },
    86: { icon: "🌨️", label: "Heavy snow" },
    95: { icon: "⛈️", label: "Thunderstorm" },
    96: { icon: "⛈️", label: "Storm & hail" },
    99: { icon: "⛈️", label: "Thunderstorm" }
  };

  return map[code] || { icon: isDay ? "🌤️" : "🌙", label: "Calm sky" };
}

/**
 * Fetches live temperature & weather code from Open-Meteo for a single city
 */
async function fetchCityWeather({ lat, lon, timezone }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=${encodeURIComponent(
    timezone
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }
  const data = await res.json();
  const current = data.current || {};
  const temp =
    typeof current.temperature_2m === "number"
      ? Math.round(current.temperature_2m)
      : null;
  const info = interpretWmoCode(current.weather_code ?? 0, current.is_day ?? 0);

  return {
    temp,
    icon: info.icon,
    label: info.label
  };
}

/**
 * Updates both Calgary and La Fortuna weather displays in the "Two Worlds" header
 */
export async function refreshTwoWorldsWeather() {
  const calgary = APP_CONFIG.PARTNERS.peyton;
  const laFortuna = APP_CONFIG.PARTNERS.dyko;

  try {
    const [calgaryWeather, laFortunaWeather] = await Promise.all([
      fetchCityWeather(calgary),
      fetchCityWeather(laFortuna)
    ]);

    const calIconEl = document.getElementById("weather-calgary-icon");
    const calTempEl = document.getElementById("weather-calgary-temp");
    const calDescEl = document.getElementById("weather-calgary-desc");

    if (calIconEl) calIconEl.textContent = calgaryWeather.icon;
    if (calTempEl && calgaryWeather.temp !== null) {
      calTempEl.textContent = `${calgaryWeather.temp}°C`;
    }
    if (calDescEl) calDescEl.textContent = calgaryWeather.label;

    const lfIconEl = document.getElementById("weather-lafortuna-icon");
    const lfTempEl = document.getElementById("weather-lafortuna-temp");
    const lfDescEl = document.getElementById("weather-lafortuna-desc");

    if (lfIconEl) lfIconEl.textContent = laFortunaWeather.icon;
    if (lfTempEl && laFortunaWeather.temp !== null) {
      lfTempEl.textContent = `${laFortunaWeather.temp}°C`;
    }
    if (lfDescEl) lfDescEl.textContent = laFortunaWeather.label;
  } catch (err) {
    console.warn("[Weather] Using fallback night-sky weather values:", err);
  }
}

/**
 * Formats live local clock in the specified IANA timezone
 */
function formatCityTime(timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(new Date());
  } catch (_e) {
    return "--:--";
  }
}

/**
 * Starts the live clock ticker for Calgary (America/Edmonton) & La Fortuna (America/Costa_Rica)
 */
export function startTwoWorldsClocks() {
  const tick = () => {
    const calgaryEl = document.getElementById("clock-calgary");
    const laFortunaEl = document.getElementById("clock-lafortuna");

    if (calgaryEl) {
      calgaryEl.textContent = formatCityTime(
        APP_CONFIG.PARTNERS.peyton.timezone
      );
    }
    if (laFortunaEl) {
      laFortunaEl.textContent = formatCityTime(
        APP_CONFIG.PARTNERS.dyko.timezone
      );
    }
  };

  tick();
  setInterval(tick, 10000);
}
