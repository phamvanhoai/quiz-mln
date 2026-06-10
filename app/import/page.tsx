"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageTitle } from "@/components/AppShell";
import { QuestionEditor } from "@/components/QuestionEditor";
import { readDocxText, readPdfText } from "@/lib/file-readers";
import { parseQuizTextWithErrors } from "@/lib/parser";
import { readSettings } from "@/lib/settings";
import { splitImportTextWithMeta } from "@/lib/text-chunks";
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

type FailedChunk = {
  index: number;
  total: number;
  text: string;
  reason: string;
  questionRange: string;
  lineRange: string;
  preview: string;
};

type ImportChunk = {
  text: string;
  index: number;
  total: number;
  questionRange: string;
  lineRange: string;
  preview: string;
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

async function fetchAiChunk(payload: unknown, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("/api/ai-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timer);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "AI quá thời gian chờ.";
  }
  return error instanceof Error ? error.message : "Không rõ lỗi.";
}

function describeChunk(chunkText: string) {
  const numbers = Array.from(chunkText.matchAll(/(?:^|\n)\s*(\d+)[\.\)]\s+/g))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  const questionRange = first && last ? (first === last ? `câu ${first}` : `khoảng câu ${first}-${last}`) : "không xác định được số câu";
  const preview = chunkText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(" ")
    .slice(0, 320);
  return { questionRange, preview };
}

function buildImportChunks(sourceText: string): ImportChunk[] {
  const rawChunks = splitImportTextWithMeta(sourceText);
  const parsedCounts = rawChunks.map((chunk) => parseQuizTextWithErrors(chunk.text).questions.length);
  let cursor = 1;
  return rawChunks.map((chunk, index) => {
    const numbered = describeChunk(chunk.text);
    const count = parsedCounts[index];
    let questionRange = numbered.questionRange;
    if (questionRange === "không xác định được số câu" && count > 0) {
      const start = cursor;
      const end = cursor + count - 1;
      questionRange = start === end ? `ước lượng câu ${start}` : `ước lượng câu ${start}-${end}`;
    }
    cursor += Math.max(count, 0);
    return {
      text: chunk.text,
      index,
      total: rawChunks.length,
      questionRange,
      lineRange: `dòng ${chunk.startLine}-${chunk.endLine}`,
      preview: numbered.preview
    };
  });
}

function cleanChunkError(message: string, index: number, total: number) {
  return message
    .replace(new RegExp(`^\\s*Phần\\s+${index + 1}\\/${total}\\s*:\\s*`, "i"), "")
    .replace(new RegExp(`^\\s*Phần\\s+${index + 1}\\/${total}\\s*:\\s*`, "i"), "")
    .trim();
}

