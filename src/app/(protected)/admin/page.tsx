import Link from "next/link";

import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getAdminDashboardData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const { locale, messages } = await getRequestI18n();
  const data = await getAdminDashboardData();
  const t = messages.adminDashboard;

  const stats = [
    { label: t.statTeamAccountsLabel, value: data.stats[0]?.value ?? 0, help: t.statTeamAccountsHelp },
    { label: t.statApprovedLabel, value: data.stats[1]?.value ?? 0, help: t.statApprovedHelp },
    { label: t.statPendingApprovalLabel, value: data.stats[2]?.value ?? 0, help: t.statPendingApprovalHelp },
    { label: t.statSubmittedScoresLabel, value: data.stats[3]?.value ?? "0/0", help: t.statSubmittedScoresHelp },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} help={stat.help} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader
            title={t.leaderboardPreviewTitle}
            description={t.leaderboardPreviewDesc}
            action={
              <Link href="/admin/leaderboard" className="text-sm font-medium text-sky-700">
                {t.openFullLeaderboard}
              </Link>
            }
          />
          <CardContent className="p-0">
            <Table>
              <DataTable>
                <THead>
                <tr>
                  <TH>{t.rank}</TH>
                  <TH>{t.team}</TH>
                  <TH>{messages.common.words.average}</TH>
                  <TH>{t.progress}</TH>
                </tr>
                </THead>
                <TBody>
                  {data.leaderboard.map((team, index) => (
                    <tr key={team.id}>
                      <TD className="font-semibold text-slate-950">#{index + 1}</TD>
                      <TD>
                        <div className="font-medium text-slate-950">{team.teamName}</div>
                        <div className="text-xs text-slate-500">
                          {team.categoryName} · {team.projectTitle}
                        </div>
                      </TD>
                      <TD>{team.averageScore.toFixed(2)}</TD>
                      <TD>
                        <Badge tone={team.submittedCount === team.expectedCount ? "green" : "amber"}>
                          {team.submittedCount}/{team.expectedCount} {t.submittedShort}
                        </Badge>
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
          {data.recentAudits.map((audit) => (
            <div key={audit.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <p className="font-medium capitalize text-slate-950">{audit.action.replaceAll("_", " ")}</p>
                  <p className="text-xs text-slate-500">{formatRelativeTime(audit.createdAt, locale)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {audit.actor} {t.activityUpdatedBy} <span className="font-medium text-slate-900">{audit.team}</span> {t.inCategory} {audit.category}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader title={t.categoryLeadersTitle} description={t.categoryLeadersDesc} />
        <CardContent className="grid gap-4 md:grid-cols-3">
          {data.categorySummary.map((category) => (
            <div key={category.categoryName} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{category.categoryName}</p>
              <p className="mt-2 font-semibold text-slate-950">{category.leader}</p>
              <p className="mt-1 text-sm text-slate-500">{messages.common.words.average} {category.averageScore.toFixed(2)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t.judgeProgressTitle} description={t.judgeProgressDesc} />
        <CardContent className="p-0">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.judge}</TH>
                  <TH>{t.assigned}</TH>
                  <TH>{t.drafts}</TH>
                  <TH>{t.submitted}</TH>
                  <TH>{t.pending}</TH>
                  <TH>{t.lastActivity}</TH>
                </tr>
              </THead>
              <TBody>
                {data.judgeProgress.map((judge) => (
                  <tr key={judge.id}>
                    <TD className="font-medium text-slate-950">{judge.name}</TD>
                    <TD>{judge.assignedTeams}</TD>
                    <TD>{judge.draftCount}</TD>
                    <TD>{judge.submittedCount}</TD>
                    <TD>{judge.pendingCount}</TD>
                    <TD>{formatRelativeTime(judge.lastActivity, locale)}</TD>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
