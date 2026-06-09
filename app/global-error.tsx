"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-950">
          <section className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold">Đã có lỗi xảy ra</h1>
            <p className="mt-2 text-sm text-zinc-600">Vui lòng thử tải lại thao tác hiện tại.</p>
            <button className="mt-4 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white" onClick={reset} type="button">
              Thử lại
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
