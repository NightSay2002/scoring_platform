import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";

export default async function TeamLayout({
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

  if (session.user.role !== "TEAM") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/judge");
  }

  return (
    <AppShell
      role="TEAM"
      userName={session.user.name ?? session.user.email ?? "Team"}
      competitionName={settings?.competitionName ?? "Competition"}
    >
      {children}
    </AppShell>
  );
}
