"use client";

import Link from "next/link";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useQuizStore } from "@/lib/store";
import { percent } from "@/lib/utils";

export default function HomePage() {
  const store = useQuizStore();
  const total = store.sets.reduce((sum, set) => sum + set.questions.length, 0);
  const learned = store.allQuestions.filter(({ question }) => store.progress[question.id]?.learned).length;
  const wrong = store.allQuestions.filter(({ question }) => (store.progress[question.id]?.wrongCount ?? 0) > 0).length;

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Local study workspace</div>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px] lg:p-7">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Ôn tập trắc nghiệm từ Word/PDF</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Import tài liệu, chỉnh câu hỏi, luyện câu sai và thi thử ngay trên máy. Dữ liệu được lưu bằng localStorage, không cần backend.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/import">
                Import file
              </Link>
              <Link className="btn-secondary" href="/sets">
                Quản lý bộ đề
              </Link>
            </div>
            <div className="mt-4 text-sm text-zinc-500">
              {store.cloudEnabled
                ? store.cloudError
                  ? `Supabase lỗi: ${store.cloudError}`
                  : store.cloudReady
                    ? "Supabase sync đang bật."
                    : "Đang kết nối Supabase..."
                : "Đang lưu local trên trình duyệt này."}
            </div>
          </div>
          <div className="grid content-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="text-sm font-semibold">Trạng thái học</div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full bg-zinc-950 dark:bg-white" style={{ width: `${percent(learned, total)}%` }} />
            </div>
            <div className="text-sm text-zinc-500">{learned}/{total} câu đã học</div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Bộ đề" value={store.sets.length} />
        <Stat label="Tổng câu" value={total} />
        <Stat label="Đã học" value={`${learned}/${total} (${percent(learned, total)}%)`} />
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-semibold">Bắt đầu nhanh</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="btn-primary" href="/import">
              Import file
            </Link>
            <Link className="btn-secondary" href="/sets">
              Quản lý bộ đề
            </Link>
            <Link className="btn-secondary" href="/wrong">
              Luyện {wrong} câu sai
            </Link>
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold">Bộ đề gần đây</h2>
          <div className="mt-3 grid gap-2">
            {store.sets.map((set) => (
              <Link className="rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600" href={`/study/${set.id}`} key={set.id}>
                <div className="font-medium">{set.title}</div>
                <div className="text-sm text-zinc-500">{set.questions.length} câu hỏi</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-5">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
