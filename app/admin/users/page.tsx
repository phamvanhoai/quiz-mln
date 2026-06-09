"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, AdminTitle } from "@/components/AdminShell";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { useQuizStore } from "@/lib/store";

type UserRow = {
  user_id: string;
  email?: string;
  progressCount: number;
  learnedCount: number;
  wrongCount: number;
  starredCount: number;
  isAdmin: boolean;
};

function getAdminEmails() {
  const fromSettings = readSettings().adminEmails;
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return `${fromSettings},${fromEnv}`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminUsersPage() {
  const store = useQuizStore();
  const { user, loaded } = useAuthUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdminFromTable, setIsAdminFromTable] = useState(false);
  const adminEmails = useMemo(getAdminEmails, []);
  const isBootstrapAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));
  const isAdmin = isAdminFromTable || isBootstrapAdmin;

  async function checkAdmin() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !user) {
      setAdminChecked(true);
      return;
    }
    const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    setIsAdminFromTable(Boolean(data));
    setAdminChecked(true);
  }

  async function loadUsers() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) {
      setMessage("Chưa cấu hình Supabase.");
      return;
    }
    setBusy(true);
    setMessage("");
    const [progressResult, adminResult] = await Promise.all([
      supabase.from("user_question_progress").select("user_id, learned, starred, wrong_count"),
      supabase.from("admin_users").select("user_id,email,created_at")
    ]);
    setBusy(false);

    const firstError = progressResult.error || adminResult.error;
    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const map = new Map<string, UserRow>();
    for (const admin of (adminResult.data ?? []) as Array<{ user_id: string; email: string }>) {
      map.set(admin.user_id, {
        user_id: admin.user_id,
        email: admin.email,
        progressCount: 0,
        learnedCount: 0,
        wrongCount: 0,
        starredCount: 0,
        isAdmin: true
      });
    }
    for (const row of (progressResult.data ?? []) as Array<{ user_id: string; learned: boolean; starred: boolean; wrong_count: number }>) {
      const item =
        map.get(row.user_id) ??
        {
          user_id: row.user_id,
          progressCount: 0,
          learnedCount: 0,
          wrongCount: 0,
          starredCount: 0,
          isAdmin: false
        };
      item.progressCount += 1;
      item.learnedCount += row.learned ? 1 : 0;
      item.wrongCount += row.wrong_count > 0 ? 1 : 0;
      item.starredCount += row.starred ? 1 : 0;
      map.set(row.user_id, item);
    }

    setUsers(Array.from(map.values()).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || b.progressCount - a.progressCount));
  }

  async function addAdmin() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !newAdminUserId || !newAdminEmail) return;
    setBusy(true);
    const { error } = await supabase
      .from("admin_users")
      .upsert({ user_id: newAdminUserId, email: newAdminEmail.toLowerCase() }, { onConflict: "user_id" });
    setBusy(false);
    setMessage(error ? error.message : "Đã thêm admin.");
    setNewAdminUserId("");
    setNewAdminEmail("");
    await loadUsers();
  }

  async function removeAdmin(userId: string) {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("admin_users").delete().eq("user_id", userId);
    setBusy(false);
    setMessage(error ? error.message : "Đã xóa quyền admin.");
    await loadUsers();
  }

  async function resetUserProgress(userId: string) {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    if (!window.confirm("Xóa toàn bộ progress của user này?")) return;
    setBusy(true);
    const { error } = await supabase.from("user_question_progress").delete().eq("user_id", userId);
    setBusy(false);
    setMessage(error ? error.message : "Đã xóa progress user.");
    await loadUsers();
  }

  useEffect(() => {
    if (loaded && user) checkAdmin();
    if (loaded && !user) setAdminChecked(true);
  }, [loaded, user]);

  useEffect(() => {
    if (adminChecked && isAdmin) loadUsers();
  }, [adminChecked, isAdmin]);

  return (
    <AdminShell dark={store.dark} onToggleDark={store.toggleDark}>
      <AdminTitle title="Quản lý user" description="Quản lý admin users và tiến trình học theo user." />
      {!loaded || !adminChecked ? null : !user ? (
        <div className="admin-panel p-5">
          Cần <Link className="text-blue-400" href="/login">đăng nhập</Link> để vào admin.
        </div>
      ) : !isAdmin ? (
        <div className="admin-panel p-5">Bạn chưa có quyền admin.</div>
      ) : (
        <div className="grid gap-5">
          <section className="admin-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Thêm admin</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Cần biết `user_id` của user. User phải đã tồn tại trong Supabase Auth.</p>
              </div>
              <button className="btn-secondary" disabled={busy} onClick={loadUsers} type="button">
                Làm mới
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" onChange={(event) => setNewAdminUserId(event.target.value)} placeholder="user_id" value={newAdminUserId} />
              <input className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" onChange={(event) => setNewAdminEmail(event.target.value)} placeholder="email" value={newAdminEmail} />
              <button className="btn-primary" disabled={busy || !newAdminUserId || !newAdminEmail} onClick={addAdmin} type="button">
                Thêm
              </button>
            </div>
            {message ? <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{message}</div> : null}
          </section>
          <section className="admin-panel p-5">
            <h2 className="font-semibold">Users có dữ liệu</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2">User</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Progress</th>
                    <th className="py-2">Đã học</th>
                    <th className="py-2">Câu sai</th>
                    <th className="py-2">Sao</th>
                    <th className="py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr className="border-t border-zinc-200 dark:border-zinc-800" key={item.user_id}>
                      <td className="py-3">
                        <div className="font-medium">{item.email ?? "Không rõ email"}</div>
                        <div className="font-mono text-xs text-zinc-500">{item.user_id}</div>
                      </td>
                      <td className="py-3">{item.isAdmin ? "Admin" : "User"}</td>
                      <td className="py-3">{item.progressCount}</td>
                      <td className="py-3">{item.learnedCount}</td>
                      <td className="py-3">{item.wrongCount}</td>
                      <td className="py-3">{item.starredCount}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" disabled={busy} onClick={() => resetUserProgress(item.user_id)} type="button">
                            Reset progress
                          </button>
                          {item.isAdmin ? (
                            <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:text-red-300" disabled={busy || item.user_id === user.id} onClick={() => removeAdmin(item.user_id)} type="button">
                              Gỡ admin
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length ? <div className="py-6 text-sm text-zinc-500">Chưa có user nào có progress/admin.</div> : null}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
