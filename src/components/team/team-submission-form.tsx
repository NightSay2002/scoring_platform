"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Send } from "lucide-react";

import { saveTeamDraftAction, submitTeamForApprovalAction } from "@/actions/team";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { Input } from "@/components/shared/input";
import { Textarea } from "@/components/shared/textarea";
import { formatRelativeTime } from "@/lib/utils";

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
  });
  const [submissionStatus, setSubmissionStatus] = useState(team.submissionStatus);
  const [updatedAt, setUpdatedAt] = useState(team.updatedAt.toISOString());
  const [message, setMessage] = useState("");
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
            <p className="mt-2 text-sm font-medium text-slate-950">{formatRelativeTime(updatedAt, locale)}</p>
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
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <div className="flex justify-end gap-3">
          <Button variant="outline" className="gap-2" onClick={handleDraftSave} disabled={locked || pending}>
            <Save className="h-4 w-4" />
            {pending ? t.saving : t.saveDraft}
          </Button>
          <Button className="gap-2" onClick={handleSubmit} disabled={locked || pending}>
            <Send className="h-4 w-4" />
            {pending ? t.submitting : t.submitForApproval}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
