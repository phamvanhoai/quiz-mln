"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/import", label: "Import" },
  { href: "/sets", label: "Bộ đề" },
  { href: "/wrong", label: "Câu sai" }
];

export function AppShell({ children, dark, onToggleDark }: { children: ReactNode; dark: boolean; onToggleDark: () => void }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:block lg:px-6">
          <Link href="/" className="block">
            <div className="text-lg font-bold">Quiz MLN111</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Ôn tập Word/PDF local</div>
          </Link>
          <button
            className="focus-ring rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            onClick={onToggleDark}
            type="button"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4 lg:block lg:px-6">
          {nav.map((item) => (
            <Link
              className={cn(
                "focus-ring block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                pathname === item.href && "bg-blue-600 text-white hover:bg-blue-600 dark:text-white dark:hover:bg-blue-600"
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
    </header>
  );
}
