import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginExperienceMount } from "@/components/auth/login-experience-mount";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : session.user.role === "JUDGE" ? "/judge" : "/team");
  }

  return <LoginExperienceMount />;
}
