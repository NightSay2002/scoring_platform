"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, Image as ImageIcon, Save, Send, Upload } from "lucide-react";

import { saveTeamDraftAction, submitTeamForApprovalAction } from "@/actions/team";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { RelativeTime } from "@/components/shared/relative-time";
import { Textarea } from "@/components/shared/textarea";

type Category = {
  id: string;
  name: string;
  competitionId: string;
  competitionName: string;
};

type Competition = {
  id: string;
  name: string;
};

type TeamSubmission = {
  teamCode: string;
  teamName: string;
  competitionId: string;
  competitionName: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization: string;
  teamMembers: string;
  videoUrl: string;
  imageUrl: string;
  documentUrl: string;
  documentName: string;
  submissionStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string;
  updatedAt: Date;
};

export function TeamSubmissionForm({
  competitions,
  categories,
  team,
}: {
  competitions: Competition[];
  categories: Category[];
  team: TeamSubmission;
}) {
  const { locale, messages } = useI18n();
  const t = messages.teamSubmissionForm;
  const common = messages.common;
  const [form, setForm] = useState({
    teamCode: team.teamCode,
    teamName: team.teamName,
    competitionId: team.competitionId || competitions[0]?.id || "",
    categoryId: team.categoryId,
    projectTitle: team.projectTitle,
    projectDescription: team.projectDescription,
    organization: team.organization,
    teamMembers: team.teamMembers,
    videoUrl: team.videoUrl,
    imageUrl: team.imageUrl,
    documentUrl: team.documentUrl,
    documentName: team.documentName,
  });
  const [submissionStatus, setSubmissionStatus] = useState(team.submissionStatus);
  const [updatedAt, setUpdatedAt] = useState(team.updatedAt.toISOString());
  const [message, setMessage] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [documentFileName, setDocumentFileName] = useState(team.documentName);
  const [pending, startTransition] = useTransition();
  const filteredCategories = useMemo(
    () => categories.filter((category) => !form.competitionId || category.competitionId === form.competitionId),
    [categories, form.competitionId],
  );

  const locked = submissionStatus === "APPROVED";
  const tone = submissionStatus === "APPROVED" ? "green" : submissionStatus === "PENDING" ? "blue" : submissionStatus === "REJECTED" ? "rose" : "amber";
  const statusLabel =
    submissionStatus === "APPROVED"
      ? common.statuses.approved
      : submissionStatus === "PENDING"
        ? common.statuses.pendingApproval
        : submissionStatus === "REJECTED"
          ? common.statuses.rejected
          : common.statuses.draft;

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

  function handleDraftSave() {
    startTransition(async () => {
      const result = await saveTeamDraftAction(form);
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      if (!result?.team) {
        setMessage(t.draftNoData);
        return;
      }

      setSubmissionStatus(result.team.submissionStatus);
      setUpdatedAt(result.team.updatedAt);
      setMessage(t.draftSaved);
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
          : { documentUrl: uploadedUrl, documentName: uploadedName }),
      }));
      setMessage(t.uploaded);
    });
  }

  function handleSubmit() {
    if (!window.confirm(t.confirmSubmit)) {
      return;
    }

    startTransition(async () => {
      const result = await submitTeamForApprovalAction(form);
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      if (!result?.team) {
        setMessage(t.submitNoData);
        return;
      }

      setSubmissionStatus(result.team.submissionStatus);
      setUpdatedAt(result.team.updatedAt);
      setMessage(t.sentForApproval);
    });
  }

  return (
    <Card>
      <CardHeader title={t.title} description={t.description} />
      <CardContent className="space-y-5">
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.status}</p>
            <div className="mt-2">
              <Badge tone={tone}>{statusLabel}</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.lastUpdated}</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              <RelativeTime date={updatedAt} locale={locale} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.adminReview}</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{locked ? t.approvedLocked : t.editable}</p>
          </div>
        </div>
        {team.reviewNote ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-medium text-rose-900">{t.adminNote}</p>
            <p className="mt-2 whitespace-pre-wrap">{team.reviewNote}</p>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.teamCode}</label>
            <Input value={form.teamCode} onChange={(event) => setForm((current) => ({ ...current, teamCode: event.target.value }))} disabled={locked || pending} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.teamName}</label>
            <Input value={form.teamName} onChange={(event) => setForm((current) => ({ ...current, teamName: event.target.value }))} disabled={locked || pending} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.competition}</label>
            <select
              value={form.competitionId}
              onChange={(event) => handleCompetitionChange(event.target.value)}
              disabled={locked || pending}
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
            <label className="text-sm font-medium text-slate-700">{t.projectCategory}</label>
            <select
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              disabled={locked || pending}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">{t.selectCategory}</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.organization}</label>
            <Input value={form.organization} onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))} disabled={locked || pending} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t.projectTitle}</label>
          <Input value={form.projectTitle} onChange={(event) => setForm((current) => ({ ...current, projectTitle: event.target.value }))} disabled={locked || pending} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t.projectDescription}</label>
          <Textarea value={form.projectDescription} onChange={(event) => setForm((current) => ({ ...current, projectDescription: event.target.value }))} disabled={locked || pending} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t.teamMembers}</label>
          <Textarea
            value={form.teamMembers}
            onChange={(event) => setForm((current) => ({ ...current, teamMembers: event.target.value }))}
            placeholder={t.oneMemberPerLine}
            disabled={locked || pending}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.videoUrl}</label>
            <Input value={form.videoUrl} onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))} disabled={locked || pending} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.attachmentImageUrl}</label>
            <Input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} disabled={locked || pending} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.avatarUpload}</label>
            <p className="text-xs text-slate-500">{t.avatarUploadHelp}</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <ImageIcon className="h-4 w-4" />
              {t.uploadAvatar}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={locked || pending} className="sr-only" onChange={(event) => handleUpload("avatar", event.target.files?.[0] ?? null)} />
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
              <input type="file" accept=".pdf,.docx,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" disabled={locked || pending} className="sr-only" onChange={(event) => handleUpload("document", event.target.files?.[0] ?? null)} />
            </label>
            {documentFileName ? <p className="text-xs font-medium text-slate-700">{t.selectedFile}: {documentFileName}</p> : null}
            {form.documentUrl ? (
              <a href={form.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-xs font-medium text-sky-700">
                <FileText className="h-4 w-4 shrink-0" />
                {form.documentName || form.documentUrl}
              </a>
            ) : null}
          </div>
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={handleDraftSave} disabled={locked || pending}>
            <Save className="h-4 w-4" />
            {pending ? t.saving : t.saveDraft}
          </Button>
          <Button className="w-full gap-2 sm:w-auto" onClick={handleSubmit} disabled={locked || pending}>
            <Send className="h-4 w-4" />
            {pending ? t.submitting : t.submitForApproval}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
