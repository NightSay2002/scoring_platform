"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, FolderOpen, ListChecks, Settings, Trophy, Upload, Users } from "lucide-react";

import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey:
    | "dashboard"
    | "teams"
    | "comments"
    | "leaderboard"
    | "settings"
    | "approvedWorks"
    | "mySubmission"
    | "reviewStatus";
  icon: React.ComponentType<{ className?: string }>;
};

const adminItems: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: BarChart3 },
  { href: "/admin/teams", labelKey: "teams", icon: Users },
  { href: "/admin/comments", labelKey: "comments", icon: ClipboardList },
  { href: "/admin/leaderboard", labelKey: "leaderboard", icon: Trophy },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
];

const judgeItems: NavItem[] = [
  { href: "/judge", labelKey: "dashboard", icon: BarChart3 },
  { href: "/judge/teams", labelKey: "approvedWorks", icon: ListChecks },
];

const teamItems: NavItem[] = [
  { href: "/team", labelKey: "dashboard", icon: BarChart3 },
  { href: "/team/submission", labelKey: "mySubmission", icon: Upload },
  { href: "/team/results", labelKey: "reviewStatus", icon: FolderOpen },
];

export function Sidebar({
  role,
  competitionName,
}: {
  role: "ADMIN" | "JUDGE" | "TEAM";
  competitionName: string;
}) {
  const pathname = usePathname();
  const { messages } = useI18n();
  const items = role === "ADMIN" ? adminItems : role === "JUDGE" ? judgeItems : teamItems;

  return (
    <aside className="flex min-h-screen w-full max-w-[260px] flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.24em] text-sky-300">TechScore</p>
        <h1 className="mt-2 text-lg font-semibold leading-tight">{competitionName}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {messages.sidebar.workspace[role]}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {messages.sidebar.nav[item.labelKey]}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
