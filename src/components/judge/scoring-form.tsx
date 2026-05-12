"use client";

import Link from "next/link";
import { type CSSProperties, type FocusEvent, useCallback, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";

import { saveDraftAction, submitScoreAction } from "@/actions/scoring";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { ProgressBar } from "@/components/shared/progress-bar";
import { RelativeTime } from "@/components/shared/relative-time";
import { Textarea } from "@/components/shared/textarea";
import { round } from "@/lib/utils";

type Criterion = {
  id: string;
  name: string;
  description: string | null;
  minScore: number;
  maxScore: number;
  weight: number;
  displayOrder: number;
  subCriteria: Array<{
    id: string;
    name: string;
    description: string | null;
    minScore: number;
    maxScore: number;
    weight: number;
    displayOrder: number;
  }>;
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
    subItems: Array<{
      subCriterionId: string;
      numericScore: number;
      comment: string;
    }>;
  }>;
} | null;

function getWeightStyle(weight: number, weights: number[]): CSSProperties {
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const ratio = maxWeight === minWeight ? 1 : (weight - minWeight) / (maxWeight - minWeight);
  const hue = 48 - ratio * 48;

  return {
    color: `hsl(${hue} 90% 34%)`,
    fontWeight: 800,
  };
}

export function ScoringForm({
  teamId,
  criteria,
  existingScore,
  allowEditAfterSubmit,
  scoringClosed,
  scoringClosedReason,
  navigation,
}: {
  teamId: string;
  criteria: Criterion[];
  existingScore: ExistingScore;
  allowEditAfterSubmit: boolean;
  scoringClosed: boolean;
  scoringClosedReason: string;
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
  const criterionWeights = useMemo(() => criteria.map((criterion) => criterion.weight), [criteria]);
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        existingScore?.items.find((item) => item.criterionId === criterion.id)?.numericScore ?? criterion.minScore,
      ]),
    ),
  );
  const [subScoreMap, setSubScoreMap] = useState<Record<string, number>>(
    Object.fromEntries(
      criteria.flatMap((criterion) =>
        criterion.subCriteria.map((subCriterion) => {
          const existingItem = existingScore?.items.find((item) => item.criterionId === criterion.id);
          const existingSubItem = existingItem?.subItems.find((item) => item.subCriterionId === subCriterion.id);

          return [subCriterion.id, existingSubItem?.numericScore ?? subCriterion.minScore];
        }),
      ),
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
  const [subCriterionCommentMap, setSubCriterionCommentMap] = useState<Record<string, string>>(
    Object.fromEntries(
      criteria.flatMap((criterion) =>
        criterion.subCriteria.map((subCriterion) => {
          const existingItem = existingScore?.items.find((item) => item.criterionId === criterion.id);
          const existingSubItem = existingItem?.subItems.find((item) => item.subCriterionId === subCriterion.id);

          return [subCriterion.id, existingSubItem?.comment ?? ""];
        }),
      ),
    ),
  );
  const [status, setStatus] = useState(existingScore?.status ?? "DRAFT");
  const [updatedAt, setUpdatedAt] = useState<string | null>(existingScore?.updatedAt.toISOString() ?? null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const getCriterionNumericScore = useCallback(
    (criterion: Criterion) => {
      if (!criterion.subCriteria.length) {
        return Number(scoreMap[criterion.id] ?? criterion.minScore);
      }

      return round(
        criterion.subCriteria.reduce(
          (sum, subCriterion) => sum + Number(subScoreMap[subCriterion.id] ?? subCriterion.minScore) * (subCriterion.weight / 100),
          0,
        ),
      );
    },
    [scoreMap, subScoreMap],
  );

  const totals = useMemo(() => {
    const averageScore = criteria.reduce((sum, criterion) => {
      const numericScore = getCriterionNumericScore(criterion);
      return sum + numericScore * (criterion.weight / 100);
    }, 0);

    return {
      averageScore: round(averageScore),
    };
  }, [criteria, getCriterionNumericScore]);

  const completionRate = navigation.totalTeams ? round((navigation.submittedCount / navigation.totalTeams) * 100, 0) : 0;
  const locked = scoringClosed || ((status === "SUBMITTED" || status === "EDITED") && !allowEditAfterSubmit);

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

  function updateSubScore(subCriterionId: string, value: number) {
    setSubScoreMap((current) => ({
      ...current,
      [subCriterionId]: value,
    }));
  }

  function updateSubCriterionComment(subCriterionId: string, value: string) {
    setSubCriterionCommentMap((current) => ({
      ...current,
      [subCriterionId]: value,
    }));
  }

  function selectZeroOnFocus(event: FocusEvent<HTMLInputElement>) {
    if (event.currentTarget.value === "0") {
      event.currentTarget.select();
    }
  }

  function buildPayload() {
    return {
      teamId,
      comment,
      items: criteria.map((criterion) => ({
        criterionId: criterion.id,
        numericScore: getCriterionNumericScore(criterion),
        comment: criterionCommentMap[criterion.id] ?? "",
        subItems: criterion.subCriteria.map((subCriterion) => ({
          subCriterionId: subCriterion.id,
          numericScore: Number(subScoreMap[subCriterion.id]),
          comment: subCriterionCommentMap[subCriterion.id] ?? "",
        })),
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
            <p className="mt-2 text-sm font-medium text-slate-950">
              <RelativeTime date={updatedAt} locale={locale} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t.editing}</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {scoringClosed ? scoringClosedReason : locked ? t.lockedAfterSubmit : t.editingAllowed}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-col items-start justify-between gap-1 text-sm text-slate-500 sm:flex-row sm:items-center sm:gap-4">
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
                <div className="mt-2 text-xs text-slate-500" style={getWeightStyle(criterion.weight, criterionWeights)}>
                  {t.range} {criterion.minScore} - {criterion.maxScore} | {t.weight} {criterion.weight}%
                </div>
              </div>
              {criterion.subCriteria.length ? (
                <>
                  <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    {getCriterionNumericScore(criterion).toFixed(2)}
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    {t.weightedPrefix} {round(getCriterionNumericScore(criterion) * (criterion.weight / 100)).toFixed(2)}
                  </div>
                  <div className="space-y-3 md:col-span-3">
                    {criterion.subCriteria.map((subCriterion) => (
                      <div key={subCriterion.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_100px_120px] md:items-start">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{subCriterion.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{subCriterion.description}</div>
                          <div
                            className="mt-2 text-xs text-slate-500"
                            style={getWeightStyle(
                              subCriterion.weight,
                              criterion.subCriteria.map((item) => item.weight),
                            )}
                          >
                            {t.range} {subCriterion.minScore} - {subCriterion.maxScore} | {t.weight} {subCriterion.weight}%
                          </div>
                        </div>
                        <input
                          type="number"
                          min={subCriterion.minScore}
                          max={subCriterion.maxScore}
                          value={subScoreMap[subCriterion.id] ?? subCriterion.minScore}
                          disabled={locked || pending}
                          onFocus={selectZeroOnFocus}
                          onChange={(event) => updateSubScore(subCriterion.id, Number(event.target.value))}
                          className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                        />
                        <div className="rounded-xl bg-white px-3 py-3 text-sm text-slate-600">
                          {t.weightedPrefix} {round((subScoreMap[subCriterion.id] ?? 0) * (subCriterion.weight / 100)).toFixed(2)}
                        </div>
                        <Textarea
                          value={subCriterionCommentMap[subCriterion.id] ?? ""}
                          onChange={(event) => updateSubCriterionComment(subCriterion.id, event.target.value)}
                          disabled={locked || pending}
                          placeholder={t.criterionCommentPlaceholder}
                          className="md:col-span-3"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min={criterion.minScore}
                    max={criterion.maxScore}
                    value={scoreMap[criterion.id] ?? criterion.minScore}
                    disabled={locked || pending}
                    onFocus={selectZeroOnFocus}
                    onChange={(event) => updateScore(criterion.id, Number(event.target.value))}
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                  <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    {t.weightedPrefix} {round((scoreMap[criterion.id] ?? 0) * (criterion.weight / 100)).toFixed(2)}
                  </div>
                </>
              )}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {navigation.previousTeamId ? (
              <Link href={`/judge/teams/${navigation.previousTeamId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                <ChevronLeft className="h-4 w-4" />
                {t.previousTeam}
              </Link>
            ) : null}
            {navigation.nextTeamId ? (
              <Link href={`/judge/teams/${navigation.nextTeamId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                {t.nextTeam}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={handleSaveDraft} disabled={locked || pending}>
              <Save className="h-4 w-4" />
              {pending ? t.saving : t.saveDraft}
            </Button>
            <Button className="w-full gap-2 sm:w-auto" onClick={handleSubmit} disabled={locked || pending}>
              <CheckCircle2 className="h-4 w-4" />
              {pending ? t.submitting : t.submitFinal}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
