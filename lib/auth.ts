"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { readSettings } from "@/lib/settings";
import { createClient } from "@/utils/supabase/client";

export function getBootstrapAdminEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

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

export function useAdminStatus() {
  const { user, loaded: userLoaded } = useAuthUser();
  const [checked, setChecked] = useState(false);
  const [isAdminFromTable, setIsAdminFromTable] = useState(false);
  const bootstrapAdminEmails = getBootstrapAdminEmails();
  const isBootstrapAdmin = Boolean(user?.email && bootstrapAdminEmails.includes(user.email.toLowerCase()));

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      setIsAdminFromTable(false);
      if (!userLoaded) return;
      if (!user) {
        setChecked(true);
        return;
      }
      const supabase = getConfiguredSupabaseClient();
      if (!supabase) {
        setChecked(true);
        return;
      }
      const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!cancelled) {
        setIsAdminFromTable(Boolean(data) && !error);
        setChecked(true);
      }
    }
    setChecked(false);
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user, userLoaded]);

  return {
    user,
    loaded: userLoaded && checked,
    isAdmin: isBootstrapAdmin || isAdminFromTable,
    isBootstrapAdmin,
    isAdminFromTable
  };
}
