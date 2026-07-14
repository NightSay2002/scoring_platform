import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginClientShell } from "@/components/auth/login-client-shell";
import { prisma } from "@/lib/prisma";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" || session.user.role === "CHIEF_JUDGE" ? "/admin" : session.user.role === "JUDGE" ? "/judge" : "/team");
  }

  const fallbackAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || fallbackAdmin?.email || "admin@techscore.local";
  return <LoginClientShell supportEmail={supportEmail} />;
}
