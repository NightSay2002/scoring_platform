"use client";

import Link from "next/link";
import { type CSSProperties, type FocusEvent, useCallback, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";

import { saveDraftAction, submitScoreAction } from "@/actions/scoring";
import { useI18n } from "@/components/i18n/language-provider";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { FeedbackMessage } from "@/components/shared/form-feedback";
import { ProgressBar } from "@/components/shared/progress-bar";
import { RelativeTime } from "@/components/shared/relative-time";
import { Textarea } from "@/components/shared/textarea";
import { clampScoreToRange, getScoreContribution } from "@/lib/scoring";
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

type ScoreInputValue = number | string;

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

function normalizeScoreInput(value: string, minScore: number, maxScore: number) {
  const trimmed = value.trim();
  const sign = minScore < 0 && trimmed.startsWith("-") ? "-" : "";
  const unsignedValue = trimmed.replace(/-/g, "").replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = unsignedValue.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const decimalPart = decimalParts.join("").slice(0, 2);
  const normalized = `${sign}${decimalParts.length ? `${normalizedInteger}.${decimalPart}` : normalizedInteger}`;

  if (!unsignedValue && sign) {
    return sign;
  }

  if (!unsignedValue || unsignedValue === ".") {
    return "";
  }

  const cappedMax = Math.min(maxScore, 100);
  const normalizedNumber = Number(normalized);
  if (!Number.isFinite(normalizedNumber)) {
    return "";
  }

  const clamped = Math.min(Math.max(normalizedNumber, minScore), cappedMax);
  if (clamped !== normalizedNumber) {
    return String(clamped);
  }

  return normalized;
}

function getNumericInputValue(value: ScoreInputValue | undefined, minScore: number, maxScore: number) {
  if (value === "" || value === "-" || value === undefined) {
    return minScore <= 0 && maxScore >= 0 ? 0 : minScore;
  }

  return clampScoreToRange({ minScore, maxScore }, Number(value));
}

function getScaledCriterionScore(criterion: Criterion, subScoreMap: Record<string, ScoreInputValue>) {
  const weightedSubScore = criterion.subCriteria.reduce(
    (sum, subCriterion) =>
      sum + getScoreContribution(subCriterion, getNumericInputValue(subScoreMap[subCriterion.id], subCriterion.minScore, subCriterion.maxScore)),
    0,
  );
  const weightedSubMax = criterion.subCriteria.reduce(
    (sum, subCriterion) => sum + getScoreContribution(subCriterion, subCriterion.maxScore),
    0,
  );

  if (weightedSubMax <= 0) {
    return 0;
  }

  return round((weightedSubScore / weightedSubMax) * criterion.maxScore);
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
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreInputValue>>(
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        existingScore?.items.find((item) => item.criterionId === criterion.id)?.numericScore ?? criterion.minScore,
      ]),
    ),
  );
  const [subScoreMap, setSubScoreMap] = useState<Record<string, ScoreInputValue>>(
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
        return getNumericInputValue(scoreMap[criterion.id], criterion.minScore, criterion.maxScore);
      }

      return getScaledCriterionScore(criterion, subScoreMap);
    },
    [scoreMap, subScoreMap],
  );

  const getCriterionContributionScore = useCallback(
    (criterion: Criterion) => getScoreContribution(criterion, getCriterionNumericScore(criterion)),
    [getCriterionNumericScore],
  );

  const totals = useMemo(() => {
    const averageScore = criteria.reduce((sum, criterion) => {
      return sum + getCriterionContributionScore(criterion);
    }, 0);

    return {
      averageScore: round(averageScore),
    };
  }, [criteria, getCriterionContributionScore]);

  const completionRate = navigation.totalTeams ? round((navigation.submittedCount / navigation.totalTeams) * 100, 0) : 0;
  const locked = scoringClosed || ((status === "SUBMITTED" || status === "EDITED") && !allowEditAfterSubmit);

  function updateScore(criterionId: string, value: string, minScore: number, maxScore: number) {
    setScoreMap((current) => ({
      ...current,
      [criterionId]: normalizeScoreInput(value, minScore, maxScore),
    }));
  }

  function updateCriterionComment(criterionId: string, value: string) {
    setCriterionCommentMap((current) => ({
      ...current,
      [criterionId]: value,
    }));
  }

  function updateSubScore(subCriterionId: string, value: string, minScore: number, maxScore: number) {
    setSubScoreMap((current) => ({
      ...current,
      [subCriterionId]: normalizeScoreInput(value, minScore, maxScore),
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
          numericScore: getNumericInputValue(subScoreMap[subCriterion.id], subCriterion.minScore, subCriterion.maxScore),
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
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.criterionNameLabel}</p>
                  <div className="mt-1 font-medium text-slate-950">{criterion.name}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{criterion.subCriteria.length ? t.weight : t.rangeWeightLabel}</p>
                  <div className="mt-1 text-sm" style={getWeightStyle(criterion.weight, criterionWeights)}>
                    {criterion.subCriteria.length ? `${criterion.weight}%` : `${criterion.minScore} - ${criterion.maxScore} | ${criterion.weight}%`}
                  </div>
                </div>
                {criterion.description ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.contentLabel}</p>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{criterion.description}</div>
                  </div>
                ) : null}
              </div>
              {criterion.subCriteria.length ? (
                <>
                  <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    {getCriterionContributionScore(criterion).toFixed(2)}
                  </div>
                  <div className="space-y-3 md:col-span-3">
                    {criterion.subCriteria.map((subCriterion) => (
                      <div key={subCriterion.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_100px_120px] md:items-start">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.criterionNameLabel}</p>
                            <div className="mt-1 text-sm font-medium text-slate-900">{subCriterion.name}</div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.rangeWeightLabel}</p>
                            <div
                              className="mt-1 text-xs"
                              style={getWeightStyle(
                                subCriterion.weight,
                                criterion.subCriteria.map((item) => item.weight),
                              )}
                            >
                              {subCriterion.minScore} - {subCriterion.maxScore} | {subCriterion.weight}%
                            </div>
                          </div>
                          {subCriterion.description ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.contentLabel}</p>
                              <div className="mt-1 text-xs leading-5 text-slate-500">{subCriterion.description}</div>
                            </div>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          inputMode={subCriterion.minScore < 0 ? "text" : "decimal"}
                          pattern="-?[0-9.]*"
                          min={subCriterion.minScore}
                          max={subCriterion.maxScore}
                          value={subScoreMap[subCriterion.id] ?? subCriterion.minScore}
                          disabled={locked || pending}
                          onFocus={selectZeroOnFocus}
                          onChange={(event) => updateSubScore(subCriterion.id, event.target.value, subCriterion.minScore, subCriterion.maxScore)}
                          className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                        />
                        <div className="rounded-xl bg-white px-3 py-3 text-sm text-slate-600">
                          {t.weightedPrefix} {getScoreContribution(subCriterion, getNumericInputValue(subScoreMap[subCriterion.id], subCriterion.minScore, subCriterion.maxScore)).toFixed(2)}
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
                    type="text"
                    inputMode={criterion.minScore < 0 ? "text" : "decimal"}
                    pattern="-?[0-9.]*"
                    min={criterion.minScore}
                    max={criterion.maxScore}
                    value={scoreMap[criterion.id] ?? criterion.minScore}
                    disabled={locked || pending}
                    onFocus={selectZeroOnFocus}
                    onChange={(event) => updateScore(criterion.id, event.target.value, criterion.minScore, criterion.maxScore)}
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                  <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    {t.weightedPrefix} {getCriterionContributionScore(criterion).toFixed(2)}
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
        <FeedbackMessage message={message} />
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
