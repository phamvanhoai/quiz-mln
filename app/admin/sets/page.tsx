"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, AdminTitle } from "@/components/AdminShell";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { useQuizStore } from "@/lib/store";

type QuizSetAdminRow = {
  id: string;
  title: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  quiz_set_questions?: Array<{ question_id: string }>;
};

type QuizSetItem = {
  id: string;
  title: string;
  createdBy: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
};

function getAdminEmails() {
  const fromSettings = readSettings().adminEmails;
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return `${fromSettings},${fromEnv}`
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AdminSetsPage() {
  const store = useQuizStore();
  const { user, loaded } = useAuthUser();
  const [items, setItems] = useState<QuizSetItem[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdminFromTable, setIsAdminFromTable] = useState(false);
  const adminEmails = useMemo(getAdminEmails, []);
  const isBootstrapAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));
  const isAdmin = isAdminFromTable || isBootstrapAdmin;

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.title, item.createdByEmail ?? "", item.createdBy ?? "", item.id].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [items, query]);

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

  async function loadSets() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) {
      setMessage("Chưa cấu hình Supabase.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("quiz_sets")
      .select("id,title,created_by,created_by_email,created_at,updated_at,quiz_set_questions(question_id)")
      .order("updated_at", { ascending: false });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems(
      ((data ?? []) as QuizSetAdminRow[]).map((item) => ({
        id: item.id,
        title: item.title,
        createdBy: item.created_by,
        createdByEmail: item.created_by_email,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        questionCount: item.quiz_set_questions?.length ?? 0
      }))
    );
  }

  function startEditTitle(item: QuizSetItem) {
    setEditingTitleId(item.id);
    setEditingTitle(item.title);
    setEditingOwnerId(null);
  }

  function startEditOwner(item: QuizSetItem) {
    setEditingOwnerId(item.id);
    setOwnerUserId(item.createdBy ?? "");
    setOwnerEmail(item.createdByEmail ?? "");
    setEditingTitleId(null);
  }

  function clearEditing() {
    setEditingTitleId(null);
    setEditingTitle("");
    setEditingOwnerId(null);
    setOwnerUserId("");
    setOwnerEmail("");
  }

  async function renameSet(setId: string) {
    const supabase = getConfiguredSupabaseClient();
    const title = editingTitle.trim();
    if (!supabase || !title) return;
    setBusy(true);
    const { error } = await supabase.from("quiz_sets").update({ title, updated_at: new Date().toISOString() }).eq("id", setId);
    setBusy(false);
    setMessage(error ? error.message : "Đã đổi tên bộ đề.");
    if (!error) {
      clearEditing();
      await loadSets();
    }
  }

  async function saveOwner(setId: string) {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    const nextUserId = ownerUserId.trim();
    const nextEmail = ownerEmail.trim().toLowerCase();
    setBusy(true);
    const { error } = await supabase
      .from("quiz_sets")
      .update({
        created_by: nextUserId || null,
        created_by_email: nextEmail || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", setId);
    setBusy(false);
    setMessage(error ? error.message : "Đã cập nhật người tạo bộ đề.");
    if (!error) {
      clearEditing();
      await loadSets();
    }
  }

  async function deleteSet(item: QuizSetItem) {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    if (!window.confirm(`Xóa bộ đề "${item.title}" và toàn bộ ${item.questionCount} câu hỏi liên quan?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_quiz_set_with_questions", { target_set_id: item.id });
    setBusy(false);
    setMessage(error ? error.message : "Đã xóa bộ đề và dữ liệu liên quan.");
    await loadSets();
  }

  async function addCurrentUserAsAdmin() {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !user?.email) return;
    setBusy(true);
    const { error } = await supabase.from("admin_users").upsert({ user_id: user.id, email: user.email.toLowerCase() }, { onConflict: "user_id" });
    setBusy(false);
    setMessage(error ? error.message : "Đã thêm user hiện tại vào bảng admin_users.");
    if (!error) {
      setIsAdminFromTable(true);
      await loadSets();
    }
  }

  useEffect(() => {
    if (loaded && user) checkAdmin();
    if (loaded && !user) setAdminChecked(true);
  }, [loaded, user]);

  useEffect(() => {
    if (adminChecked && isAdmin) loadSets();
  }, [adminChecked, isAdmin]);

  return (
    <AdminShell dark={store.dark} onToggleDark={store.toggleDark}>
      <AdminTitle title="Quản lý đề" description="Admin có thể xem, đổi tên, sửa người tạo và xóa sạch bộ đề cùng dữ liệu liên quan." />
      {!loaded || !adminChecked ? null : !user ? (
        <div className="admin-panel p-5">
          Cần <Link className="text-blue-600 dark:text-blue-400" href="/login">đăng nhập</Link> để vào admin.
        </div>
      ) : !isAdmin ? (
        <div className="admin-panel p-5">Bạn chưa có quyền admin.</div>
      ) : (
        <div className="grid gap-5">
          {isBootstrapAdmin && !isAdminFromTable ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Email của bạn đang có quyền admin từ cấu hình, nhưng chưa có trong bảng `admin_users`. Hãy thêm vào bảng để RLS cho phép sửa và xóa đề.
              <button className="ml-3 rounded-lg bg-amber-900 px-3 py-2 font-medium text-white disabled:opacity-60" disabled={busy} onClick={addCurrentUserAsAdmin} type="button">
                Thêm tôi vào admin_users
              </button>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Tổng bộ đề" value={items.length} />
            <Stat label="Tổng câu hỏi" value={items.reduce((sum, item) => sum + item.questionCount, 0)} />
            <Stat label="Đang hiển thị" value={filteredItems.length} />
          </section>

          <section className="admin-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Danh sách bộ đề</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Để chuyển quyền sửa đề cho user khác, cập nhật đúng `user_id` Supabase Auth và email của người đó.</p>
              </div>
              <button className="btn-secondary" disabled={busy} onClick={loadSets} type="button">
                Làm mới
              </button>
            </div>
            <input
              className="focus-ring mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên đề, email người tạo hoặc ID"
              value={query}
            />
            {message ? <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{message}</div> : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2">Bộ đề</th>
                    <th className="py-2">Người tạo</th>
                    <th className="py-2">Số câu</th>
                    <th className="py-2">Cập nhật</th>
                    <th className="py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr className="border-t border-zinc-200 align-top dark:border-zinc-800" key={item.id}>
                      <td className="py-3 pr-4">
                        {editingTitleId === item.id ? (
                          <input
                            className="focus-ring w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            onChange={(event) => setEditingTitle(event.target.value)}
                            value={editingTitle}
                          />
                        ) : (
                          <>
                            <div className="font-medium">{item.title}</div>
                            <div className="font-mono text-xs text-zinc-500">{item.id}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editingOwnerId === item.id ? (
                          <div className="grid min-w-80 gap-2">
                            <input
                              className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                              onChange={(event) => setOwnerUserId(event.target.value)}
                              placeholder="Supabase user_id"
                              value={ownerUserId}
                            />
                            <input
                              className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                              onChange={(event) => setOwnerEmail(event.target.value)}
                              placeholder="Email người tạo"
                              value={ownerEmail}
                            />
                          </div>
                        ) : (
                          <>
                            <div>{item.createdByEmail ?? "Chưa có người tạo"}</div>
                            {item.createdBy ? <div className="font-mono text-xs text-zinc-500">{item.createdBy}</div> : null}
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-4">{item.questionCount}</td>
                      <td className="py-3 pr-4">{formatDate(item.updatedAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {editingTitleId === item.id ? (
                            <>
                              <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy || !editingTitle.trim()} onClick={() => renameSet(item.id)} type="button">
                                Lưu tên
                              </button>
                              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" disabled={busy} onClick={clearEditing} type="button">
                                Hủy
                              </button>
                            </>
                          ) : editingOwnerId === item.id ? (
                            <>
                              <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => saveOwner(item.id)} type="button">
                                Lưu người tạo
                              </button>
                              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" disabled={busy} onClick={clearEditing} type="button">
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" disabled={busy} onClick={() => startEditTitle(item)} type="button">
                                Đổi tên
                              </button>
                              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700" disabled={busy} onClick={() => startEditOwner(item)} type="button">
                                Sửa người tạo
                              </button>
                              <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:text-red-300" disabled={busy} onClick={() => deleteSet(item)} type="button">
                                Xóa sạch
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredItems.length ? <div className="py-6 text-sm text-zinc-500">Không có bộ đề phù hợp.</div> : null}
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
