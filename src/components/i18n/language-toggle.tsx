"use client";

import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n/language-provider";

export function LanguageToggle({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  const { locale, setLocale, messages } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border p-1",
        dark ? "border-white/15 bg-black/30" : "border-slate-200 bg-white",
        className,
      )}
      role="group"
      aria-label={messages.language.label}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          locale === "en"
            ? dark
              ? "bg-white/15 text-white"
              : "bg-slate-900 text-white"
            : dark
              ? "text-slate-300 hover:bg-white/10 hover:text-white"
              : "text-slate-600 hover:bg-slate-100",
        )}
      >
        {messages.language.english}
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          locale === "zh"
            ? dark
              ? "bg-white/15 text-white"
              : "bg-slate-900 text-white"
            : dark
              ? "text-slate-300 hover:bg-white/10 hover:text-white"
              : "text-slate-600 hover:bg-slate-100",
        )}
      >
        {messages.language.chinese}
      </button>
    </div>
  );
}

