"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageTitle } from "@/components/AppShell";
import { QuestionEditor } from "@/components/QuestionEditor";
import { readDocxText, readPdfText } from "@/lib/file-readers";
import { parseQuizTextWithErrors } from "@/lib/parser";
import { readSettings } from "@/lib/settings";
import { splitImportText } from "@/lib/text-chunks";
import { useQuizStore } from "@/lib/store";
import type { Question } from "@/lib/types";

const sampleText = `1. Xanh-ximông là đại biểu của trường phái nào?
A. Chủ nghĩa xã hội không tưởng Pháp
B. Chủ nghĩa xã hội không tưởng Đức
C. Triết học cổ điển Đức
D. Kinh tế chính trị học Anh
A`;

type AiImportResponse = {
  questions?: Question[];
  error?: string;
  chunkCount?: number;
  rawCount?: number;
  chunkErrors?: string[];
};

type ImportProgress = {
  active: boolean;
  current: number;
  total: number;
  found: number;
  label: string;
};

function questionKey(question: Question) {
  return [question.questionText, ...question.options.map((option) => `${option.label}:${option.text}`)]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeQuestions(items: Question[]) {
  const seen = new Set<string>();
  const result: Question[] = [];
  for (const item of items) {
    const key = questionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function fetchAiChunk(payload: unknown, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/ai-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function ImportPage() {
  const store = useQuizStore();
  const router = useRouter();
  const [title, setTitle] = useState("Bộ đề mới");
  const [text, setText] = useState(sampleText);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<ImportProgress>({ active: false, current: 0, total: 0, found: 0, label: "" });
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setBusy(true);
    setNotice("");
    setErrors([]);
    setProgress({ active: true, current: 0, total: 1, found: 0, label: "Đang đọc file..." });
    try {
      const lower = file.name.toLowerCase();
      const content = lower.endsWith(".docx") ? await readDocxText(file) : lower.endsWith(".pdf") ? await readPdfText(file) : await file.text();
      setText(content);
      setTitle(file.name.replace(/\.(docx|pdf|txt)$/i, ""));
      setNotice(`Đã đọc file: ${content.length.toLocaleString("vi-VN")} ký tự.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Không đọc được file."]);
    } finally {
      setProgress({ active: false, current: 0, total: 0, found: 0, label: "" });
      setBusy(false);
    }
  }

  function parse() {
    setNotice("");
    setProgress({ active: true, current: 1, total: 1, found: 0, label: "Đang parse bằng quy tắc..." });
    const result = parseQuizTextWithErrors(text);
    setQuestions(result.questions);
    setErrors(result.errors);
    setNotice(`Parse thường nhận diện ${result.questions.length} câu.`);
    setProgress({ active: false, current: 0, total: 0, found: 0, label: "" });
  }

  async function parseWithAi() {
    const chunks = splitImportText(text);
    const allQuestions: Question[] = [];
    const allErrors: string[] = [];

    setBusy(true);
    setErrors([]);
    setQuestions([]);
    setNotice("");
    setProgress({ active: true, current: 0, total: chunks.length, found: 0, label: "Chuẩn bị AI import..." });

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setProgress({
          active: true,
          current: index + 1,
          total: chunks.length,
          found: allQuestions.length,
          label: `AI đang xử lý phần ${index + 1}/${chunks.length}`
        });

        let response: Response | null = null;
        let data: AiImportResponse | null = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            if (attempt > 1) {
              setProgress({
                active: true,
                current: index + 1,
                total: chunks.length,
                found: allQuestions.length,
                label: `Phần ${index + 1}/${chunks.length} quá lâu, đang thử lại lần ${attempt}`
              });
            }
            response = await fetchAiChunk({
              text: chunks[index],
              settings: readSettings(),
              chunkIndex: index,
              chunkCount: chunks.length
            });
            data = (await response.json()) as AiImportResponse;
            break;
          } catch (error) {
            if (attempt === 2) {
              allErrors.push(
                `Phần ${index + 1}/${chunks.length}: quá thời gian chờ AI, đã bỏ qua để tiếp tục các phần còn lại.`
              );
            }
          }
        }

        if (!response || !data) continue;
        if (!response.ok) {
          allErrors.push(data.error ?? `Phần ${index + 1}/${chunks.length}: AI import thất bại.`);
          continue;
        }
        allQuestions.push(...(data.questions ?? []));
        allErrors.push(...(data.chunkErrors ?? []));
        const deduped = dedupeQuestions(allQuestions);
        setQuestions(deduped);
        setProgress({
          active: true,
          current: index + 1,
          total: chunks.length,
          found: deduped.length,
          label: `Đã xử lý ${index + 1}/${chunks.length} phần`
        });
      }

      const deduped = dedupeQuestions(allQuestions);
      setQuestions(deduped);
      setErrors(allErrors);
      setNotice(`AI đã xử lý ${chunks.length} phần, nhận ${allQuestions.length} câu thô, còn ${deduped.length} câu sau khi gộp trùng.`);
      if (!deduped.length && !allErrors.length) {
        setErrors(["AI không tách được câu hỏi nào. Hãy kiểm tra text nguồn hoặc thử parse thường."]);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Không gọi được AI import."]);
    } finally {
      setBusy(false);
      setProgress((current) => ({ ...current, active: false, label: "" }));
    }
  }

  function save() {
    const id = store.createSet(title.trim() || "Bộ đề mới", questions);
    router.push(`/sets?set=${id}`);
  }

  const progressPercent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

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
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={parse} type="button">
              Parse
            </button>
            <button className="btn-secondary" disabled={busy || !text.trim()} onClick={parseWithAi} type="button">
              Parse bằng AI
            </button>
            <button className="btn-secondary" disabled={!questions.length || busy} onClick={save} type="button">
              Lưu bộ đề
            </button>
          </div>
          {progress.active ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{progress.label}</span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full bg-zinc-950 transition-all dark:bg-white" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Phần {progress.current}/{progress.total} · Đã nhận {progress.found} câu
              </div>
            </div>
          ) : null}
          {notice ? <div className="mt-4 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{notice}</div> : null}
          {errors.length ? (
            <div className="mt-4 max-h-52 overflow-auto rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
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
