"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { QuestionEditor, createBlankQuestion } from "@/components/QuestionEditor";
import { getConfiguredSupabaseClient } from "@/lib/auth";
import { useQuizStore } from "@/lib/store";
import type { QuizSet } from "@/lib/types";

type ShareRow = {
  id: string;
  set_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string | null;
  created_at: string;
};

const visibilityLabels: Record<NonNullable<QuizSet["visibility"]>, string> = {
  private: "Riêng tư",
  shared: "Được chia sẻ",
  public: "Công khai"
};

export default function SetsPage() {
  const store = useQuizStore();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const selected = useMemo(() => store.sets.find((set) => set.id === selectedId) ?? store.sets[0], [selectedId, store.sets]);
  const mustLoginToCreate = store.cloudEnabled && !store.userId;
  const canEditSelected = Boolean(selected && (selected.createdBy ? selected.createdBy === store.userId : !store.cloudEnabled));
  const ownerLabel = selected?.createdByEmail ?? selected?.createdBy ?? "Chưa có người tạo";

  useEffect(() => {
    if (!selectedId && store.sets[0]) setSelectedId(store.sets[0].id);
  }, [selectedId, store.sets]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    async function loadShares() {
      setShares([]);
      setShareMessage("");
      if (!selected || !canEditSelected || !store.cloudEnabled) return;
      const supabase = getConfiguredSupabaseClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from("quiz_set_shares")
        .select("id,set_id,shared_with_user_id,shared_with_email,created_at")
        .eq("set_id", selected.id)
        .order("created_at", { ascending: false });
      if (error) {
        setShareMessage(error.message);
        return;
      }
      setShares((data ?? []) as ShareRow[]);
    }
    loadShares();
  }, [canEditSelected, selected?.id, store.cloudEnabled]);

  function createSet() {
    if (mustLoginToCreate) return;
    setSelectedId(store.createSet("Bộ đề mới"));
  }

  async function updateVisibility(visibility: NonNullable<QuizSet["visibility"]>) {
    if (!selected || !canEditSelected) return;
    const next = { ...selected, visibility, updatedAt: new Date().toISOString() };
    store.saveSet(next);

    const supabase = getConfiguredSupabaseClient();
    if (!supabase || !store.cloudEnabled) return;
    setShareBusy(true);
    const { error } = await supabase.from("quiz_sets").update({ visibility, updated_at: next.updatedAt }).eq("id", selected.id);
    setShareBusy(false);
    setShareMessage(error ? error.message : "Đã cập nhật chế độ chia sẻ.");
  }

  async function addShare() {
    if (!selected || !store.userId) return;
    const email = shareEmail.trim().toLowerCase();
    if (!email) return;
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    setShareBusy(true);
    const { error } = await supabase
      .from("quiz_set_shares")
      .insert({ set_id: selected.id, shared_with_email: email, created_by: store.userId });
    if (!error && selected.visibility !== "shared") {
      await supabase.from("quiz_sets").update({ visibility: "shared", updated_at: new Date().toISOString() }).eq("id", selected.id);
      store.saveSet({ ...selected, visibility: "shared", updatedAt: new Date().toISOString() });
    }
    setShareBusy(false);
    setShareMessage(error ? error.message : `Đã chia sẻ cho ${email}.`);
    if (!error) {
      setShareEmail("");
      const { data } = await supabase
        .from("quiz_set_shares")
        .select("id,set_id,shared_with_user_id,shared_with_email,created_at")
        .eq("set_id", selected.id)
        .order("created_at", { ascending: false });
      setShares((data ?? []) as ShareRow[]);
    }
  }

  async function removeShare(shareId: string) {
    const supabase = getConfiguredSupabaseClient();
    if (!supabase) return;
    setShareBusy(true);
    const { error } = await supabase.from("quiz_set_shares").delete().eq("id", shareId);
    setShareBusy(false);
    setShareMessage(error ? error.message : "Đã xóa chia sẻ.");
    if (!error) setShares((items) => items.filter((item) => item.id !== shareId));
  }

  async function copyStudyLink() {
    if (!selected || typeof window === "undefined") return;
    const link = `${origin || window.location.origin}/study/${selected.id}`;
    try {
      await window.navigator.clipboard.writeText(link);
      setShareMessage("Đã copy link học vào clipboard.");
    } catch {
      setShareMessage(link);
    }
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Quản lý bộ đề" description="Sửa câu hỏi, chọn đáp án đúng, đánh dấu keyword và chia sẻ bộ đề cho người khác học." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="panel p-4">
          <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={mustLoginToCreate} onClick={createSet} type="button">
            {mustLoginToCreate ? "Đăng nhập để tạo" : "Tạo bộ đề mới"}
          </button>
          {mustLoginToCreate ? (
            <Link className="mt-3 block text-sm font-medium text-blue-600 dark:text-blue-300" href="/login">
              Đăng nhập để lưu bộ đề theo tài khoản
            </Link>
          ) : null}
          <div className="mt-4 grid gap-2">
            {store.sets.map((set) => {
              const ownedByMe = Boolean(set.createdBy && set.createdBy === store.userId);
              return (
                <button
                  className={`focus-ring rounded-md border p-3 text-left ${
                    selected?.id === set.id
                      ? "border-blue-500 bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50"
                      : "border-zinc-200 text-zinc-800 dark:border-zinc-800 dark:text-zinc-100"
                  }`}
                  key={set.id}
                  onClick={() => setSelectedId(set.id)}
                  type="button"
                >
                  <div className="font-medium">{set.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>{set.questions.length} câu</span>
                    <span>{visibilityLabels[set.visibility ?? "public"]}</span>
                    {set.createdBy ? <span>{ownedByMe ? "Của tôi" : "Chỉ học"}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {selected ? (
          <section>
            <div className="panel p-4">
              <div className="grid gap-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">Người tạo</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium dark:bg-zinc-900">{ownerLabel}</span>
                </div>
                {!canEditSelected ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    Bạn chỉ có quyền học bộ đề này. Chỉ người tạo mới được sửa, xóa hoặc chia sẻ.
                  </div>
                ) : null}
              </div>

              <label className="mt-4 grid gap-2 text-sm font-medium">
                Tên bộ đề
                <input
                  className="focus-ring rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700"
                  disabled={!canEditSelected}
                  onChange={(e) => store.renameSet(selected.id, e.target.value)}
                  value={selected.title}
                />
              </label>

              {canEditSelected ? (
                <section className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Chia sẻ bộ đề</h2>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Người được chia sẻ chỉ học được, không sửa/xóa đề.</p>
                    </div>
                    <select
                      className="focus-ring rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      disabled={shareBusy || !store.cloudEnabled}
                      onChange={(event) => updateVisibility(event.target.value as NonNullable<QuizSet["visibility"]>)}
                      value={selected.visibility ?? "public"}
                    >
                      <option value="private">Riêng tư</option>
                      <option value="shared">Được chia sẻ</option>
                      <option value="public">Công khai</option>
                    </select>
                  </div>
                  {store.cloudEnabled ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                        <code className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                          {origin ? `${origin}/study/${selected.id}` : "Đang tạo link..."}
                        </code>
                        <button className="btn-secondary px-3 py-1.5 text-sm" onClick={copyStudyLink} type="button">
                          Copy link
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          className="focus-ring min-w-64 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                          onChange={(event) => setShareEmail(event.target.value)}
                          placeholder="Email người học"
                          type="email"
                          value={shareEmail}
                        />
                        <button className="btn-secondary" disabled={shareBusy || !shareEmail.trim()} onClick={addShare} type="button">
                          Thêm chia sẻ
                        </button>
                      </div>
                      {shares.length ? (
                        <div className="mt-3 grid gap-2">
                          {shares.map((share) => (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-800" key={share.id}>
                              <span>{share.shared_with_email ?? share.shared_with_user_id}</span>
                              <button className="text-sm font-medium text-red-600 dark:text-red-400" disabled={shareBusy} onClick={() => removeShare(share.id)} type="button">
                                Xóa
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-zinc-500">Chưa chia sẻ riêng cho ai.</div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">Cần bật Supabase để chia sẻ cho người khác.</div>
                  )}
                  {shareMessage ? <div className="mt-3 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{shareMessage}</div> : null}
                </section>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn-primary" href={`/study/${selected.id}`}>
                  Ôn tập
                </Link>
                <Link className="btn-secondary" href={`/exam/${selected.id}`}>
                  Thi thử
                </Link>
                {canEditSelected ? (
                  <>
                    <button className="btn-secondary" onClick={() => store.addQuestion(selected.id, createBlankQuestion())} type="button">
                      Thêm câu
                    </button>
                    <button className="focus-ring rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 dark:border-red-800 dark:text-red-300" onClick={() => store.deleteSet(selected.id)} type="button">
                      Xóa bộ đề
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {selected.questions.map((question) => (
                <QuestionEditor
                  key={question.id}
                  onChange={(next) => {
                    if (canEditSelected) store.updateQuestion(selected.id, next);
                  }}
                  onDelete={canEditSelected ? () => store.deleteQuestion(selected.id, question.id) : undefined}
                  question={question}
                  readOnly={!canEditSelected}
                />
              ))}
              {!selected.questions.length ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
                  Bộ đề chưa có câu hỏi.
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">Chưa có bộ đề.</div>
        )}
      </div>
    </AppShell>
  );
}
