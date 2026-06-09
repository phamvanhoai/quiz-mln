"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { getConfiguredSupabaseClient, useAuthUser } from "@/lib/auth";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useAuthUser();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:flex">
      <aside className="border-b border-zinc-800 bg-black lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-bold text-zinc-950">A</div>
            <div>
              <div className="font-bold tracking-tight">Admin Panel</div>
              <div className="text-xs text-zinc-500">Quiz MLN111</div>
            </div>
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-5 pb-5 lg:grid">
          <Link className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950" href="/admin">
            Tổng quan
          </Link>
          <Link className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white" href="/sets">
            Quản lý bộ đề
          </Link>
          <Link className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white" href="/">
            Về app học
          </Link>
        </nav>
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
            {user ? (
              <div className="grid gap-2">
                <div className="truncate font-medium text-zinc-100">{user.email}</div>
                <button
                  className="text-left font-medium text-red-400"
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
              <Link className="font-medium text-blue-400" href="/login">
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
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-zinc-400">{description}</p> : null}
    </header>
  );
}
