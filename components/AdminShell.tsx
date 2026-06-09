"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/sets", label: "Quản lý đề" },
  { href: "/admin/users", label: "Quản lý user" },
  { href: "/", label: "Về app học" }
];

export function AdminShell({
  children,
  dark,
  onToggleDark
}: {
  children: ReactNode;
  dark?: boolean;
  onToggleDark?: () => void;
}) {
  const { user } = useAuthUser();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100 lg:flex">
      <aside className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 font-bold text-white dark:bg-white dark:text-zinc-950">A</div>
            <div>
              <div className="font-bold tracking-tight">Admin Panel</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">Quiz MLN111</div>
            </div>
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-5 pb-5 lg:grid">
          {adminNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 pb-5">
          <div className="mb-3 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <span>Giao diện</span>
            <button className="font-medium text-zinc-950 dark:text-zinc-100" onClick={onToggleDark} type="button">
              {dark ? "Light" : "Dark"}
            </button>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {user ? (
              <div className="grid gap-2">
                <div className="truncate font-medium text-zinc-950 dark:text-zinc-100">{user.email}</div>
                <button
                  className="text-left font-medium text-red-500 dark:text-red-400"
                  onClick={async () => {
                    await getConfiguredSupabaseClient()?.auth.signOut();
                    window.location.href = "/login";
                  }}
                  type="button"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <Link className="font-medium text-blue-600 dark:text-blue-400" href="/login">
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </aside>
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

export function AdminTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Administration</div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
    </header>
  );
}
