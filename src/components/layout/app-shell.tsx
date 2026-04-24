import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({
  children,
  userName,
  role,
  competitionName,
}: {
  children: React.ReactNode;
  userName: string;
  role: "ADMIN" | "JUDGE" | "TEAM";
  competitionName: string;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role={role} competitionName={competitionName} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header userName={userName} role={role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
