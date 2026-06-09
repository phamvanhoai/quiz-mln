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
  return (
    <button
      className={cn(
        "focus-ring flex w-full items-start gap-3 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-blue-400 dark:bg-zinc-950",
        state === "correct" && "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
        state === "wrong" && "border-red-500 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
        state === "selected" && "border-blue-500 bg-blue-50 dark:bg-blue-950",
        disabled && "cursor-default hover:border-zinc-200 dark:hover:border-zinc-800"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 font-bold dark:bg-zinc-800">
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
