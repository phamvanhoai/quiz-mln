"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageTitle } from "@/components/AppShell";
import { QuestionEditor } from "@/components/QuestionEditor";
import { readDocxText, readPdfText } from "@/lib/file-readers";
import { parseQuizTextWithErrors } from "@/lib/parser";
import { useQuizStore } from "@/lib/store";
import type { Question } from "@/lib/types";

const sampleText = `1. Xanh-ximông là đại biểu của trường phái nào?
A. Chủ nghĩa xã hội không tưởng Pháp
B. Chủ nghĩa xã hội không tưởng Đức
C. Triết học cổ điển Đức
D. Kinh tế chính trị học Anh
A`;

export default function ImportPage() {
  const store = useQuizStore();
  const router = useRouter();
  const [title, setTitle] = useState("Bộ đề mới");
  const [text, setText] = useState(sampleText);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      const content = lower.endsWith(".docx") ? await readDocxText(file) : lower.endsWith(".pdf") ? await readPdfText(file) : await file.text();
      setText(content);
      setTitle(file.name.replace(/\.(docx|pdf|txt)$/i, ""));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Không đọc được file."]);
    } finally {
      setBusy(false);
    }
  }

  function parse() {
    const result = parseQuizTextWithErrors(text);
    setQuestions(result.questions);
    setErrors(result.errors);
  }

  function save() {
    const id = store.createSet(title.trim() || "Bộ đề mới", questions);
    router.push(`/sets?set=${id}`);
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle title="Import dữ liệu" description="Upload .docx/.pdf hoặc dán text, parse thành câu hỏi rồi chỉnh sửa preview trước khi lưu." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <section className="panel p-4">
          <label className="grid gap-2 text-sm font-medium">
            Tên bộ đề
            <input className="focus-ring rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" onChange={(e) => setTitle(e.target.value)} value={title} />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            File .docx hoặc .pdf
            <input className="block w-full text-sm" accept=".docx,.pdf,.txt" disabled={busy} onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} type="file" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-medium">
            Text nguồn
            <textarea className="focus-ring h-80 rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700" onChange={(e) => setText(e.target.value)} value={text} />
          </label>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={parse} type="button">
              Parse
            </button>
            <button className="btn-secondary" disabled={!questions.length} onClick={save} type="button">
              Lưu bộ đề
            </button>
          </div>
          {errors.length ? (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {errors.map((error) => <div key={error}>{error}</div>)}
            </div>
          ) : null}
        </section>
        <section className="grid gap-4">
          <div className="text-sm text-zinc-500">Preview: {questions.length} câu hỏi</div>
          {questions.map((question, index) => (
            <div className="grid gap-2" key={question.id}>
              <div className="text-sm font-semibold text-zinc-500">Câu {index + 1}</div>
              <QuestionEditor
                onChange={(next) => setQuestions((items) => items.map((item) => (item.id === question.id ? next : item)))}
                onDelete={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}
                question={question}
              />
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
