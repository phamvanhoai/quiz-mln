"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AnswerButton, QuestionText } from "@/components/QuestionView";
import { prepareExamQuestions } from "@/lib/quiz";
import { useQuizStore } from "@/lib/store";
import type { Question } from "@/lib/types";
import { percent } from "@/lib/utils";

export default function ExamPage() {
  const { setId } = useParams<{ setId: string }>();
  const store = useQuizStore();
  const set = useMemo(() => store.sets.find((item) => item.id === setId), [setId, store.sets]);
  const [count, setCount] = useState(10);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [hideKeywords, setHideKeywords] = useState(true);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [exam, setExam] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!exam.length || !timed || submitted) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setSubmitted(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam.length, submitted, timed]);

  function start() {
    if (!set) return;
    const total = Math.min(count, set.questions.length);
    setExam(prepareExamQuestions(set.questions, total, shuffleQuestions, shuffleOptions));
    setAnswers({});
    setIndex(0);
    setSubmitted(false);
    setRemaining(minutes * 60);
  }

  function submit() {
    exam.forEach((question) => store.markAnswer(question.id, answers[question.id] === question.correctOptionId));
    setSubmitted(true);
  }

  const correct = exam.filter((question) => answers[question.id] === question.correctOptionId).length;
  const wrongQuestions = exam.filter((question) => answers[question.id] && answers[question.id] !== question.correctOptionId);
  const current = exam[index];
  const timeText = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title={set?.title ? `Thi thử: ${set.title}` : "Thi thử"} description="Làm bài không báo đúng/sai ngay. Sau khi nộp sẽ có điểm, tỷ lệ và danh sách câu sai." />
      {!set ? <Link href="/sets" className="text-blue-600">Quay lại bộ đề</Link> : null}
      {set && !exam.length ? (
        <section className="max-w-xl rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <label className="grid gap-2 text-sm font-medium">
            Số câu thi
            <input className="focus-ring rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" max={set.questions.length} min={1} onChange={(e) => setCount(Number(e.target.value))} type="number" value={Math.min(count, set.questions.length)} />
          </label>
          <div className="mt-4 grid gap-3 text-sm">
            <Check checked={shuffleQuestions} label="Đảo thứ tự câu hỏi" onChange={setShuffleQuestions} />
            <Check checked={shuffleOptions} label="Đảo vị trí đáp án A/B/C/D" onChange={setShuffleOptions} />
            <Check checked={hideKeywords} label="Ẩn keyword" onChange={setHideKeywords} />
            <Check checked={timed} label="Bật thời gian làm bài" onChange={setTimed} />
          </div>
          {timed ? (
            <label className="mt-4 grid gap-2 text-sm font-medium">
              Thời gian (phút)
              <input className="focus-ring rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" min={1} onChange={(e) => setMinutes(Number(e.target.value))} type="number" value={minutes} />
            </label>
          ) : null}
          <button className="focus-ring mt-5 rounded-md bg-blue-600 px-4 py-2 font-medium text-white" onClick={start} type="button">Bắt đầu</button>
        </section>
      ) : null}
      {current && !submitted ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-500">Câu {index + 1}/{exam.length}</div>
              {timed ? <div className="rounded-md bg-zinc-100 px-3 py-1 font-mono dark:bg-zinc-800">{timeText}</div> : null}
            </div>
            <QuestionText question={current} showKeywords={!hideKeywords} />
            <div className="mt-6 grid gap-3">
              {current.options.map((option) => (
                <AnswerButton
                  key={option.id}
                  label={option.label}
                  onClick={() => setAnswers((items) => ({ ...items, [current.id]: option.id }))}
                  state={answers[current.id] === option.id ? "selected" : "neutral"}
                  text={option.text}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-50 dark:border-zinc-700" disabled={index === 0} onClick={() => setIndex(index - 1)} type="button">Câu trước</button>
              <button className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white" onClick={() => (index === exam.length - 1 ? submit() : setIndex(index + 1))} type="button">{index === exam.length - 1 ? "Nộp bài" : "Câu sau"}</button>
            </div>
          </div>
          <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 font-semibold">Điều hướng</div>
            <div className="grid grid-cols-5 gap-2">
              {exam.map((question, qIndex) => (
                <button className={`focus-ring rounded-md border py-2 text-sm ${answers[question.id] ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-300 dark:border-zinc-700"} ${qIndex === index ? "ring-2 ring-blue-500" : ""}`} key={question.id} onClick={() => setIndex(qIndex)} type="button">
                  {qIndex + 1}
                </button>
              ))}
            </div>
            <button className="focus-ring mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white" onClick={submit} type="button">Nộp bài</button>
          </aside>
        </section>
      ) : null}
      {submitted && exam.length ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-bold">Kết quả</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Result label="Điểm" value={`${correct}/${exam.length}`} />
            <Result label="Đúng/Sai" value={`${correct}/${exam.length - correct}`} />
            <Result label="Tỷ lệ" value={`${percent(correct, exam.length)}%`} />
          </div>
          <div className="mt-5 flex gap-2">
            <button className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white" onClick={() => setExam(wrongQuestions)} type="button" disabled={!wrongQuestions.length}>Làm lại câu sai</button>
            <button className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700" onClick={() => setExam([])} type="button">Thi lại từ đầu</button>
          </div>
          <div className="mt-6 grid gap-4">
            {wrongQuestions.map((question, qIndex) => (
              <div className="rounded-md border border-red-200 p-4 dark:border-red-900" key={question.id}>
                <div className="font-semibold">Câu sai {qIndex + 1}</div>
                <QuestionText question={question} showKeywords />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2"><input checked={checked} onChange={(e) => onChange(e.target.checked)} type="checkbox" />{label}</label>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-zinc-100 p-4 dark:bg-zinc-900"><div className="text-sm text-zinc-500">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}
