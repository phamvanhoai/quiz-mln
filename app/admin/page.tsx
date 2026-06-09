"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, AdminTitle } from "@/components/AdminShell";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { useQuizStore } from "@/lib/store";

type AdminStats = {
  sets: number;
  questions: number;
  options: number;
  keywords: number;
  progressRows: number;
  emptySets: Array<{ id: string; title: string }>;
  adminUsers: Array<{ user_id: string; email: string; created_at: string }>;
};

function getAdminEmails() {
  const fromSettings = readSettings().adminEmails;
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return `${fromSettings},${fromEnv}`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminPage() {
  const store = useQuizStore();
  const { user, loaded } = useAuthUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [message, setMessage] = useState("");
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdminFromTable, setIsAdminFromTable] = useState(false);
  const [busy, setBusy] = useState(false);
  const adminEmails = useMemo(getAdminEmails, []);
  const isBootstrapAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));
  const isAdmin = isAdminFromTable || isBootstrapAdmin;

  async function checkAdmin() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !user) {
      setAdminChecked(true);
      return;
    }
    const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    setIsAdminFromTable(Boolean(data) && !error);
    setAdminChecked(true);
  }

  async function loadStats() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) {
      setMessage("Chưa cấu hình Supabase.");
      return;
    }
    setBusy(true);
    setMessage("");
    const [sets, questions, options, keywords, progress, emptySets, adminUsers] = await Promise.all([
      supabase.from("quiz_sets").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("options").select("id", { count: "exact", head: true }),
      supabase.from("keywords").select("id", { count: "exact", head: true }),
      supabase.from("user_question_progress").select("question_id", { count: "exact", head: true }),
      supabase.from("quiz_sets").select("id,title,quiz_set_questions(question_id)").limit(100),
      supabase.from("admin_users").select("user_id,email,created_at").order("created_at", { ascending: false })
    ]);
    setBusy(false);
    const firstError = sets.error || questions.error || options.error || keywords.error || progress.error || emptySets.error || adminUsers.error;
    if (firstError) {
      setMessage(firstError.message);
      return;
    }
    setStats({
      sets: sets.count ?? 0,
      questions: questions.count ?? 0,
      options: options.count ?? 0,
      keywords: keywords.count ?? 0,
      progressRows: progress.count ?? 0,
      adminUsers: (adminUsers.data ?? []) as Array<{ user_id: string; email: string; created_at: string }>,
      emptySets: ((emptySets.data ?? []) as Array<{ id: string; title: string; quiz_set_questions: unknown[] }>).filter(
        (set) => !set.quiz_set_questions?.length
      )
    });
  }

  async function deleteEmptySets() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !stats?.emptySets.length) return;
    setBusy(true);
    const { error } = await supabase.from("quiz_sets").delete().in("id", stats.emptySets.map((set) => set.id));
    setBusy(false);
    setMessage(error ? error.message : `Đã xóa ${stats.emptySets.length} bộ đề rỗng.`);
    await loadStats();
  }

  async function resetAllProgress() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    if (!window.confirm("Xóa toàn bộ tiến trình học của tất cả user?")) return;
    setBusy(true);
    const { error } = await supabase.from("user_question_progress").delete().neq("question_id", "__never__");
    setBusy(false);
    setMessage(error ? error.message : "Đã reset toàn bộ tiến trình học.");
    await loadStats();
  }

  async function addCurrentUserAsAdmin() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !user?.email) return;
    setBusy(true);
    const { error } = await supabase.from("admin_users").upsert({ user_id: user.id, email: user.email.toLowerCase() }, { onConflict: "user_id" });
    setBusy(false);
    setMessage(error ? error.message : "Đã thêm user hiện tại vào bảng admin_users.");
    await checkAdmin();
    await loadStats();
  }

  useEffect(() => {
    if (loaded && user) checkAdmin();
    if (loaded && !user) setAdminChecked(true);
  }, [loaded, user]);

  useEffect(() => {
    if (adminChecked && isAdmin) loadStats();
  }, [adminChecked, isAdmin]);

  return (
    <AdminShell dark={store.dark} onToggleDark={store.toggleDark}>
      <AdminTitle title="Admin" description="Quản lý nhanh dữ liệu Supabase: thống kê, bộ đề rỗng và tiến trình học." />
      {!loaded || !adminChecked ? null : !user ? (
        <div className="admin-panel p-5">
          Cần <Link className="text-blue-600" href="/login">đăng nhập</Link> để vào admin.
        </div>
      ) : !isAdmin ? (
        <div className="admin-panel p-5">
          Email `{user.email}` chưa có quyền admin. Thêm email này vào trang Cấu hình hoặc `NEXT_PUBLIC_ADMIN_EMAILS`.
        </div>
      ) : (
        <div className="grid gap-5">
          {isBootstrapAdmin && !isAdminFromTable ? (
            <section className="rounded-xl border border-amber-700 bg-amber-950 p-5 text-sm text-amber-100">
              Email của bạn đang được cho phép bằng cấu hình bootstrap, nhưng chưa có trong bảng `admin_users`.
              <button className="ml-3 rounded-lg bg-amber-900 px-3 py-2 font-medium text-white" disabled={busy} onClick={addCurrentUserAsAdmin} type="button">
                Thêm tôi vào admin_users
              </button>
            </section>
          ) : null}
          <section className="grid gap-4 sm:grid-cols-5">
            <Stat label="Bộ đề" value={stats?.sets ?? 0} />
            <Stat label="Câu hỏi" value={stats?.questions ?? 0} />
            <Stat label="Đáp án" value={stats?.options ?? 0} />
            <Stat label="Keyword" value={stats?.keywords ?? 0} />
            <Stat label="Progress" value={stats?.progressRows ?? 0} />
          </section>
          <section className="admin-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Thao tác quản trị</h2>
                <p className="mt-1 text-sm text-zinc-500">Các thao tác này ghi trực tiếp vào Supabase.</p>
              </div>
              <button className="btn-secondary" disabled={busy} onClick={loadStats} type="button">
                Làm mới
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-secondary" disabled={busy || !stats?.emptySets.length} onClick={deleteEmptySets} type="button">
                Xóa bộ đề rỗng ({stats?.emptySets.length ?? 0})
              </button>
              <button className="focus-ring rounded-lg border border-red-300 bg-white px-4 py-2 font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950" disabled={busy} onClick={resetAllProgress} type="button">
                Reset toàn bộ progress
              </button>
            </div>
            {message ? <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{message}</div> : null}
          </section>
          <section className="admin-panel p-5">
            <h2 className="font-semibold">Admin users</h2>
            <div className="mt-3 grid gap-2">
              {stats?.adminUsers.length ? (
                stats.adminUsers.map((admin) => (
                  <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800" key={admin.user_id}>
                    <div className="font-medium">{admin.email}</div>
                    <div className="font-mono text-xs text-zinc-500">{admin.user_id}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">Chưa có admin user trong bảng.</div>
              )}
            </div>
          </section>
          <section className="admin-panel p-5">
            <h2 className="font-semibold">Bộ đề rỗng</h2>
            <div className="mt-3 grid gap-2">
              {stats?.emptySets.length ? (
                stats.emptySets.map((set) => (
                  <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800" key={set.id}>
                    <div className="font-medium">{set.title}</div>
                    <div className="font-mono text-xs text-zinc-500">{set.id}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">Không có bộ đề rỗng.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-panel p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
