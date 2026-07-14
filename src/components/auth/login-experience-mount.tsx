"use client";

import { LoginExperience } from "@/components/auth/login-experience";

export function LoginExperienceMount({ supportEmail }: { supportEmail: string }) {
  return <LoginExperience supportEmail={supportEmail} />;
}
