import { Header } from "@/components/layout/header";
import { MobileRoleNav, Sidebar } from "@/components/layout/sidebar";

export type ShellRole = "ADMIN" | "CHIEF_JUDGE" | "JUDGE" | "TEAM";
export type RecentActivity = {
  id: string;
  action: string;
  actor: string;
  team: string;
  category: string;
  createdAt: string;
};

export function AppShell({
  children,
  userName,
  role,
  competitionName,
  recentActivity,
}: {
  children: React.ReactNode;
  userName: string;
  role: ShellRole;
  competitionName: string;
  recentActivity?: RecentActivity[];
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role={role} competitionName={competitionName} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header userName={userName} role={role} recentActivity={recentActivity} />
        <div className="border-b border-slate-200 bg-slate-100 lg:hidden">
          <MobileRoleNav role={role} />
        </div>
        <main className="flex-1 p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
