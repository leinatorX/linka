import { db } from "../db.js";

export interface WeatherSettings {
  enabled: boolean;
  apiKey: string;
  location: string;
  showDate: boolean;
  dateFormat: string;
}

export interface PublicWeatherSettings {
  enabled: boolean;
  apiKeySet: boolean;
  location: string;
  showDate: boolean;
  dateFormat: string;
}

const SETTINGS_KEY = "weather";
const selectSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  enabled: false,
  apiKey: "",
  location: "",
  showDate: false,
  dateFormat: "full"
};

export function getWeatherSettings(): WeatherSettings {
  const row = selectSetting.get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    return DEFAULT_WEATHER_SETTINGS;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<WeatherSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      apiKey: String(parsed.apiKey ?? ""),
      location: String(parsed.location ?? ""),
      showDate: Boolean(parsed.showDate),
      dateFormat: String(parsed.dateFormat || "full")
    };
  } catch {
    return DEFAULT_WEATHER_SETTINGS;
  }
}

export function getPublicWeatherSettings(): PublicWeatherSettings {
  const settings = getWeatherSettings();
  return {
    enabled: settings.enabled,
    apiKeySet: Boolean(settings.apiKey),
    location: settings.location,
    showDate: settings.showDate,
    dateFormat: settings.dateFormat
  };
}

export function saveWeatherSettings(value: Partial<WeatherSettings>): PublicWeatherSettings {
  const current = getWeatherSettings();
  const next: WeatherSettings = {
    enabled: value.enabled ?? current.enabled,
    apiKey: value.apiKey !== undefined ? value.apiKey : current.apiKey,
    location: value.location ?? current.location,
    showDate: value.showDate ?? current.showDate,
    dateFormat: value.dateFormat ?? current.dateFormat
  };
  upsertSetting.run(SETTINGS_KEY, JSON.stringify(next), new Date().toISOString());
  return getPublicWeatherSettings();
}

export async function fetchCurrentWeather() {
  const settings = getWeatherSettings();
  if (!settings.enabled || !settings.apiKey || !settings.location) {
    throw new Error("Weather is not properly configured.");
  }
  
  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", settings.apiKey);
  url.searchParams.set("q", settings.location);
  url.searchParams.set("aqi", "no");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "Failed to fetch weather.");
  }
  return response.json();
}