export default function ImportPage() {
  const store = useQuizStore();
  const router = useRouter();
  const [title, setTitle] = useState("Bộ đề mới");
  const [text, setText] = useState(sampleText);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [failedChunks, setFailedChunks] = useState<FailedChunk[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<ImportProgress>({ active: false, current: 0, total: 0, found: 0, label: "" });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function readFile(file: File) {
    setBusy(true);
    setNotice("");
    setErrors([]);
    setFailedChunks([]);
    setProgress({ active: true, current: 0, total: 1, found: 0, label: "Đang đọc file..." });
    try {
      const lower = file.name.toLowerCase();
      const content = lower.endsWith(".docx") ? await readDocxText(file) : lower.endsWith(".pdf") ? await readPdfText(file) : await file.text();
      setText(content);
      setTitle(file.name.replace(/\.(docx|pdf|txt)$/i, ""));
      setNotice(`Đã đọc file: ${content.length.toLocaleString("vi-VN")} ký tự.`);
    } catch (error) {
      setErrors([errorMessage(error) || "Không đọc được file."]);
    } finally {
      setProgress({ active: false, current: 0, total: 0, found: 0, label: "" });
      setBusy(false);
    }
  }

  function parse() {
    setNotice("");
    setFailedChunks([]);
    setProgress({ active: true, current: 1, total: 1, found: 0, label: "Đang parse bằng quy tắc..." });
    const result = parseQuizTextWithErrors(text);
    setQuestions(result.questions);
    setErrors(result.errors);
    setNotice(`Parse thường nhận diện ${result.questions.length} câu.`);
    setProgress({ active: false, current: 0, total: 0, found: 0, label: "" });
  }

  async function parseOneChunk(chunkText: string, index: number, total: number, currentCount: number) {
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        setProgress({
          active: true,
          current: index + 1,
          total,
          found: currentCount,
          label: attempt === 1 ? `AI đang xử lý phần ${index + 1}/${total}` : `Phần ${index + 1}/${total} lỗi/chậm, thử lại lần ${attempt}`
        });
        const response = await fetchAiChunk({
          text: chunkText,
          settings: readSettings(),
          chunkIndex: index,
          chunkCount: total
        });
        const data = (await response.json()) as AiImportResponse;
        if (!response.ok) {
          lastError = data.error ?? `AI import thất bại với HTTP ${response.status}.`;
          continue;
        }
        const chunkErrors = data.chunkErrors ?? [];
        const chunkQuestions = data.questions ?? [];
        if (!chunkQuestions.length && chunkErrors.length) {
          lastError = chunkErrors.map((error) => cleanChunkError(error, index, total)).join("; ");
          continue;
        }
        return {
          questions: chunkQuestions,
          errors: chunkErrors.map((error) => cleanChunkError(error, index, total))
        };
      } catch (error) {
        lastError = errorMessage(error);
      }
    }
    throw new Error(lastError || "AI xử lý phần này thất bại sau 3 lần thử.");
  }

  async function runAiImport(chunks: ImportChunk[], baseQuestions: Question[], retryMode = false) {
    const allQuestions = [...baseQuestions];
    const allErrors: string[] = [];
    const failed: FailedChunk[] = [];
    let recoveredChunkCount = 0;

    setBusy(true);
    setErrors([]);
    setNotice("");
    setProgress({ active: true, current: 0, total: chunks.length, found: allQuestions.length, label: retryMode ? "Chuẩn bị retry phần lỗi..." : "Chuẩn bị AI import..." });

    try {
      for (let order = 0; order < chunks.length; order += 1) {
        const chunk = chunks[order];
        try {
          const result = await parseOneChunk(chunk.text, chunk.index, chunk.total, allQuestions.length);
          allQuestions.push(...result.questions);
          const details = { questionRange: chunk.questionRange, lineRange: chunk.lineRange, preview: chunk.preview };
          const realErrors = result.errors.filter((error) => !/cứu được|parser thường/i.test(error));
          recoveredChunkCount += result.errors.length - realErrors.length;
          allErrors.push(...realErrors.map((error) => `Phần ${chunk.index + 1}/${chunk.total} (${details.lineRange}, ${details.questionRange}): ${error}. Preview: ${details.preview}`));
          const deduped = dedupeQuestions(allQuestions);
          setQuestions(deduped);
          setProgress({
            active: true,
            current: order + 1,
            total: chunks.length,
            found: deduped.length,
            label: `Đã xử lý ${order + 1}/${chunks.length} phần`
          });
        } catch (error) {
          const reason = errorMessage(error);
          const details = { questionRange: chunk.questionRange, lineRange: chunk.lineRange, preview: chunk.preview };
          const fallback = parseQuizTextWithErrors(chunk.text);
          if (fallback.questions.length) {
            recoveredChunkCount += 1;
            allQuestions.push(...fallback.questions);
            const deduped = dedupeQuestions(allQuestions);
            setQuestions(deduped);
            setProgress({
              active: true,
              current: order + 1,
              total: chunks.length,
              found: deduped.length,
              label: `Đã xử lý ${order + 1}/${chunks.length} phần`
            });
          } else {
            failed.push({ index: chunk.index, total: chunk.total, text: chunk.text, reason, ...details });
          }
        }
      }

      const deduped = dedupeQuestions(allQuestions);
      setQuestions(deduped);
      setErrors(allErrors);
      setFailedChunks(failed);
      setNotice(
        failed.length
          ? `AI nhận ${deduped.length} câu, còn ${failed.length} phần lỗi cần retry trước khi lưu để tránh thiếu câu.`
          : `AI đã xử lý xong, nhận ${deduped.length} câu sau khi gộp trùng.`
      );
      if (!failed.length && recoveredChunkCount) {
        setNotice(
          `AI đã xử lý xong, nhận ${deduped.length} câu sau khi gộp trùng. Có ${recoveredChunkCount} phần AI bị chậm/lỗi nhưng đã tự cứu bằng parser thường.`
        );
      }
      if (!deduped.length && !allErrors.length) {
        setErrors(["AI không tách được câu hỏi nào. Hãy kiểm tra text nguồn hoặc thử parse thường."]);
      }
    } catch (error) {
      setErrors([errorMessage(error) || "Không gọi được AI import."]);
    } finally {
      setBusy(false);
      setProgress((current) => ({ ...current, active: false, label: "" }));
    }
  }

  async function parseWithAi() {
    const chunks = buildImportChunks(text);
    setQuestions([]);
    setFailedChunks([]);
    await runAiImport(chunks, []);
  }

  async function retryFailedChunks() {
    const chunks = failedChunks.map((chunk) => ({
      text: chunk.text,
      index: chunk.index,
      total: chunk.total,
      questionRange: chunk.questionRange,
      lineRange: chunk.lineRange,
      preview: chunk.preview
    }));
    setFailedChunks([]);
    await runAiImport(chunks, questions, true);
  }

  async function save() {
    if (store.cloudEnabled && !store.userId) {
      setErrors(["Bạn cần đăng nhập trước khi lưu bộ đề lên Supabase để hệ thống ghi nhận người tạo."]);
      return;
    }
    if (failedChunks.length && !window.confirm(`Còn ${failedChunks.length} phần import lỗi. Lưu bây giờ có thể thiếu câu. Bạn vẫn muốn lưu?`)) return;
    setSaving(true);
    setErrors([]);
    setNotice("Đang lưu bộ đề lên Supabase...");
    try {
      const id = await store.createSetAsync(title.trim() || "Bộ đề mới", questions);
      router.push(`/sets?set=${id}`);
    } catch (error) {
      setErrors([errorMessage(error) || "Không lưu được Supabase."]);
      setNotice("");
    } finally {
      setSaving(false);
    }
  }

  const progressPercent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  const mustLoginToSave = store.cloudEnabled && !store.userId;

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
            <button className="btn-secondary" disabled={busy || !failedChunks.length} onClick={retryFailedChunks} type="button">
              Thử lại phần lỗi ({failedChunks.length})
            </button>
            <button className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60" disabled={!questions.length || busy || saving || mustLoginToSave} onClick={save} type="button">
              {mustLoginToSave ? "Đăng nhập để lưu" : saving ? "Đang lưu..." : "Lưu bộ đề"}
            </button>
          </div>
          {mustLoginToSave ? (
            <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">Bạn cần đăng nhập để lưu bộ đề theo người tạo.</div>
          ) : null}
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
          {failedChunks.length ? (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
              <div className="font-semibold">Còn {failedChunks.length} phần lỗi. Nên bấm “Thử lại phần lỗi” trước khi lưu.</div>
              <div className="mt-2 grid gap-2">
                {failedChunks.map((chunk) => (
                  <div className="rounded border border-red-200 bg-white/70 p-2 dark:border-red-900 dark:bg-black/20" key={`${chunk.index}-${chunk.reason}`}>
                    <div className="font-medium">
                      Phần {chunk.index + 1}/{chunk.total} · {chunk.questionRange}
                    </div>
                    <div className="mt-1 text-xs opacity-80">{chunk.lineRange}</div>
                    <div className="mt-1 text-xs opacity-80">{chunk.reason}</div>
                    <div className="mt-1 text-xs opacity-80">Preview: {chunk.preview}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
