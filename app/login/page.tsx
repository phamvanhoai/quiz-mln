"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageTitle } from "@/components/AppShell";
import { getConfiguredSupabaseClient } from "@/lib/auth";
import { useQuizStore } from "@/lib/store";

export default function LoginPage() {
  const store = useQuizStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    router.push("/");
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Tài khoản" description="Đăng nhập để tiến trình học, câu sai và đánh dấu sao được tách riêng theo từng người." />
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
    </AppShell>
  );
}
