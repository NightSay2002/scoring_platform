"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/shared/button";
import { HorizontalDragScroll } from "@/components/shared/horizontal-drag-scroll";

type JudgeScore = {
  judgeName: string;
  score: number | null;
  status: string;
  scoreComment: string;
  updatedAt: string | null;
  criterionScores: Array<{
    criterionName: string;
    numericScore: number;
    comment: string;
    subScores: Array<{
      subCriterionName: string;
      numericScore: number;
      weightedValue: number;
      weight: number;
      comment: string;
    }>;
  }>;
};

function clampScore(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function getScoreBlockStyle(score: number | null) {
  if (score === null) {
    return {
      backgroundColor: "hsl(210 16% 93%)",
      borderColor: "hsl(210 14% 82%)",
      color: "hsl(215 20% 35%)",
    };
  }

  const normalized = clampScore(score);
  const hue = (normalized / 100) * 120;

  return {
    backgroundColor: `hsl(${hue} 75% 88%)`,
    borderColor: `hsl(${hue} 55% 70%)`,
    color: `hsl(${hue} 65% 24%)`,
  };
}

export function JudgeScoreCards({
  judges,
  ariaLabel,
  labels,
}: {
  judges: JudgeScore[];
  ariaLabel: string;
  labels: {
    pending: string;
    clickForDetails: string;
    detailsTitle: string;
    judge: string;
    status: string;
    score: string;
    updated: string;
    overallComment: string;
    criterionBreakdown: string;
    criterionComment: string;
    noComment: string;
    noData: string;
    close: string;
    statuses: {
      draft: string;
      submitted: string;
      edited: string;
      pending: string;
    };
  };
}) {
  const [selectedJudge, setSelectedJudge] = useState<JudgeScore | null>(null);

  useEffect(() => {
    if (!selectedJudge) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedJudge(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedJudge]);

  function formatStatus(status: string) {
    const key = status.toLowerCase() as keyof typeof labels.statuses;
    return labels.statuses[key] ?? status;
  }

  return (
    <>
      <HorizontalDragScroll
        ariaLabel={ariaLabel}
        className="max-w-[720px] rounded-xl border border-slate-200 bg-slate-50 p-2"
      >
        <div className="flex min-w-max gap-2">
          {judges.map((judge) => {
            const blockStyle = getScoreBlockStyle(judge.score);

            return (
              <button
                type="button"
                key={judge.judgeName}
                className="inline-flex h-[220px] w-[220px] flex-col rounded-xl border px-3 py-2 text-left text-xs font-semibold transition hover:opacity-95"
                style={blockStyle}
                onClick={() => setSelectedJudge(judge)}
              >
                <span className="text-sm">
                  {judge.judgeName}: {judge.score === null ? labels.pending : judge.score.toFixed(1)}
                </span>
                <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                  {judge.criterionScores.map((item) => (
                    <span key={`${judge.judgeName}-${item.criterionName}`} className="block truncate">
                      {item.criterionName}: {item.numericScore.toFixed(0)}
                    </span>
                  ))}
                </div>
                <span className="mt-1 text-[11px] font-medium opacity-75">{labels.clickForDetails}</span>
              </button>
            );
          })}
        </div>
      </HorizontalDragScroll>

      {selectedJudge ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setSelectedJudge(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <h3 className="text-base font-semibold text-slate-900">
                {labels.detailsTitle}: {selectedJudge.judgeName}
              </h3>
              <Button variant="outline" size="sm" onClick={() => setSelectedJudge(null)}>
                {labels.close}
              </Button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-slate-700">
              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">{labels.judge}: </span>
                  {selectedJudge.judgeName}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">{labels.status}: </span>
                  {formatStatus(selectedJudge.status)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">{labels.score}: </span>
                  {selectedJudge.score === null ? labels.pending : selectedJudge.score.toFixed(2)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">{labels.updated}: </span>
                  {selectedJudge.updatedAt ? new Date(selectedJudge.updatedAt).toLocaleString() : labels.pending}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-900">{labels.overallComment}</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  {selectedJudge.scoreComment || labels.noComment}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-semibold text-slate-900">{labels.criterionBreakdown}</p>
                {selectedJudge.criterionScores.length ? (
                  selectedJudge.criterionScores.map((item) => (
                    <div key={`${selectedJudge.judgeName}-${item.criterionName}-detail`} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-900">
                        {item.criterionName}: {item.numericScore.toFixed(0)}
                      </p>
                      {item.subScores.length ? (
                        <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3">
                          {item.subScores.map((subItem) => (
                            <div
                              key={`${selectedJudge.judgeName}-${item.criterionName}-${subItem.subCriterionName}`}
                              className="rounded-lg bg-slate-50 p-2"
                            >
                              <p className="font-semibold text-slate-800">
                                {subItem.subCriterionName}: {subItem.numericScore.toFixed(0)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {subItem.weight}% · {subItem.weightedValue.toFixed(2)}
                              </p>
                              {subItem.comment ? (
                                <p className="mt-1 text-xs text-slate-600">{subItem.comment}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{labels.criterionComment}</p>
                      <p className="mt-1 text-slate-700">{item.comment || labels.noComment}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">{labels.noData}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
