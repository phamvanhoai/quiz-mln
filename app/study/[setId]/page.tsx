"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AnswerButton, QuestionResult, QuestionText } from "@/components/QuestionView";
import { useQuizStore } from "@/lib/store";
import { percent } from "@/lib/utils";

export default function StudyPage() {
  const { setId } = useParams<{ setId: string }>();
  const store = useQuizStore();
  const set = useMemo(() => store.sets.find((item) => item.id === setId), [setId, store.sets]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showKeywords, setShowKeywords] = useState(true);
  const question = set?.questions[index];
  const correct = question && selected ? selected === question.correctOptionId : false;

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
        <Link href="/sets" className="text-blue-600">Quay lại bộ đề</Link>
      ) : (
        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-500">Câu {index + 1}/{set.questions.length}</div>
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
          {selected ? <div className="mt-4"><QuestionResult correct={correct} explanation={question.explanation} /></div> : null}
          <div className="mt-6 flex justify-between">
            <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-50 dark:border-zinc-700" disabled={index === 0} onClick={() => go(index - 1)} type="button">
              Câu trước
            </button>
            <button className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={index === set.questions.length - 1} onClick={() => go(index + 1)} type="button">
              Câu sau
            </button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
