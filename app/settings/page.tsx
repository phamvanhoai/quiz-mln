"use client";

import { useEffect, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { googleAiModels } from "@/lib/google-models";
import { defaultSettings, useAppSettings } from "@/lib/settings";
import { useQuizStore } from "@/lib/store";

export default function SettingsPage() {
  const store = useQuizStore();
  const { loaded, settings, save } = useAppSettings();
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loaded) setDraft(settings);
  }, [loaded, settings]);

  function update(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function saveSettings() {
    save(draft);
    setMessage("Đã lưu cấu hình. Restart dev server hoặc refresh trang để Supabase sync dùng cấu hình mới.");
  }

  function clearSettings() {
    const empty = { ...defaultSettings };
    setDraft(empty);
    save(empty);
    setMessage("Đã xóa cấu hình local.");
  }

  return (
    <AppShell dark={store.dark} onToggleDark={store.toggleDark}>
      <PageTitle
        title="Cấu hình"
        description="Nhập API key ngay trên web. Các giá trị này lưu trong localStorage của trình duyệt và được ưu tiên hơn .env."
      />
      <section className="panel max-w-3xl p-5">
        <div className="grid gap-5">
          <Field
            label="Google AI API key"
            placeholder="AIza..."
            type="password"
            value={draft.googleAiApiKey}
            onChange={(value) => update("googleAiApiKey", value)}
          />
          <Field
            label="Google AI model"
            placeholder="gemini-2.5-flash"
            value={draft.googleAiModel}
            onChange={(value) => update("googleAiModel", value)}
            suggestions={googleAiModels.map((model) => `${model.label} (${model.value})`)}
            normalizeSuggestion={(value) => {
              const match = value.match(/\(([^)]+)\)$/);
              return match?.[1] ?? value;
            }}
          />
          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <div className="mb-3 text-sm font-semibold">Supabase</div>
            <div className="grid gap-4">
              <Field
                label="Supabase URL"
                placeholder="https://xxx.supabase.co"
                value={draft.supabaseUrl}
                onChange={(value) => update("supabaseUrl", value)}
              />
              <Field
                label="Supabase publishable key"
                placeholder="sb_publishable_..."
                type="password"
                value={draft.supabasePublishableKey}
                onChange={(value) => update("supabasePublishableKey", value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={saveSettings} type="button">
            Lưu cấu hình
          </button>
          <button className="btn-secondary" onClick={clearSettings} type="button">
            Xóa cấu hình
          </button>
        </div>
        {message ? <div className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{message}</div> : null}
        <p className="mt-4 text-sm text-zinc-500">
          Không nhập database password ở đây. Password chỉ dùng cho script tạo bảng, không nên lưu trong trình duyệt.
        </p>
      </section>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  suggestions,
  normalizeSuggestion
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  suggestions?: string[];
  normalizeSuggestion?: (value: string) => string;
}) {
  const listId = suggestions?.length ? `${label.replace(/\s+/g, "-").toLowerCase()}-list` : undefined;
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="focus-ring rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
        list={listId}
        onChange={(event) => onChange(normalizeSuggestion ? normalizeSuggestion(event.target.value) : event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
