"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  dictionaries,
  type Locale,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  messages: (typeof dictionaries)[Locale];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const router = useRouter();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale === "zh" ? "zh-Hant" : "en";

    if (hasMountedRef.current) {
      router.refresh();
      return;
    }

    hasMountedRef.current = true;
  }, [locale, router]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      messages: dictionaries[locale],
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }

  return context;
}
