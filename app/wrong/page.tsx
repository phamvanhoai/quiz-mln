"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AnswerButton, QuestionResult, QuestionText } from "@/components/QuestionView";
import { useQuizStore } from "@/lib/store";

export default function WrongPage() {
  const store = useQuizStore();
  const wrong = useMemo(() => store.allQuestions.filter(({ question }) => (store.progress[question.id]?.wrongCount ?? 0) > 0), [store.allQuestions, store.progress]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const item = wrong[index];

  function choose(optionId: string) {
    if (!item || selected) return;
    const ok = optionId === item.question.correctOptionId;
    setSelected(optionId);
    store.markAnswer(item.question.id, ok);
    if (ok && (store.progress[item.question.id]?.correctStreak ?? 0) >= 1) {
      store.clearWrong(item.question.id);
    }
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Luyện câu sai" description="Các câu trả lời sai được tự lưu. Trả lời đúng lặp lại sẽ tự xóa khỏi danh sách câu sai." />
      {!item ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          Chưa có câu sai. <Link className="text-blue-600" href="/sets">Vào bộ đề để luyện tập</Link>.
        </div>
      ) : (
        <section className="panel p-5">
          <div className="mb-4 flex justify-between gap-3">
            <div className="text-sm text-zinc-500">Câu {index + 1}/{wrong.length} trong {item.set.title}</div>
            <button className="focus-ring rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" onClick={() => store.clearWrong(item.question.id)} type="button">
              Xóa khỏi câu sai
            </button>
          </div>
          <QuestionText question={item.question} showKeywords />
          <div className="mt-6 grid gap-3">
            {item.question.options.map((option) => {
              const state = !selected
                ? "neutral"
                : option.id === item.question.correctOptionId
                  ? "correct"
                  : option.id === selected
                    ? "wrong"
                    : "neutral";
              return <AnswerButton disabled={Boolean(selected)} key={option.id} label={option.label} onClick={() => choose(option.id)} state={state} text={option.text} />;
            })}
          </div>
          {selected ? <div className="mt-4"><QuestionResult correct={selected === item.question.correctOptionId} explanation={item.question.explanation} /></div> : null}
          <div className="mt-6 flex justify-between">
            <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-50 dark:border-zinc-700" disabled={index === 0} onClick={() => { setIndex(index - 1); setSelected(null); }} type="button">Câu trước</button>
            <button className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={index >= wrong.length - 1} onClick={() => { setIndex(index + 1); setSelected(null); }} type="button">Câu sau</button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
