import Link from "next/link";

import { JudgeScoreCards } from "@/components/admin/judge-score-cards";
import { ScoringParticipantsButton } from "@/components/admin/scoring-participants-button";
import { ScoringToggleButton } from "@/components/admin/scoring-toggle-button";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bar";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
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
  const data = await getLeaderboardData(competitionId);
  const t = messages.adminLeaderboard;

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
              labels={{
                manageScorers: t.manageScorers,
                scoringParticipantsTitle: t.scoringParticipantsTitle,
                scoringParticipantsDesc: t.scoringParticipantsDesc,
                canScore: t.canScore,
                cannotScore: t.cannotScore,
                adminRole: messages.header.role.ADMIN,
                judgeRole: messages.header.role.JUDGE,
                scorerUpdated: t.scorerUpdated,
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
        <CardContent className="p-0">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.rank}</TH>
                  <TH>{t.team}</TH>
                  <TH>{t.average}</TH>
                  <TH>{t.progress}</TH>
                  <TH>{t.pendingJudges}</TH>
                  <TH>{t.perJudgeScores}</TH>
                </tr>
              </THead>
              <TBody>
                {data.overallRows.map((row) => (
                  <tr key={row.id}>
                    <TD className="font-semibold text-slate-950">#{row.rank}</TD>
                    <TD>
                      <div className="font-medium text-slate-950">
                        {row.teamName} <span className="text-slate-400">({row.teamCode})</span>
                      </div>
                      <div className="text-xs text-slate-500">{row.projectTitle}</div>
                    </TD>
                    <TD>{row.averageScore.toFixed(2)}</TD>
                    <TD className="min-w-[180px]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {row.submittedCount}/{row.expectedCount} {t.submittedShort}
                          </span>
                          <span>{row.completionRate}%</span>
                        </div>
                        <ProgressBar value={row.completionRate} />
                      </div>
                    </TD>
                    <TD>
                      {row.pendingJudgeNames.length ? (
                        <div className="flex flex-wrap gap-2">
                          {row.pendingJudgeNames.map((judgeName) => (
                            <Badge key={judgeName} tone="amber">
                              {judgeName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge tone="green">{t.complete}</Badge>
                      )}
                    </TD>
                    <TD>
                      <JudgeScoreCards
                        judges={row.perJudgeScores}
                        ariaLabel={t.perJudgeScores}
                        labels={{
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
                        }}
                      />
                    </TD>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </Table>
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
            <Table>
              <DataTable>
                <THead>
                  <tr>
                    <TH>{t.rank}</TH>
                    <TH>{t.team}</TH>
                    <TH>{t.average}</TH>
                    <TH>{t.progress}</TH>
                    <TH>{t.pendingJudges}</TH>
                  </tr>
                </THead>
                <TBody>
                  {section.rows.map((row) => (
                    <tr key={row.id}>
                      <TD className="font-semibold text-slate-950">#{row.rank}</TD>
                      <TD>
                        <div className="font-medium text-slate-950">
                          {row.teamName} <span className="text-slate-400">({row.teamCode})</span>
                        </div>
                        <div className="text-xs text-slate-500">{row.projectTitle}</div>
                      </TD>
                      <TD>{row.averageScore.toFixed(2)}</TD>
                      <TD className="min-w-[180px]">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>
                              {row.submittedCount}/{row.expectedCount} {t.submittedShort}
                            </span>
                            <span>{row.completionRate}%</span>
                          </div>
                          <ProgressBar value={row.completionRate} />
                        </div>
                      </TD>
                      <TD>
                        {row.pendingJudgeNames.length ? (
                          <div className="flex flex-wrap gap-2">
                            {row.pendingJudgeNames.map((judgeName) => (
                              <Badge key={judgeName} tone="amber">
                                {judgeName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge tone="green">{t.complete}</Badge>
                        )}
                      </TD>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
