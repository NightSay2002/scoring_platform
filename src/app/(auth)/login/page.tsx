import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginClientShell } from "@/components/auth/login-client-shell";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" || session.user.role === "CHIEF_JUDGE" ? "/admin" : session.user.role === "JUDGE" ? "/judge" : "/team");
  }

  return <LoginClientShell />;
}
