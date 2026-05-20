"use client";

import { cn } from "@/lib/utils";

const errorPatterns = [
  "required",
  "invalid",
  "unable",
  "not found",
  "cannot",
  "must",
  "needs",
  "failed",
  "please select",
  "please choose",
  "did not",
  "already",
  "updated by another admin",
  "錯誤",
  "失敗",
  "必須",
  "需要",
  "請選擇",
  "請刷新",
  "無法",
  "不存在",
];

function isErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return errorPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

export function FeedbackMessage({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className={cn("text-sm", isErrorMessage(message) ? "font-medium text-rose-600" : "text-slate-600", className)}>
      {message}
    </p>
  );
}

export function RequiredMark() {
  return (
    <span className="ml-1 text-rose-600" aria-hidden="true">
      *
    </span>
  );
}
