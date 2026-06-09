"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { QuestionEditor, createBlankQuestion } from "@/components/QuestionEditor";
import { useQuizStore } from "@/lib/store";

export default function SetsPage() {
  const store = useQuizStore();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = useMemo(() => store.sets.find((set) => set.id === selectedId) ?? store.sets[0], [selectedId, store.sets]);
  const mustLoginToCreate = store.cloudEnabled && !store.userId;
  const canEditSelected = Boolean(selected && (selected.createdBy ? selected.createdBy === store.userId : !store.cloudEnabled));
  const ownerLabel = selected?.createdByEmail ?? selected?.createdBy ?? "Chưa có người tạo";

  useEffect(() => {
    if (!selectedId && store.sets[0]) setSelectedId(store.sets[0].id);
  }, [selectedId, store.sets]);

  function createSet() {
    if (mustLoginToCreate) return;
    setSelectedId(store.createSet("Bộ đề mới"));
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Quản lý bộ đề" description="Đổi tên, sửa câu hỏi, chọn đáp án đúng và đánh dấu keyword cho bộ đề bạn tạo." />
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
                    Bạn chỉ có quyền học bộ đề này. Chỉ người tạo mới được sửa hoặc xóa.
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
