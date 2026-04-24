"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Pencil, Plus, ShieldCheck, Trash2, Video, XCircle } from "lucide-react";

import {
  approveTeamSubmissionAction,
  deleteTeamAction,
  rejectTeamSubmissionAction,
  upsertTeamAction,
} from "@/actions/team";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { Textarea } from "@/components/shared/textarea";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";
import { formatRelativeTime } from "@/lib/utils";

type TeamRow = {
  id: string;
  teamCode: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  categoryId: string;
  categoryName: string;
  ownerEmail: string;
  projectTitle: string;
  projectDescription: string;
  organization: string;
  teamMembers: string;
  videoUrl: string;
  imageUrl: string;
  submissionStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string;
  submittedCount: number;
  expectedCount: number;
  averageScore: number;
  updatedAt: Date;
};

type Category = {
  id: string;
  competitionId: string;
  competitionName: string;
  name: string;
};

type Competition = {
  id: string;
  name: string;
};

const emptyForm = {
  id: "",
  teamCode: "",
  teamName: "",
  competitionId: "",
  categoryId: "",
  projectTitle: "",
  projectDescription: "",
  organization: "",
  teamMembers: "",
  videoUrl: "",
  imageUrl: "",
  reviewNote: "",
};

export function TeamManagementClient({
  teams,
  competitions,
  categories,
  judgeScope,
}: {
  teams: TeamRow[];
  competitions: Competition[];
  categories: Category[];
  judges: Array<{ id: string; name: string }>;
  judgeScope: "ALL" | "ASSIGNED";
}) {
  const { locale, messages } = useI18n();
  const t = messages.teamManagement;
  const common = messages.common;
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const selectedTeam = teams.find((team) => team.id === selectedId);
  const [form, setForm] = useState({
    ...emptyForm,
    competitionId: competitions[0]?.id ?? "",
  });
  const formCategories = useMemo(
    () => categories.filter((category) => !form.competitionId || category.competitionId === form.competitionId),
    [categories, form.competitionId],
  );

  const filteredTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return teams.filter((team) => {
      const matchesQuery =
        !normalized ||
        [team.teamCode, team.teamName, team.projectTitle, team.organization, team.competitionName, team.categoryName]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesCompetition = !competitionFilter || team.competitionId === competitionFilter;
      const matchesCategory = !categoryFilter || team.categoryId === categoryFilter;
      const matchesStatus = !statusFilter || team.submissionStatus === statusFilter;

      return matchesQuery && matchesCompetition && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, competitionFilter, query, statusFilter, teams]);

  function startCreate() {
    setSelectedId("");
    setForm({
      ...emptyForm,
      competitionId: competitions[0]?.id ?? "",
    });
    setMessage("");
  }

  function startEdit(team: TeamRow) {
    setSelectedId(team.id);
    setForm({
      id: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      competitionId: team.competitionId,
      categoryId: team.categoryId,
      projectTitle: team.projectTitle,
      projectDescription: team.projectDescription,
      organization: team.organization,
      teamMembers: team.teamMembers,
      videoUrl: team.videoUrl,
      imageUrl: team.imageUrl,
      reviewNote: team.reviewNote,
    });
    setMessage("");
  }

  function handleCompetitionChange(competitionId: string) {
    const nextCategories = categories.filter((category) => category.competitionId === competitionId);
    setForm((current) => ({
      ...current,
      competitionId,
      categoryId:
        current.categoryId && nextCategories.some((category) => category.id === current.categoryId)
          ? current.categoryId
          : "",
    }));
  }

  function getStatusTone(status: TeamRow["submissionStatus"]) {
    switch (status) {
      case "APPROVED":
        return "green";
      case "PENDING":
        return "blue";
      case "REJECTED":
        return "rose";
      default:
        return "amber";
    }
  }

  async function handleSave() {
    startTransition(async () => {
      const result = await upsertTeamAction(form);
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.teamSaved);
      startCreate();
    });
  }

  async function handleDelete(teamId: string) {
    if (!window.confirm(t.confirmDeleteTeam)) {
      return;
    }

    startTransition(async () => {
      await deleteTeamAction(teamId);
      setMessage(t.teamDeleted);
      startCreate();
    });
  }

  async function handleApprove(teamId: string) {
    startTransition(async () => {
      const result = await approveTeamSubmissionAction(teamId);
      setMessage(result?.error ?? t.teamApproved);
    });
  }

  async function handleReject(teamId: string) {
    const reviewNote = window.prompt(t.rejectPrompt, t.rejectDefaultNote);

    startTransition(async () => {
      await rejectTeamSubmissionAction(teamId, reviewNote ?? undefined);
      setMessage(t.teamRejected);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.24fr_0.76fr]">
      <Card>
        <CardHeader
          title={t.submittedWorksTitle}
          description={judgeScope === "ALL" ? t.judgeScopeAll : t.judgeScopeAssigned}
          action={
            <Button variant="secondary" className="gap-2" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              {t.newTeam}
            </Button>
          }
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              value={competitionFilter}
              onChange={(event) => {
                const nextCompetitionId = event.target.value;
                setCompetitionFilter(nextCompetitionId);
                setCategoryFilter((current) =>
                  current &&
                  !categories.some(
                    (category) =>
                      category.id === current &&
                      (!nextCompetitionId || category.competitionId === nextCompetitionId),
                  )
                    ? ""
                    : current,
                );
              }}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.allCompetitions}</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.allCategories}</option>
              {categories
                .filter((category) => !competitionFilter || category.competitionId === competitionFilter)
                .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.competitionName} / {category.name}
                </option>
                ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.allStatuses}</option>
              <option value="DRAFT">{common.statuses.draft}</option>
              <option value="PENDING">{common.statuses.pendingApproval}</option>
              <option value="APPROVED">{common.statuses.approved}</option>
              <option value="REJECTED">{common.statuses.rejected}</option>
            </select>
          </div>
          <Table>
            <DataTable>
              <THead>
                <tr>
                  <TH>{t.tableTeamId}</TH>
                  <TH>{t.tableWork}</TH>
                  <TH>{t.tableCategory}</TH>
                  <TH>{t.tableOwnerAccount}</TH>
                  <TH>{t.tableStatus}</TH>
                  <TH>{t.tableJudgesSubmitted}</TH>
                  <TH>{common.words.average}</TH>
                  <TH>{t.tableUpdated}</TH>
                  <TH>{t.tableActions}</TH>
                </tr>
              </THead>
              <TBody>
                {filteredTeams.map((team) => (
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
                    <TD>{team.ownerEmail || common.labels.unlinked}</TD>
                    <TD>
                      <Badge tone={getStatusTone(team.submissionStatus)}>{common.statuses[team.submissionStatus.toLowerCase() as "draft" | "pending" | "approved" | "rejected"]}</Badge>
                    </TD>
                    <TD>
                      {team.submittedCount}/{team.expectedCount}
                    </TD>
                    <TD>{team.averageScore.toFixed(2)}</TD>
                    <TD>{formatRelativeTime(team.updatedAt, locale)}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        {team.videoUrl ? (
                          <a href={team.videoUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg p-2 text-sky-700">
                            <Video className="h-4 w-4" />
                          </a>
                        ) : null}
                        {team.submissionStatus !== "APPROVED" ? (
                          <Button variant="ghost" size="sm" onClick={() => handleApprove(team.id)}>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          </Button>
                        ) : null}
                        {team.submissionStatus !== "REJECTED" ? (
                          <Button variant="ghost" size="sm" onClick={() => handleReject(team.id)}>
                            <XCircle className="h-4 w-4 text-rose-600" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => startEdit(team)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader
          title={selectedTeam ? t.editWorkTitle : t.addTeamSubmissionTitle}
          description={t.formDescription}
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.teamCode}</label>
              <Input value={form.teamCode} onChange={(event) => setForm((current) => ({ ...current, teamCode: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.teamName}</label>
              <Input value={form.teamName} onChange={(event) => setForm((current) => ({ ...current, teamName: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.competition}</label>
              <select
                value={form.competitionId}
                onChange={(event) => handleCompetitionChange(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">{t.selectCompetition}</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.category}</label>
              <select
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">{t.selectCategory}</option>
                {formCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.organization}</label>
              <Input value={form.organization} onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.projectTitle}</label>
            <Input value={form.projectTitle} onChange={(event) => setForm((current) => ({ ...current, projectTitle: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.projectDescription}</label>
            <Textarea
              value={form.projectDescription}
              onChange={(event) => setForm((current) => ({ ...current, projectDescription: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.teamMembers}</label>
            <Textarea
              rows={5}
              value={form.teamMembers}
              onChange={(event) => setForm((current) => ({ ...current, teamMembers: event.target.value }))}
              placeholder={t.oneMemberPerLine}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.videoUrl}</label>
              <Input value={form.videoUrl} onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.imageUrl}</label>
              <Input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.reviewNote}</label>
            <Textarea value={form.reviewNote} onChange={(event) => setForm((current) => ({ ...current, reviewNote: event.target.value }))} />
          </div>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={startCreate}>
              {t.reset}
            </Button>
            <Button onClick={handleSave} disabled={pending} className="gap-2">
              {selectedTeam ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {pending ? t.saving : selectedTeam ? t.updateTeam : t.createTeam}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
