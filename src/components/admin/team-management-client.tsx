"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, Link2, Pencil, Plus, ShieldCheck, Trash2, Upload, Video, XCircle } from "lucide-react";

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
import { RelativeTime } from "@/components/shared/relative-time";
import { Textarea } from "@/components/shared/textarea";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";

type TeamRow = {
  id: string;
  teamCode: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  categoryId: string;
  categoryName: string;
  ownerUserId: string;
  ownerEmail: string;
  projectTitle: string;
  projectDescription: string;
  organization: string;
  teamMembers: string;
  videoUrl: string;
  imageUrl: string;
  documentUrl: string;
  documentName: string;
  documentLinks: DocumentLink[];
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

type TeamAccount = {
  id: string;
  name: string;
  email: string;
};

type DocumentLink = {
  name: string;
  url: string;
};

const emptyForm = {
  id: "",
  teamCode: "",
  teamName: "",
  competitionId: "",
  categoryId: "",
  ownerUserId: "",
  projectTitle: "",
  projectDescription: "",
  organization: "",
  teamMembers: "",
  videoUrl: "",
  imageUrl: "",
  documentUrl: "",
  documentName: "",
  documentLinks: [] as DocumentLink[],
  reviewNote: "",
};

function syncDocumentFields(documentLinks: DocumentLink[]) {
  return {
    documentLinks,
    documentUrl: documentLinks[0]?.url ?? "",
    documentName: documentLinks[0]?.name ?? "",
  };
}

export function TeamManagementClient({
  teams,
  competitions,
  categories,
  teamAccounts,
  judgeScope,
}: {
  teams: TeamRow[];
  competitions: Competition[];
  categories: Category[];
  teamAccounts: TeamAccount[];
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
  const [avatarFileName, setAvatarFileName] = useState("");
  const [documentFileName, setDocumentFileName] = useState("");
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
    setAvatarFileName("");
    setDocumentFileName("");
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
      ownerUserId: team.ownerUserId,
      projectTitle: team.projectTitle,
      projectDescription: team.projectDescription,
      organization: team.organization,
      teamMembers: team.teamMembers,
      videoUrl: team.videoUrl,
      imageUrl: team.imageUrl,
      documentUrl: team.documentUrl,
      documentName: team.documentName,
      documentLinks: team.documentLinks,
      reviewNote: team.reviewNote,
    });
    setAvatarFileName("");
    setDocumentFileName(team.documentName);
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
      const documentLinks: DocumentLink[] = [];

      for (const link of form.documentLinks) {
        const name = link.name.trim();
        const url = link.url.trim();
        if (!name && !url) {
          continue;
        }
        if (!name || !url) {
          setMessage(t.documentLinkIncomplete);
          return;
        }

        documentLinks.push({ name, url });
      }

      const result = await upsertTeamAction({
        ...form,
        ...syncDocumentFields(documentLinks),
      });
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      setMessage(t.teamSaved);
      startCreate();
    });
  }

  function handleUpload(kind: "avatar" | "document", file: File | null) {
    if (!file) {
      return;
    }

    if (kind === "avatar") {
      setAvatarFileName(file.name);
    } else {
      setDocumentFileName(file.name);
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", file);
      const response = await fetch("/api/upload/team-asset", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { error?: string; url?: string; name?: string };
      if (result?.error || !result?.url) {
        setMessage(result?.error ?? t.uploadFailed);
        return;
      }

      const uploadedUrl = result.url;
      const uploadedName = result.name ?? file.name;
      setForm((current) => ({
        ...current,
        ...(kind === "avatar"
          ? { imageUrl: uploadedUrl }
          : syncDocumentFields([...current.documentLinks, { name: uploadedName, url: uploadedUrl }])),
      }));
      setMessage(t.uploaded);
    });
  }

  function updateDocumentLink(index: number, field: keyof DocumentLink, value: string) {
    setForm((current) => {
      const nextLinks = current.documentLinks.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: value } : link,
      );

      return {
        ...current,
        ...syncDocumentFields(nextLinks),
      };
    });
  }

  function addDocumentLink() {
    setForm((current) => ({
      ...current,
      documentLinks: [...current.documentLinks, { name: "", url: "" }],
    }));
  }

  function removeDocumentLink(index: number) {
    setForm((current) => ({
      ...current,
      ...syncDocumentFields(current.documentLinks.filter((_, linkIndex) => linkIndex !== index)),
    }));
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
    <div className="space-y-6">
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
          <div className="max-h-[430px] overflow-y-auto rounded-2xl border border-slate-200 [scrollbar-width:thin]">
          <Table>
            <DataTable>
              <THead className="sticky top-0 z-10">
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
                    <TD>
                      <RelativeTime date={team.updatedAt} locale={locale} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        {team.videoUrl ? (
                          <a href={team.videoUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg p-2 text-sky-700">
                            <Video className="h-4 w-4" />
                          </a>
                        ) : null}
                        {team.documentUrl ? (
                          <a href={team.documentUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg p-2 text-emerald-700">
                            <FileText className="h-4 w-4" />
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
          </div>
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
            <label className="text-sm font-medium text-slate-700">{t.ownerAccount}</label>
            <select
              value={form.ownerUserId}
              onChange={(event) => setForm((current) => ({ ...current, ownerUserId: event.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.noOwnerAccount}</option>
              {teamAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.email}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">{t.ownerAccountHelp}</p>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.avatarUpload}</label>
              <p className="text-xs text-slate-500">{t.avatarUploadHelp}</p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <ImageIcon className="h-4 w-4" />
                {t.uploadAvatar}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => handleUpload("avatar", event.target.files?.[0] ?? null)} />
              </label>
              {avatarFileName ? <p className="text-xs font-medium text-slate-700">{t.selectedFile}: {avatarFileName}</p> : null}
              {form.imageUrl ? <p className="break-all text-xs text-slate-500">{form.imageUrl}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t.documentUpload}</label>
              <p className="text-xs text-slate-500">{t.documentUploadHelp}</p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Upload className="h-4 w-4" />
                {t.uploadDocument}
                <input type="file" accept=".pdf,.docx,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" className="sr-only" onChange={(event) => handleUpload("document", event.target.files?.[0] ?? null)} />
              </label>
              {documentFileName ? <p className="text-xs font-medium text-slate-700">{t.selectedFile}: {documentFileName}</p> : null}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-700">{t.documentLinks}</p>
                  <Button variant="outline" size="sm" className="gap-2" onClick={addDocumentLink}>
                    <Plus className="h-4 w-4" />
                    {t.addDocumentUrl}
                  </Button>
                </div>
                {form.documentLinks.length ? (
                  <div className="space-y-2">
                    {form.documentLinks.map((link, index) => (
                      <div key={`${index}-${link.url}`} className="grid gap-2 md:grid-cols-[0.8fr_1.2fr_auto]">
                        <Input
                          value={link.name}
                          placeholder={t.documentNamePlaceholder}
                          onChange={(event) => updateDocumentLink(index, "name", event.target.value)}
                        />
                        <Input
                          value={link.url}
                          placeholder={t.documentUrlPlaceholder}
                          onChange={(event) => updateDocumentLink(index, "url", event.target.value)}
                        />
                        <Button variant="ghost" size="sm" className="gap-2 text-rose-600" onClick={() => removeDocumentLink(index)}>
                          <Trash2 className="h-4 w-4" />
                          {t.removeDocumentUrl}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t.noDocumentLinks}</p>
                )}
                {form.documentLinks.length ? (
                  <div className="space-y-1">
                    {form.documentLinks
                      .filter((link) => link.name.trim() && link.url.trim())
                      .map((link, index) => (
                        <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-xs font-medium text-sky-700">
                          <Link2 className="h-4 w-4 shrink-0" />
                          {link.name}
                        </a>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.reviewNote}</label>
            <Textarea value={form.reviewNote} onChange={(event) => setForm((current) => ({ ...current, reviewNote: event.target.value }))} />
          </div>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={startCreate} className="w-full sm:w-auto">
              {t.reset}
            </Button>
            <Button onClick={handleSave} disabled={pending} className="w-full gap-2 sm:w-auto">
              {selectedTeam ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {pending ? t.saving : selectedTeam ? t.updateTeam : t.createTeam}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
