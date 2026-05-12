"use client";

import { useCallback, useSyncExternalStore } from "react";

import { formatRelativeTime } from "@/lib/utils";

const serverSnapshot = () => "";

export function RelativeTime({
  date,
  locale = "en",
  className,
}: {
  date: Date | string | null | undefined;
  locale?: "en" | "zh";
  className?: string;
}) {
  const getSnapshot = useCallback(() => formatRelativeTime(date, locale), [date, locale]);
  const subscribe = useCallback((callback: () => void) => {
    const timeoutId = window.setTimeout(callback, 0);
    const intervalId = window.setInterval(callback, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);
  const label = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
