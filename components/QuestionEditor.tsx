"use client";

import { useRef, useState } from "react";
import type { OptionLabel, Question } from "@/lib/types";
import { addKeyword, emptyOption } from "@/lib/quiz";
import { uid } from "@/lib/utils";

const labels: OptionLabel[] = ["A", "B", "C", "D"];

export function createBlankQuestion(): Question {
  const options = labels.map((label) => emptyOption(label));
  return {
    id: uid("question"),
    questionText: "",
    keywords: [],
    options,
    correctOptionId: options[0].id,
    explanation: ""
  };
}

export function QuestionEditor({
  question,
  onChange,
  onDelete
}: {
  question: Question;
  onChange: (question: Question) => void;
  onDelete?: () => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");

  function markKeyword() {
    const el = textRef.current;
    if (!el || el.selectionEnd <= el.selectionStart) {
      setMessage("Bôi đen một đoạn trong câu hỏi trước khi đánh dấu.");
      return;
    }
    onChange(addKeyword(question, el.selectionStart, el.selectionEnd));
    setMessage("Đã đánh dấu keyword.");
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Câu hỏi</div>
        {onDelete ? (
          <button className="focus-ring rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300" onClick={onDelete} type="button">
            Xóa
          </button>
        ) : null}
      </div>
      <textarea
        className="focus-ring mt-3 min-h-24 w-full rounded-md border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
        onChange={(event) => onChange({ ...question, questionText: event.target.value, keywords: [] })}
        ref={textRef}
        value={question.questionText}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="focus-ring rounded-md bg-yellow-300 px-3 py-2 text-sm font-medium text-ink" onClick={markKeyword} type="button">
          Đánh dấu keyword
        </button>
        <button className="focus-ring rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" onClick={() => onChange({ ...question, keywords: [] })} type="button">
          Xóa keyword
        </button>
        {message ? <span className="text-sm text-zinc-500">{message}</span> : null}
      </div>
      <div className="mt-4 grid gap-3">
        {question.options.map((option) => (
          <label className="grid gap-1" key={option.id}>
            <span className="text-sm font-medium">Đáp án {option.label}</span>
            <div className="flex gap-2">
              <input
                checked={question.correctOptionId === option.id}
                name={`correct-${question.id}`}
                onChange={() => onChange({ ...question, correctOptionId: option.id })}
                type="radio"
              />
              <input
                className="focus-ring w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: question.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item))
                  })
                }
                value={option.text}
              />
            </div>
          </label>
        ))}
      </div>
      <label className="mt-4 grid gap-1">
        <span className="text-sm font-medium">Giải thích</span>
        <textarea
          className="focus-ring min-h-20 rounded-md border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"
          onChange={(event) => onChange({ ...question, explanation: event.target.value })}
          value={question.explanation ?? ""}
        />
      </label>
    </div>
  );
}
