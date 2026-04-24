import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bar";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
import { getJudgeDashboardData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

export default async function JudgeDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { locale, messages } = await getRequestI18n();
  const data = await getJudgeDashboardData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  const t = messages.judgeDashboard;
  const common = messages.common;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Link
            href="/judge/teams"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white visited:!text-white hover:!text-white"
          >
            {t.openTeamList}
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.assignedTeamsLabel} value={data.stats.assignedCount} help={t.assignedTeamsHelp} />
        <StatCard label={t.submittedLabel} value={data.stats.submittedCount} help={t.submittedHelp} />
        <StatCard label={t.draftsLabel} value={data.stats.draftCount} help={t.draftsHelp} />
        <StatCard label={t.pendingLabel} value={data.stats.pendingCount} help={t.pendingHelp} />
      </div>
      <Card>
        <CardHeader title={t.completionTitle} description={`${data.stats.submittedCount}/${data.stats.assignedCount} ${t.completionDesc}`} />
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>{t.overallProgress}</span>
            <span>{data.stats.completionRate}%</span>
          </div>
          <ProgressBar value={data.stats.completionRate} className="h-3" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t.approvedWorksTitle} description={t.approvedWorksDesc} />
        <CardContent className="p-0">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.teamId}</TH>
                  <TH>{t.work}</TH>
                  <TH>{t.category}</TH>
                  <TH>{t.status}</TH>
                  <TH>{t.updated}</TH>
                  <TH>{t.action}</TH>
                </tr>
              </THead>
              <TBody>
                {data.visibleTeams.map((team) => (
                  <tr key={team.id}>
                    <TD>{team.teamCode}</TD>
                    <TD>
                      <div className="font-medium text-slate-950">{team.teamName}</div>
                      <div className="text-xs text-slate-500">{team.projectTitle}</div>
                    </TD>
                    <TD>
                      <div className="font-medium text-slate-950">{team.competitionName}</div>
                      <div className="text-xs text-slate-500">{team.categoryName}</div>
                    </TD>
                    <TD>
                      <Badge tone={team.status === "SUBMITTED" ? "green" : team.status === "DRAFT" ? "amber" : team.status === "EDITED" ? "blue" : "slate"}>
                        {team.status === "PENDING" ? common.statuses.pending : messages.common.statuses[team.status.toLowerCase() as "draft" | "submitted" | "edited"]}
                      </Badge>
                    </TD>
                    <TD>{formatRelativeTime(team.updatedAt, locale)}</TD>
                    <TD>
                      <Link href={`/judge/teams/${team.id}`} className="text-sm font-medium text-sky-700">
                        {team.status === "PENDING" ? t.startScoring : t.open}
                      </Link>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t.recentActivityTitle} description={t.recentActivityDesc} />
        <CardContent className="space-y-4">
          {data.recentScores.map((score) => (
            <div key={score.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <div>
                <div className="font-medium text-slate-950">{score.team.teamName}</div>
                <div className="text-sm text-slate-500">
                  {score.team.category?.competition?.name ?? common.labels.notSet} / {score.team.category?.name ?? common.labels.uncategorized} · {score.team.projectTitle}
                </div>
              </div>
              <div className="text-right">
                <Badge tone={score.status === "DRAFT" ? "amber" : score.status === "EDITED" ? "blue" : "green"}>
                  {messages.common.statuses[score.status.toLowerCase() as "draft" | "submitted" | "edited"]}
                </Badge>
                <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(score.updatedAt, locale)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
