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
  const isActive = (href: string) => {
    if (href === "/sets") return pathname === "/sets" || pathname.startsWith("/study") || pathname.startsWith("/exam");
    return pathname === href;
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-zinc-200 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/80 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:block lg:px-6">
          <Link href="/" className="block">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-white dark:bg-white dark:text-zinc-950">
                Q
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">Quiz MLN111</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Word/PDF local quiz</div>
              </div>
            </div>
          </Link>
          <button
            className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            onClick={onToggleDark}
            type="button"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4 lg:block lg:px-6">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                className={cn(
                  "focus-ring block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-zinc-950 text-white shadow-sm hover:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
    </header>
  );
}
