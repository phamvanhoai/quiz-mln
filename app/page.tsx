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
      <PageTitle title="Dashboard" description="Quản lý bộ đề MLN111, import Word/PDF và luyện tập ngay trong trình duyệt bằng localStorage." />
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Bộ đề" value={store.sets.length} />
        <Stat label="Tổng câu" value={total} />
        <Stat label="Đã học" value={`${learned}/${total} (${percent(learned, total)}%)`} />
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-semibold">Bắt đầu nhanh</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="focus-ring rounded-md bg-blue-600 px-4 py-2 font-medium text-white" href="/import">
              Import file
            </Link>
            <Link className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700" href="/sets">
              Quản lý bộ đề
            </Link>
            <Link className="focus-ring rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700" href="/wrong">
              Luyện {wrong} câu sai
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-semibold">Bộ đề gần đây</h2>
          <div className="mt-3 grid gap-2">
            {store.sets.map((set) => (
              <Link className="rounded-md border border-zinc-200 p-3 hover:border-blue-400 dark:border-zinc-800" href={`/study/${set.id}`} key={set.id}>
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
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
