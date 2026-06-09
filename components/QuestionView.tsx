"use client";

import type { Question } from "@/lib/types";
import { renderQuestionParts } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export function QuestionText({ question, showKeywords }: { question: Question; showKeywords: boolean }) {
  return (
    <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed">
      {renderQuestionParts(question.questionText, question.keywords, showKeywords).map((part, index) =>
        part.marked ? (
          <mark className="rounded bg-yellow-200 px-1 text-ink underline decoration-yellow-700" key={index}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </p>
  );
}

export function AnswerButton({
  label,
  text,
  state,
  onClick,
  disabled
}: {
  label: string;
  text: string;
  state?: "neutral" | "correct" | "wrong" | "selected";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const stateClass =
    state === "correct"
      ? "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50 dark:ring-emerald-500"
      : state === "wrong"
        ? "border-red-600 bg-red-100 text-red-950 ring-2 ring-red-500 dark:border-red-400 dark:bg-red-950 dark:text-red-50 dark:ring-red-500"
        : state === "selected"
          ? "border-blue-600 bg-blue-100 text-blue-950 ring-2 ring-blue-500 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50 dark:ring-blue-500"
          : "border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";
  const badgeClass =
    state === "correct"
      ? "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950"
      : state === "wrong"
        ? "bg-red-600 text-white dark:bg-red-400 dark:text-red-950"
        : state === "selected"
          ? "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950"
          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <button
      className={cn(
        "focus-ring flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-sm shadow-zinc-200/60 transition hover:-translate-y-0.5 hover:shadow-md dark:shadow-none",
        stateClass,
        disabled && "cursor-default hover:translate-y-0"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold", badgeClass)}>
        {label}
      </span>
      <span className="pt-1">{text}</span>
    </button>
  );
}

export function QuestionResult({ correct, explanation }: { correct: boolean; explanation?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-sm",
        correct
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      )}
    >
      <div className="font-semibold">{correct ? "Chính xác" : "Chưa đúng"}</div>
      {explanation ? <div className="mt-1">{explanation}</div> : null}
    </div>
  );
}
