import { PageHeader } from "@/components/shared/page-header";
import { getTeamsManagementData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { TeamManagementClient } from "@/components/admin/team-management-client";

export default async function AdminTeamsPage() {
  const { messages } = await getRequestI18n();
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
