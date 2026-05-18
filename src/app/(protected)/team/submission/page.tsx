import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/shared/page-header";
import { TeamSubmissionForm } from "@/components/team/team-submission-form";
import { getTeamPortalData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function TeamSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const competitionId = typeof params.competitionId === "string" ? params.competitionId : undefined;
  const data = await getTeamPortalData(session.user.id, competitionId);

  if (!data) {
    redirect("/login");
  }
  const { messages } = await getRequestI18n();
  const t = messages.teamSubmission;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <TeamSubmissionForm
        key={data.selectedCompetitionId}
        competitions={data.competitions}
        categories={data.categories}
        team={data.team}
      />
    </div>
  );
}
