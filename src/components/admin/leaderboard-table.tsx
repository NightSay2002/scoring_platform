"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownUp, ArrowUp01, ArrowUpDown } from "lucide-react";

import { JudgeScoreCards } from "@/components/admin/judge-score-cards";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { ProgressBar } from "@/components/shared/progress-bar";
import { DataTable, Table, TBody, TD, TH, THead } from "@/components/shared/table";

type JudgeScore = Parameters<typeof JudgeScoreCards>[0]["judges"][number];

export type LeaderboardRow = {
  id: string;
  rank: number;
  teamCode: string;
  teamName: string;
  projectTitle: string;
  averageScore: number;
  submittedCount: number;
  expectedCount: number;
  completionRate: number;
  pendingJudgeNames: string[];
  perJudgeScores: JudgeScore[];
};

type SortKey = "rank" | "team" | "seq" | "average";
type SortDirection = "asc" | "desc";

function parseSeq(value: string) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

export function LeaderboardTable({
  rows,
  labels,
  scoreCardLabels,
  showProgress = false,
  showPendingJudges = false,
  showPerJudgeScores = false,
  showScoreDetails = false,
}: {
  rows: LeaderboardRow[];
  labels: {
    rank: string;
    seq: string;
    team: string;
    average: string;
    progress: string;
    pendingJudges: string;
    perJudgeScores: string;
    scoreDetails: string;
    submittedShort: string;
    complete: string;
    minAverage: string;
    maxAverage: string;
    noData: string;
  };
  scoreCardLabels: Parameters<typeof JudgeScoreCards>[0]["labels"];
  showProgress?: boolean;
  showPendingJudges?: boolean;
  showPerJudgeScores?: boolean;
  showScoreDetails?: boolean;
}) {
  const [minAverage, setMinAverage] = useState("");
  const [maxAverage, setMaxAverage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const visibleRows = useMemo(() => {
    const min = minAverage === "" ? null : Number(minAverage);
    const max = maxAverage === "" ? null : Number(maxAverage);

    return rows
      .filter((row) => {
        if (min !== null && Number.isFinite(min) && row.averageScore < min) {
          return false;
        }

        if (max !== null && Number.isFinite(max) && row.averageScore > max) {
          return false;
        }

        return true;
      })
      .slice()
      .sort((left, right) => {
        const direction = sortDirection === "asc" ? 1 : -1;

        if (sortKey === "team") {
          return left.teamName.localeCompare(right.teamName, "en", { sensitivity: "base" }) * direction;
        }

        if (sortKey === "seq") {
          return (parseSeq(left.teamCode) - parseSeq(right.teamCode)) * direction;
        }

        if (sortKey === "average") {
          return (left.averageScore - right.averageScore) * direction;
        }

        return (left.rank - right.rank) * direction;
      });
  }, [maxAverage, minAverage, rows, sortDirection, sortKey]);

  function updateSort(nextKey: SortKey) {
    setSortDirection((current) => {
      if (sortKey === nextKey) {
        return current === "asc" ? "desc" : "asc";
      }

      return nextKey === "average" ? "desc" : "asc";
    });
    setSortKey(nextKey);
  }

  function renderSortButton(sort: SortKey, children: React.ReactNode) {
    const active = sortKey === sort;
    const Icon = sort === "team" ? ArrowDownAZ : sort === "seq" ? ArrowUp01 : sort === "average" ? ArrowDownUp : ArrowUpDown;

    return (
      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => updateSort(sort)}>
        {children}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-slate-900" : "text-slate-400"}`} />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,160px)_auto] sm:items-end">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.minAverage}</span>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={minAverage}
            onChange={(event) => setMinAverage(event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.maxAverage}</span>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={maxAverage}
            onChange={(event) => setMaxAverage(event.target.value)}
          />
        </label>
        <Button type="button" variant="outline" onClick={() => updateSort("rank")} className="gap-2 sm:w-auto">
          <ArrowUpDown className="h-4 w-4" />
          {labels.rank}
        </Button>
      </div>
      <Table>
        <DataTable>
          <THead>
            <tr>
              <TH>
                {renderSortButton("rank", labels.rank)}
              </TH>
              <TH>
                {renderSortButton("seq", labels.seq)}
              </TH>
              <TH>
                {renderSortButton("team", labels.team)}
              </TH>
              <TH>
                {renderSortButton("average", labels.average)}
              </TH>
              {showProgress ? <TH>{labels.progress}</TH> : null}
              {showPendingJudges ? <TH>{labels.pendingJudges}</TH> : null}
              {showPerJudgeScores ? <TH>{labels.perJudgeScores}</TH> : null}
              {showScoreDetails ? <TH>{labels.scoreDetails}</TH> : null}
            </tr>
          </THead>
          <TBody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <TD className="font-semibold text-slate-950">#{row.rank}</TD>
                <TD>{row.teamCode}</TD>
                <TD>
                  <div className="font-medium text-slate-950">{row.teamName}</div>
                  <div className="text-xs text-slate-500">{row.projectTitle}</div>
                </TD>
                <TD>{row.averageScore.toFixed(2)}</TD>
                {showProgress ? (
                  <TD className="min-w-[180px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {row.submittedCount}/{row.expectedCount} {labels.submittedShort}
                        </span>
                        <span>{row.completionRate}%</span>
                      </div>
                      <ProgressBar value={row.completionRate} />
                    </div>
                  </TD>
                ) : null}
                {showPendingJudges ? (
                  <TD>
                    {row.pendingJudgeNames.length ? (
                      <div className="flex flex-wrap gap-2">
                        {row.pendingJudgeNames.map((judgeName) => (
                          <Badge key={judgeName} tone="amber">
                            {judgeName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge tone="green">{labels.complete}</Badge>
                    )}
                  </TD>
                ) : null}
                {showPerJudgeScores ? (
                  <TD>
                    <JudgeScoreCards judges={row.perJudgeScores} ariaLabel={labels.perJudgeScores} labels={scoreCardLabels} />
                  </TD>
                ) : null}
                {showScoreDetails ? (
                  <TD>
                    <JudgeScoreCards judges={row.perJudgeScores} ariaLabel={labels.scoreDetails} labels={scoreCardLabels} />
                  </TD>
                ) : null}
              </tr>
            ))}
          </TBody>
        </DataTable>
      </Table>
      {!visibleRows.length ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{labels.noData}</div>
      ) : null}
    </div>
  );
}
