"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AnswerButton, QuestionResult, QuestionText } from "@/components/QuestionView";
import { useQuizStore } from "@/lib/store";
import { cn, percent } from "@/lib/utils";

export default function StudyPage() {
  const { setId } = useParams<{ setId: string }>();
  const store = useQuizStore();
  const set = useMemo(() => store.sets.find((item) => item.id === setId), [setId, store.sets]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showKeywords, setShowKeywords] = useState(true);
  const question = set?.questions[index];
  const correct = question && selected ? selected === question.correctOptionId : false;

  const stats = useMemo(() => {
    const questions = set?.questions ?? [];
    return {
      learned: questions.filter((item) => store.progress[item.id]?.learned).length,
      wrong: questions.filter((item) => (store.progress[item.id]?.wrongCount ?? 0) > 0).length,
      starred: questions.filter((item) => store.progress[item.id]?.starred).length
    };
  }, [set?.questions, store.progress]);

  function choose(optionId: string) {
    if (!question || selected) return;
    setSelected(optionId);
    store.markAnswer(question.id, optionId === question.correctOptionId);
  }

  function go(next: number) {
    setIndex(next);
    setSelected(null);
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title={set?.title ?? "Ôn tập"} description="Chọn đáp án để xem đúng/sai ngay, lưu câu đã học, câu sai và câu đánh dấu sao." />
      {!set || !question ? (
        <Link href="/sets" className="text-blue-600 dark:text-blue-400">
          Quay lại bộ đề
        </Link>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <section className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Câu {index + 1}/{set.questions.length}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Đã học {stats.learned} · Câu sai {stats.wrong} · Đánh sao {stats.starred}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="focus-ring rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" onClick={() => setShowKeywords((v) => !v)} type="button">
                  {showKeywords ? "Ẩn keyword" : "Hiện keyword"}
                </button>
                <button className="focus-ring rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" onClick={() => store.toggleStar(question.id)} type="button">
                  {store.progress[question.id]?.starred ? "Bỏ sao" : "Đánh sao"}
                </button>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full bg-blue-600" style={{ width: `${percent(index + 1, set.questions.length)}%` }} />
            </div>

            <div className="mt-6">
              <QuestionText question={question} showKeywords={showKeywords} />
            </div>

            <div className="mt-6 grid gap-3">
              {question.options.map((option) => {
                const state = !selected
                  ? "neutral"
                  : option.id === question.correctOptionId
                    ? "correct"
                    : option.id === selected
                      ? "wrong"
                      : "neutral";
                return <AnswerButton disabled={Boolean(selected)} key={option.id} label={option.label} onClick={() => choose(option.id)} state={state} text={option.text} />;
              })}
            </div>

            {selected ? (
              <div className="mt-4">
                <QuestionResult correct={correct} explanation={question.explanation} />
              </div>
            ) : null}

            <div className="mt-6 flex justify-between">
              <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-50 dark:border-zinc-700" disabled={index === 0} onClick={() => go(index - 1)} type="button">
                Câu trước
              </button>
              <button className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={index === set.questions.length - 1} onClick={() => go(index + 1)} type="button">
                Câu sau
              </button>
            </div>
          </section>

          <QuestionList currentIndex={index} onSelect={go} progress={store.progress} questions={set.questions} />
        </div>
      )}
    </AppShell>
  );
}

function QuestionList({
  currentIndex,
  onSelect,
  progress,
  questions
}: {
  currentIndex: number;
  onSelect: (index: number) => void;
  progress: ReturnType<typeof useQuizStore>["progress"];
  questions: NonNullable<ReturnType<typeof useQuizStore>["sets"][number]>["questions"];
}) {
  return (
    <aside className="panel p-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Danh sách câu</h2>
        <span className="text-xs text-zinc-500">{questions.length} câu</span>
      </div>
      <div className="mt-3 grid grid-cols-8 gap-2 sm:grid-cols-10 xl:grid-cols-5">
        {questions.map((question, itemIndex) => {
          const item = progress[question.id];
          const active = itemIndex === currentIndex;
          const learned = Boolean(item?.learned);
          const wrong = (item?.wrongCount ?? 0) > 0 && (item?.correctStreak ?? 0) === 0;
          const starred = Boolean(item?.starred);
          return (
            <button
              className={cn(
                "focus-ring relative flex h-10 items-center justify-center rounded-md border text-sm font-semibold transition",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : wrong
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                    : learned
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              )}
              key={question.id}
              onClick={() => onSelect(itemIndex)}
              title={`Câu ${itemIndex + 1}${wrong ? " · sai" : learned ? " · đã học" : ""}${starred ? " · sao" : ""}`}
              type="button"
            >
              {itemIndex + 1}
              {starred ? <span className="absolute right-1 top-0 text-[10px] leading-none">★</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Legend className="bg-emerald-50 ring-emerald-300 dark:bg-emerald-950 dark:ring-emerald-800" label="Đã học" />
        <Legend className="bg-red-50 ring-red-300 dark:bg-red-950 dark:ring-red-800" label="Câu sai" />
        <Legend className="bg-blue-600 ring-blue-600" label="Đang xem" />
      </div>
    </aside>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-sm ring-1", className)} />
      <span>{label}</span>
    </div>
  );
}
