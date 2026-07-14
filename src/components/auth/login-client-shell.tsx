"use client";

import { LoginExperienceMount } from "@/components/auth/login-experience-mount";

export function LoginClientShell({ supportEmail }: { supportEmail: string }) {
  return <LoginExperienceMount supportEmail={supportEmail} />;
}
