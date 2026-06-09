"use client";

import { createBrowserClient } from "@supabase/ssr";

export function hasSupabaseConfig(config?: { url?: string; key?: string }) {
  return Boolean(
    (config?.url || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (config?.key || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function createClient(config?: { url?: string; key?: string }) {
  const url = config?.url || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = config?.key || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
