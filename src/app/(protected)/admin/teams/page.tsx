import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/shared/page-header";
import { getTeamsManagementData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { TeamManagementClient } from "@/components/admin/team-management-client";

export default async function AdminTeamsPage() {
  const [session, { messages }] = await Promise.all([auth(), getRequestI18n()]);
  if (session?.user.role === "CHIEF_JUDGE") {
    redirect("/admin");
  }

  const data = await getTeamsManagementData();
  const t = messages.adminTeams;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <TeamManagementClient
        teams={data.teams}
        competitions={data.competitions}
        categories={data.categories}
        teamAccounts={data.teamAccounts}
        judges={data.judges}
        judgeScope={data.judgeScope}
      />
    </div>
  );
}
