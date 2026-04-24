import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getTeamPortalData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function TeamResultsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const data = await getTeamPortalData(session.user.id);

  if (!data) {
    redirect("/login");
  }
  const { messages } = await getRequestI18n();
  const t = messages.teamResults;
  const common = messages.common;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      {data.team.scores.length === 0 ? (
        <EmptyState
          title={t.noJudgeScoresTitle}
          description={t.noJudgeScoresDesc}
        />
      ) : (
        <Card>
          <CardHeader title={t.judgeActivityTitle} description={t.judgeActivityDesc} />
          <CardContent className="space-y-3">
            {data.team.scores.map((score) => (
              <div key={score.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-medium text-slate-950">{score.judgeName}</p>
                  <p className="text-sm text-slate-500">{t.averageScore} {score.averageScore.toFixed(2)}</p>
                </div>
                <Badge tone={score.status === "DRAFT" ? "amber" : score.status === "EDITED" ? "blue" : "green"}>
                  {common.statuses[score.status.toLowerCase() as "draft" | "submitted" | "edited"]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
