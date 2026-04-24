import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressBar } from "@/components/shared/progress-bar";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
import { getJudgeTeamsData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

export default async function JudgeTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { locale, messages } = await getRequestI18n();
  const params = await searchParams;
  const selectedCompetitionId = typeof params.competitionId === "string" ? params.competitionId : "";
  const selectedCategoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const data = await getJudgeTeamsData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  const t = messages.judgeTeams;
  const common = messages.common;
  const filteredCategories = data.categories.filter(
    (category) => !selectedCompetitionId || category.competitionId === selectedCompetitionId,
  );

  const filteredTeams = data.visibleTeams.filter((team) => {
    const matchCompetition = !selectedCompetitionId || team.competitionId === selectedCompetitionId;
    const matchCategory = !selectedCategoryId || team.categoryId === selectedCategoryId;
    return matchCompetition && matchCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <CardContent className="space-y-3">
          <form className="grid gap-4 md:grid-cols-3">
            <select
              name="competitionId"
              defaultValue={selectedCompetitionId}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.allCompetitions}</option>
              {data.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
            <select
              name="categoryId"
              defaultValue={selectedCategoryId}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.allCategories}</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {selectedCompetitionId ? category.name : `${category.competitionName} / ${category.name}`}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">{t.applyFilters}</button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{t.completionProgress}</span>
            <span>
              {filteredTeams.filter((team) => team.status === "SUBMITTED" || team.status === "EDITED").length}/{filteredTeams.length} {t.teamsSubmitted}
            </span>
          </div>
          <ProgressBar
            value={
              filteredTeams.length
                ? Math.round(
                    (filteredTeams.filter((team) => team.status === "SUBMITTED" || team.status === "EDITED").length /
                      filteredTeams.length) *
                      100,
                  )
                : 0
            }
            className="h-3"
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.teamId}</TH>
                  <TH>{t.teamName}</TH>
                  <TH>{t.category}</TH>
                  <TH>{t.projectTitle}</TH>
                  <TH>{t.status}</TH>
                  <TH>{t.updated}</TH>
                  <TH>{t.action}</TH>
                </tr>
              </THead>
              <TBody>
                {filteredTeams.map((team) => (
                  <tr key={team.id}>
                    <TD>{team.teamCode}</TD>
                    <TD className="font-medium text-slate-950">{team.teamName}</TD>
                    <TD>
                      <div className="font-medium text-slate-950">{team.competitionName}</div>
                      <div className="text-xs text-slate-500">{team.categoryName}</div>
                    </TD>
                    <TD>{team.projectTitle}</TD>
                    <TD>
                      <Badge tone={team.status === "SUBMITTED" ? "green" : team.status === "DRAFT" ? "amber" : team.status === "EDITED" ? "blue" : "slate"}>
                        {team.status === "PENDING" ? common.statuses.pending : common.statuses[team.status.toLowerCase() as "draft" | "submitted" | "edited"]}
                      </Badge>
                    </TD>
                    <TD>{formatRelativeTime(team.updatedAt, locale)}</TD>
                    <TD>
                      <Link href={`/judge/teams/${team.id}`} className="text-sm font-medium text-sky-700">
                        {team.status === "PENDING" ? t.score : t.edit}
                      </Link>
                    </TD>
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
