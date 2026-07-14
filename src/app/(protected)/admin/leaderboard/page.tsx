import Link from "next/link";

import { LeaderboardTable } from "@/components/admin/leaderboard-table";
import { ScoringParticipantsButton } from "@/components/admin/scoring-participants-button";
import { ScoringToggleButton } from "@/components/admin/scoring-toggle-button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { getLeaderboardData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function AdminLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { messages } = await getRequestI18n();
  const params = await searchParams;
  const competitionId = typeof params.competitionId === "string" ? params.competitionId : undefined;
  const judgeId = typeof params.judgeId === "string" ? params.judgeId : undefined;
  const data = await getLeaderboardData(competitionId, judgeId);
  const t = messages.adminLeaderboard;
  const scoreCardLabels = {
    pending: t.pending,
    clickForDetails: t.clickForDetails,
    detailsTitle: t.detailsTitle,
    judge: t.judge,
    status: t.status,
    score: t.score,
    updated: t.updated,
    overallComment: t.overallComment,
    criterionBreakdown: t.criterionBreakdown,
    criterionComment: t.criterionComment,
    noComment: messages.common.labels.noComment,
    noData: messages.common.labels.noData,
    close: t.close,
    statuses: {
      draft: messages.common.statuses.draft,
      submitted: messages.common.statuses.submitted,
      edited: messages.common.statuses.edited,
      pending: messages.common.statuses.pending,
    },
  };
  const leaderboardTableLabels = {
    rank: t.rank,
    seq: t.seq,
    team: t.team,
    average: t.average,
    progress: t.progress,
    pendingJudges: t.pendingJudges,
    perJudgeScores: t.perJudgeScores,
    scoreDetails: t.scoreDetails,
    submittedShort: t.submittedShort,
    complete: t.complete,
    minAverage: t.minAverage,
    maxAverage: t.maxAverage,
    noData: messages.common.labels.noData,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Link
            href={
              data.selectedCompetitionId
                ? `/api/export/results?competitionId=${encodeURIComponent(data.selectedCompetitionId)}`
                : "/api/export/results"
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            {t.exportCsv}
          </Link>
        }
      />
      <Card>
        <CardContent className="py-4">
          <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            <label htmlFor="competitionId" className="text-sm font-medium text-slate-700">
              {t.competitionLabel}
            </label>
            <select
              id="competitionId"
              name="competitionId"
              defaultValue={data.selectedCompetitionId}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 sm:min-w-[260px] sm:w-auto"
            >
              {data.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white sm:w-auto">{t.applyCompetition}</button>
            <ScoringParticipantsButton
              competitionId={data.selectedCompetitionId}
              participants={data.scoringParticipants}
              categories={data.categorySections.map((category) => ({ id: category.id, name: category.name }))}
              labels={{
                manageScorers: t.manageScorers,
                scoringParticipantsTitle: t.scoringParticipantsTitle,
                scoringParticipantsDesc: t.scoringParticipantsDesc,
                canScore: t.canScore,
                cannotScore: t.cannotScore,
                adminRole: messages.header.role.ADMIN,
                chiefJudgeRole: messages.header.role.CHIEF_JUDGE,
                judgeRole: messages.header.role.JUDGE,
                scorerUpdated: t.scorerUpdated,
                awardCategories: t.awardCategories,
                categoryAssignmentsDesc: t.categoryAssignmentsDesc,
                assignmentUpdated: t.assignmentUpdated,
                noCategoryAssigned: t.noCategoryAssigned,
                stalePageRefresh: t.stalePageRefresh,
                close: t.close,
              }}
            />
            <ScoringToggleButton
              isClosed={data.scoringAvailability.scoringClosed}
              competitionId={data.selectedCompetitionId}
              competitionUpdatedAt={data.selectedCompetitionUpdatedAt}
              labels={{
                endCompetition: t.endCompetition,
                continueCompetition: t.continueCompetition,
                competitionEnded: t.competitionEnded,
                competitionContinued: t.competitionContinued,
                stalePageRefresh: t.stalePageRefresh,
              }}
            />
          </form>
        </CardContent>
      </Card>
      {!data.settings?.showLeaderboard ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">{t.hiddenBanner}</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader title={t.overallTitle} description={t.overallDesc} />
        <CardContent>
          <LeaderboardTable
            rows={data.overallRows}
            labels={leaderboardTableLabels}
            scoreCardLabels={scoreCardLabels}
            showProgress
            showPendingJudges
            showPerJudgeScores
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t.judgeRankingTitle} description={t.judgeRankingDesc} />
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {data.selectedCompetitionId ? <input type="hidden" name="competitionId" value={data.selectedCompetitionId} /> : null}
            <div className="space-y-2">
              <label htmlFor="judgeId" className="text-sm font-medium text-slate-700">
                {t.judgeRankingJudgeLabel}
              </label>
              <select
                id="judgeId"
                name="judgeId"
                defaultValue={data.selectedJudgeRankingId}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 sm:min-w-[260px] sm:w-auto"
              >
                {data.judgeRankingOptions.map((judge) => (
                  <option key={judge.id} value={judge.id}>
                    {judge.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white sm:w-auto">{t.applyJudge}</button>
          </form>
          <LeaderboardTable
            rows={data.judgeRankingRows}
            labels={leaderboardTableLabels}
            scoreCardLabels={scoreCardLabels}
            showScoreDetails
          />
        </CardContent>
      </Card>
      {data.categorySections.map((section) => (
        <Card key={section.id}>
          <CardHeader
            title={`${section.name} ${t.categoryRankingSuffix}`}
            description={section.description ?? t.categoryFallbackDesc}
          />
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((index) => {
                const item = section.podium[index];

                return (
                  <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{index + 1} {t.place}</p>
                    <p className="mt-2 font-semibold text-slate-950">{item?.teamName ?? "-"}</p>
                    <p className="mt-1 text-sm text-slate-500">{item?.projectTitle ?? t.noApprovedSubmissionYet}</p>
                    <p className="mt-3 text-sm font-medium text-slate-700">{item ? `${messages.common.words.average} ${item.averageScore.toFixed(2)}` : ""}</p>
                  </div>
                );
              })}
            </div>
            <LeaderboardTable
              rows={section.rows}
              labels={leaderboardTableLabels}
              scoreCardLabels={scoreCardLabels}
              showProgress
              showPendingJudges
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
