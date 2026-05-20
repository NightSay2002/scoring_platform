import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(session.user.role === "ADMIN" || session.user.role === "CHIEF_JUDGE" ? "/admin" : session.user.role === "JUDGE" ? "/judge" : "/team");
}
