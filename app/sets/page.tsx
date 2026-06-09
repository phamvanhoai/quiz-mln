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

  useEffect(() => {
    if (!selectedId && store.sets[0]) setSelectedId(store.sets[0].id);
  }, [selectedId, store.sets]);

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Quản lý bộ đề" description="Đổi tên, xóa bộ đề, sửa câu hỏi, chọn đáp án đúng và đánh dấu keyword thủ công." />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <button className="focus-ring w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white" onClick={() => setSelectedId(store.createSet("Bộ đề mới"))} type="button">
            Tạo bộ đề mới
          </button>
          <div className="mt-4 grid gap-2">
            {store.sets.map((set) => (
              <button
                className={`focus-ring rounded-md border p-3 text-left ${selected?.id === set.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-800"}`}
                key={set.id}
                onClick={() => setSelectedId(set.id)}
                type="button"
              >
                <div className="font-medium">{set.title}</div>
                <div className="text-sm text-zinc-500">{set.questions.length} câu</div>
              </button>
            ))}
          </div>
        </aside>
        {selected ? (
          <section>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <label className="grid gap-2 text-sm font-medium">
                Tên bộ đề
                <input className="focus-ring rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" onChange={(e) => store.renameSet(selected.id, e.target.value)} value={selected.title} />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="focus-ring rounded-md bg-emerald-600 px-4 py-2 font-medium text-white" href={`/study/${selected.id}`}>
                  Ôn tập
                </Link>
                <Link className="focus-ring rounded-md bg-indigo-600 px-4 py-2 font-medium text-white" href={`/exam/${selected.id}`}>
                  Thi thử
                </Link>
                <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700" onClick={() => store.addQuestion(selected.id, createBlankQuestion())} type="button">
                  Thêm câu
                </button>
                <button className="focus-ring rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 dark:border-red-800 dark:text-red-300" onClick={() => store.deleteSet(selected.id)} type="button">
                  Xóa bộ đề
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              {selected.questions.map((question) => (
                <QuestionEditor
                  key={question.id}
                  onChange={(next) => store.updateQuestion(selected.id, next)}
                  onDelete={() => store.deleteQuestion(selected.id, question.id)}
                  question={question}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">Chưa có bộ đề.</div>
        )}
      </div>
    </AppShell>
  );
}
