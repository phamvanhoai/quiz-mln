"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageTitle } from "@/components/AppShell";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { useQuizStore } from "@/lib/store";

function getAdminEmails() {
  const fromSettings = readSettings().adminEmails;
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return `${fromSettings},${fromEnv}`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return "Không rõ";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function LoginPage() {
  const store = useQuizStore();
  const router = useRouter();
  const { user, loaded } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const adminEmails = useMemo(getAdminEmails, []);
  const isBootstrapAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));

  async function submit() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) {
      setMessage("Chưa cấu hình Supabase URL/publishable key.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(mode === "signup" ? "Đã tạo tài khoản. Nếu Supabase bật email confirmation, hãy xác nhận email trước." : "Đã đăng nhập.");
    router.refresh();
  }

  async function signOut() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    window.location.reload();
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Tài khoản" description="Đăng nhập để tiến trình học, câu sai và đánh dấu sao được tách riêng theo từng người." />
      {!loaded ? null : user ? (
        <section className="panel max-w-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Hồ sơ</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Bạn đang đăng nhập, nên tiến trình học sẽ được lưu theo tài khoản này.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
              Đang đăng nhập
            </span>
          </div>

          <div className="mt-5 grid gap-3 text-sm">
            <ProfileRow label="Email" value={user.email ?? "Không rõ email"} />
            <ProfileRow label="User ID" mono value={user.id} />
            <ProfileRow label="Email xác nhận" value={user.email_confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"} />
            <ProfileRow label="Ngày tạo" value={formatDate(user.created_at)} />
            <ProfileRow label="Quyền admin cấu hình" value={isBootstrapAdmin ? "Có" : "Không"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {isBootstrapAdmin ? (
              <Link className="btn-primary" href="/admin">
                Vào Admin
              </Link>
            ) : null}
            <Link className="btn-secondary" href="/sets">
              Quản lý bộ đề
            </Link>
            <button className="focus-ring rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 dark:border-red-800 dark:text-red-300" disabled={busy} onClick={signOut} type="button">
              Đăng xuất
            </button>
          </div>
        </section>
      ) : (
        <section className="panel max-w-md p-5">
          <div className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            <button className={mode === "login" ? "rounded-md bg-white px-3 py-2 font-medium shadow-sm dark:bg-zinc-800" : "px-3 py-2"} onClick={() => setMode("login")} type="button">
              Đăng nhập
            </button>
            <button className={mode === "signup" ? "rounded-md bg-white px-3 py-2 font-medium shadow-sm dark:bg-zinc-800" : "px-3 py-2"} onClick={() => setMode("signup")} type="button">
              Đăng ký
            </button>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            Mật khẩu
            <input className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          <button className="btn-primary mt-5 w-full" disabled={busy || !email || !password} onClick={submit} type="button">
            {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
          {message ? <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{message}</div> : null}
        </section>
      )}
    </AppShell>
  );
}

function ProfileRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-[160px_1fr]">
      <div className="text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={mono ? "break-all font-mono text-xs" : "break-all font-medium"}>{value}</div>
    </div>
  );
}
