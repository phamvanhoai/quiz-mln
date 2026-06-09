"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { readSettings } from "@/lib/settings";
import { createClient } from "@/utils/supabase/client";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const settings = readSettings();
    const supabase = createClient({ url: settings.supabaseUrl, key: settings.supabasePublishableKey });
    if (!supabase) {
      setLoaded(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loaded };
}

export function getConfiguredSupabaseClient() {
  const settings = readSettings();
  return createClient({ url: settings.supabaseUrl, key: settings.supabasePublishableKey });
}
