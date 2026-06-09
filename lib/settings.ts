"use client";

import { useEffect, useState } from "react";

export type AppSettings = {
  googleAiApiKey: string;
  googleAiModel: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export const settingsKey = "quiz-mln.settings";

export const defaultSettings: AppSettings = {
  googleAiApiKey: "",
  googleAiModel: "gemini-2.5-flash",
  supabaseUrl: "",
  supabasePublishableKey: ""
};

export function readSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(settingsKey);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function writeSettings(settings: AppSettings) {
  window.localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function useAppSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setLoaded(true);
  }, []);

  function save(next: AppSettings) {
    setSettings(next);
    writeSettings(next);
  }

  return { loaded, settings, save };
}
