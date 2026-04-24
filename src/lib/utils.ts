import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(
  date: Date | string | null | undefined,
  locale: "en" | "zh" = "en",
) {
  if (!date) {
    return locale === "zh" ? "\u5f9e\u672a" : "Never";
  }

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return locale === "zh" ? "\u5f9e\u672a" : "Never";
  }

  const seconds = Math.round((value.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale === "zh" ? "zh-Hant" : "en", { numeric: "always" });
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

  let duration = seconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatter.format(Math.round(duration), "year");
}

export function parseMembers(value: string) {
  return value
    .split("\n")
    .map((member) => member.trim())
    .filter(Boolean);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getVideoEmbedUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function csvEscape(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

