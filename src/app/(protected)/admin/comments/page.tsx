import Link from "next/link";

import { Badge } from "@/components/shared/badge";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
import { getCommentsReviewData } from "@/lib/data";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, messages: allMessages } = await getRequestI18n();
  const messages = allMessages.adminComments;
  const params = await searchParams;
  const teamId = typeof params.teamId === "string" ? params.teamId : undefined;
  const judgeId = typeof params.judgeId === "string" ? params.judgeId : undefined;
  const status = typeof params.status === "string" ? params.status : "ALL";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const query = typeof params.q === "string" ? params.q : undefined;
  const data = await getCommentsReviewData({ teamId, judgeId, status, categoryId, query });
  const statusLabels = {
    DRAFT: messages.draft,
    SUBMITTED: messages.submitted,
    EDITED: messages.edited,
  } as const;
  const totalLabel = `${data.scores.length} ${messages.scoringRecordsFound}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.title}
        description={messages.description}
        action={
          <Link
            href="/api/export/comments"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            {messages.exportCsv}
          </Link>
        }
      />
      <Card>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-5">
            <Input name="q" placeholder={messages.searchComments} defaultValue={query} />
            <select
              name="categoryId"
              defaultValue={categoryId ?? ""}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{messages.allCategories}</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              name="teamId"
              defaultValue={teamId ?? ""}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{messages.allTeams}</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.teamName}
                </option>
              ))}
            </select>
            <select
              name="judgeId"
              defaultValue={judgeId ?? ""}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{messages.allJudges}</option>
              {data.judges.map((judge) => (
                <option key={judge.id} value={judge.id}>
                  {judge.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="ALL">{messages.allStatuses}</option>
              <option value="DRAFT">{messages.draft}</option>
              <option value="SUBMITTED">{messages.submitted}</option>
              <option value="EDITED">{messages.edited}</option>
            </select>
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white md:col-span-5 md:justify-self-end">
              {messages.applyFilters}
            </button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={messages.tableTitle} description={totalLabel} />
        <CardContent className="p-0">
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{messages.category}</TH>
                  <TH>{messages.team}</TH>
                  <TH>{messages.judge}</TH>
                  <TH>{messages.status}</TH>
                  <TH>{messages.comment}</TH>
                  <TH>{messages.updated}</TH>
                </tr>
              </THead>
              <TBody>
                {data.scores.map((score) => (
                  <tr key={score.id}>
                    <TD>{score.team.category?.name ?? messages.uncategorized}</TD>
                    <TD>
                      <div className="font-medium text-slate-950">{score.team.teamName}</div>
                      <div className="text-xs text-slate-500">{score.team.projectTitle}</div>
                    </TD>
                    <TD>{score.judge.name}</TD>
                    <TD>
                      <Badge tone={score.status === "DRAFT" ? "amber" : score.status === "EDITED" ? "blue" : "green"}>
                        {statusLabels[score.status as keyof typeof statusLabels] ?? score.status}
                      </Badge>
                    </TD>
                    <TD className="max-w-xl whitespace-pre-wrap">{score.comment || messages.noComment}</TD>
                    <TD>{formatRelativeTime(score.updatedAt, locale)}</TD>
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
