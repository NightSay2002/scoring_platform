import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getTeamPortalData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

export default async function TeamDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { locale, messages } = await getRequestI18n();
  const data = await getTeamPortalData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  const t = messages.teamDashboard;
  const common = messages.common;
  const tone =
    data.team.submissionStatus === "APPROVED"
      ? "green"
      : data.team.submissionStatus === "PENDING"
        ? "blue"
        : data.team.submissionStatus === "REJECTED"
          ? "rose"
          : "amber";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Link href={`/team/submission?competitionId=${data.selectedCompetitionId}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {t.openSubmission}
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t.submissionStatusLabel}
          value={common.statuses[data.team.submissionStatus.toLowerCase() as "draft" | "pending" | "approved" | "rejected"]}
          help={t.submissionStatusHelp}
        />
        <StatCard label={t.categoryLabel} value={data.team.categoryName || common.labels.notSet} help={t.categoryHelp} />
        <StatCard label={t.judgeSubmissionsLabel} value={data.team.stats.submittedJudgeCount} help={t.judgeSubmissionsHelp} />
      </div>
      <Card>
        <CardHeader title={t.availableCompetitionsTitle} description={t.availableCompetitionsDesc} />
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.competitions.map((competition) => {
            const submission = data.submissions.find((entry) => entry.competitionId === competition.id);

            return (
              <Link
                key={competition.id}
                href={`/team/submission?competitionId=${competition.id}`}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{competition.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{submission?.projectTitle || t.noSubmissionYet}</p>
                  </div>
                  <Badge tone={submission?.submissionStatus === "APPROVED" ? "green" : submission?.submissionStatus === "PENDING" ? "blue" : submission?.submissionStatus === "REJECTED" ? "rose" : "amber"}>
                    {submission
                      ? common.statuses[submission.submissionStatus.toLowerCase() as "draft" | "pending" | "approved" | "rejected"]
                      : common.statuses.draft}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t.currentSubmissionTitle} description={t.currentSubmissionDesc} />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-xl font-semibold text-slate-950">{data.team.teamName}</h2>
            <Badge tone={tone}>{common.statuses[data.team.submissionStatus.toLowerCase() as "draft" | "pending" | "approved" | "rejected"]}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{t.project}</p>
              <p className="mt-2 font-medium text-slate-950">{data.team.projectTitle}</p>
              <p className="mt-1 text-sm text-slate-500">{data.team.categoryName || t.noCategorySelected}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{t.updated}</p>
              <p className="mt-2 text-sm font-medium text-slate-950">{formatRelativeTime(data.team.updatedAt, locale)}</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-600">{data.team.projectDescription}</p>
          {data.team.reviewNote ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-medium text-rose-900">{t.adminNote}</p>
              <p className="mt-2 whitespace-pre-wrap">{data.team.reviewNote}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
