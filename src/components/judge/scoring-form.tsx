"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";

import { saveDraftAction, submitScoreAction } from "@/actions/scoring";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Textarea } from "@/components/shared/textarea";
import { formatRelativeTime, round } from "@/lib/utils";

type Criterion = {
  id: string;
  name: string;
  description: string | null;
  minScore: number;
  maxScore: number;
  weight: number;
  displayOrder: number;
};

type ExistingScore = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "EDITED";
  comment: string;
  updatedAt: Date;
  items: Array<{
    criterionId: string;
    numericScore: number;
    comment: string;
  }>;
} | null;

export function ScoringForm({
  teamId,
  criteria,
  existingScore,
  allowEditAfterSubmit,
  navigation,
}: {
  teamId: string;
  criteria: Criterion[];
  existingScore: ExistingScore;
  allowEditAfterSubmit: boolean;
  navigation: {
    previousTeamId: string | null;
    nextTeamId: string | null;
    currentIndex: number;
    totalTeams: number;
    submittedCount: number;
  };
}) {
  const { locale, messages } = useI18n();
  const t = messages.scoringForm;
  const common = messages.common;
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        existingScore?.items.find((item) => item.criterionId === criterion.id)?.numericScore ?? criterion.minScore,
      ]),
    ),
  );
  const [comment, setComment] = useState(existingScore?.comment ?? "");
  const [criterionCommentMap, setCriterionCommentMap] = useState<Record<string, string>>(
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        existingScore?.items.find((item) => item.criterionId === criterion.id)?.comment ?? "",
      ]),
    ),
  );
  const [status, setStatus] = useState(existingScore?.status ?? "DRAFT");
  const [updatedAt, setUpdatedAt] = useState<string | null>(existingScore?.updatedAt.toISOString() ?? null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const averageScore = criteria.reduce(
      (sum, criterion) => sum + (scoreMap[criterion.id] ?? 0) * (criterion.weight / 100),
      0,
    );

    return {
      averageScore: round(averageScore),
    };
  }, [criteria, scoreMap]);

  const completionRate = navigation.totalTeams ? round((navigation.submittedCount / navigation.totalTeams) * 100, 0) : 0;
  const locked = status === "SUBMITTED" && !allowEditAfterSubmit;

  function updateScore(criterionId: string, value: number) {
    setScoreMap((current) => ({
      ...current,
      [criterionId]: value,
    }));
  }

  function updateCriterionComment(criterionId: string, value: string) {
    setCriterionCommentMap((current) => ({
      ...current,
      [criterionId]: value,
    }));
  }

  function buildPayload() {
    return {
      teamId,
      comment,
      items: criteria.map((criterion) => ({
        criterionId: criterion.id,
        numericScore: Number(scoreMap[criterion.id]),
        comment: criterionCommentMap[criterion.id] ?? "",
      })),
    };
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const result = await saveDraftAction(buildPayload());
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      if (!result?.score) {
        setMessage(t.draftNoScore);
        return;
      }

      setStatus(result.score.status);
      setUpdatedAt(result.score.updatedAt);
      setMessage(t.draftSaved);
    });
  }

  function handleSubmit() {
    if (!window.confirm(t.confirmSubmit)) {
      return;
    }

    startTransition(async () => {
      const result = await submitScoreAction(buildPayload());
      if (result?.error) {
        setMessage(result.error);
        return;
      }

      if (!result?.score) {
        setMessage(t.submitNoScore);
        return;
      }

      setStatus(result.score.status);
      setUpdatedAt(result.score.updatedAt);
      setMessage(result.score.status === "EDITED" ? t.finalUpdated : t.finalSubmitted);
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
              <Badge tone={status === "SUBMITTED" ? "green" : status === "EDITED" ? "blue" : "amber"}>
                {common.statuses[status.toLowerCase() as "draft" | "submitted" | "edited"]}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.lastUpdated}</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{formatRelativeTime(updatedAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.editing}</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {locked ? t.lockedAfterSubmit : t.editingAllowed}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-4 text-sm text-slate-500">
            <span>
              {t.completionProgress} {navigation.submittedCount}/{navigation.totalTeams} {t.teamsSubmitted}
            </span>
            <span>{completionRate}%</span>
          </div>
          <ProgressBar value={completionRate} />
        </div>
        <div className="space-y-3">
          {criteria.map((criterion) => (
            <div
              key={criterion.id}
              className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_100px_120px] md:items-start"
            >
              <div>
                <div className="font-medium text-slate-950">{criterion.name}</div>
                <div className="mt-1 text-sm text-slate-500">{criterion.description}</div>
                <div className="mt-2 text-xs text-slate-400">
                  {t.range} {criterion.minScore} - {criterion.maxScore} | {t.weight} {criterion.weight}%
                </div>
              </div>
              <input
                type="number"
                min={criterion.minScore}
                max={criterion.maxScore}
                value={scoreMap[criterion.id] ?? criterion.minScore}
                disabled={locked || pending}
                onChange={(event) => updateScore(criterion.id, Number(event.target.value))}
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
              <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                {t.weightedPrefix} {round((scoreMap[criterion.id] ?? 0) * (criterion.weight / 100)).toFixed(2)}
              </div>
              <div className="space-y-2 md:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {criterion.name} {t.criterionComment}
                </label>
                <Textarea
                  value={criterionCommentMap[criterion.id] ?? ""}
                  onChange={(event) => updateCriterionComment(criterion.id, event.target.value)}
                  disabled={locked || pending}
                  placeholder={t.criterionCommentPlaceholder}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.totalScore}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totals.averageScore.toFixed(2)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t.judgeComment}</label>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={locked || pending}
            placeholder={t.judgeCommentPlaceholder}
          />
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            {navigation.previousTeamId ? (
              <Link href={`/judge/teams/${navigation.previousTeamId}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                <ChevronLeft className="h-4 w-4" />
                {t.previousTeam}
              </Link>
            ) : null}
            {navigation.nextTeamId ? (
              <Link href={`/judge/teams/${navigation.nextTeamId}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                {t.nextTeam}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={handleSaveDraft} disabled={locked || pending}>
              <Save className="h-4 w-4" />
              {pending ? t.saving : t.saveDraft}
            </Button>
            <Button className="gap-2" onClick={handleSubmit} disabled={locked || pending}>
              <CheckCircle2 className="h-4 w-4" />
              {pending ? t.submitting : t.submitFinal}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
