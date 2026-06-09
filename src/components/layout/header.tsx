"use client";

import { useState } from "react";
import { LogOut, X } from "lucide-react";

import { logoutAction } from "@/actions/auth";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import type { RecentActivity, ShellRole } from "@/components/layout/app-shell";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/shared/badge";
import { formatRelativeTime } from "@/lib/utils";

export function Header({
  userName,
  role,
  recentActivity,
}: {
  userName: string;
  role: ShellRole;
  recentActivity?: RecentActivity[];
}) {
  const { locale, messages } = useI18n();
  const [activityOpen, setActivityOpen] = useState(false);
  const tone = role === "ADMIN" ? "blue" : role === "CHIEF_JUDGE" ? "purple" : role === "JUDGE" ? "green" : "amber";
  const label = messages.header.role[role];
  const activityItems = recentActivity ?? [];
  const canOpenActivity = role === "ADMIN" && Boolean(recentActivity);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
      <div className="space-y-1">
        <p className="text-xs text-slate-500 sm:text-sm">{messages.header.signedInAs}</p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="max-w-[52vw] truncate text-base font-semibold text-slate-950 sm:max-w-none sm:text-lg">
            {userName}
          </h2>
          {canOpenActivity ? (
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600 opacity-75 transition hover:bg-sky-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
              aria-label={messages.header.openRecentActivity}
            >
              ({label})
            </button>
          ) : (
            <Badge tone={tone}>{label}</Badge>
          )}
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
      {canOpenActivity && activityOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setActivityOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-activity-title"
            className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="recent-activity-title" className="text-base font-semibold text-slate-950">
                  {messages.adminDashboard.recentActivityTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{messages.adminDashboard.recentActivityDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                aria-label={messages.header.closeRecentActivity}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[64vh] space-y-3 overflow-y-auto p-5 [scrollbar-width:thin]">
              {activityItems.length ? (
                activityItems.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <p className="font-medium capitalize text-slate-950">{activity.action.replaceAll("_", " ")}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(activity.createdAt, locale)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {activity.actor} {messages.adminDashboard.activityUpdatedBy} <span className="font-medium text-slate-900">{activity.team}</span>{" "}
                      {messages.adminDashboard.inCategory} {activity.category}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{messages.common.labels.noData}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
