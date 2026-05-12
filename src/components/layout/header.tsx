"use client";

import { LogOut } from "lucide-react";

import { logoutAction } from "@/actions/auth";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/shared/badge";

export function Header({
  userName,
  role,
}: {
  userName: string;
  role: "ADMIN" | "JUDGE" | "TEAM";
}) {
  const { messages } = useI18n();
  const tone = role === "ADMIN" ? "blue" : role === "JUDGE" ? "green" : "amber";
  const label = messages.header.role[role];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
      <div className="space-y-1">
        <p className="text-xs text-slate-500 sm:text-sm">{messages.header.signedInAs}</p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="max-w-[52vw] truncate text-base font-semibold text-slate-950 sm:max-w-none sm:text-lg">
            {userName}
          </h2>
          <Badge tone={tone}>{label}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="gap-2 px-3 sm:px-4">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{messages.header.signOut}</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
