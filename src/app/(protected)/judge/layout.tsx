import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([
    auth(),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "JUDGE") {
    redirect(session.user.role === "TEAM" ? "/team" : "/admin");
  }

  return (
    <AppShell
      role="JUDGE"
      userName={session.user.name ?? session.user.email ?? "Judge"}
      competitionName={settings?.competitionName ?? "Competition"}
    >
      {children}
    </AppShell>
  );
}
