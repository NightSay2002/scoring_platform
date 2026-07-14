"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, SlidersHorizontal, X } from "lucide-react";

import { setCategoryScorerAssignmentsAction, setCompetitionScorerStatusAction } from "@/actions/team";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { FeedbackMessage } from "@/components/shared/form-feedback";

type ScoringParticipant = {
  id: string;
  name: string;
  role: string;
  canScore: boolean;
  categoryIds: string[];
};

export function ScoringParticipantsButton({
  competitionId,
  participants,
  categories,
  labels,
}: {
  competitionId: string;
  participants: ScoringParticipant[];
  categories: Array<{ id: string; name: string }>;
  labels: {
    manageScorers: string;
    scoringParticipantsTitle: string;
    scoringParticipantsDesc: string;
    canScore: string;
    cannotScore: string;
    adminRole: string;
    chiefJudgeRole: string;
    judgeRole: string;
    scorerUpdated: string;
    awardCategories: string;
    categoryAssignmentsDesc: string;
    assignmentUpdated: string;
    noCategoryAssigned: string;
    stalePageRefresh: string;
    close: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [localParticipants, setLocalParticipants] = useState(participants);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function getRoleLabel(role: string) {
    return role === "ADMIN" ? labels.adminRole : role === "CHIEF_JUDGE" ? labels.chiefJudgeRole : labels.judgeRole;
  }

  function getRoleTone(role: string): "blue" | "purple" | "green" {
    return role === "ADMIN" ? "blue" : role === "CHIEF_JUDGE" ? "purple" : "green";
  }

  function updateStatus(userId: string, canScore: boolean) {
    const participant = localParticipants.find((entry) => entry.id === userId);
    setPendingUserId(userId);
    setMessage("");

    startTransition(async () => {
      const result = await setCompetitionScorerStatusAction({
        competitionId,
        userId,
        canScore,
        expectedCanScore: participant?.canScore,
      });

      if (result?.error) {
        setMessage("stale" in result && result.stale ? labels.stalePageRefresh : result.error);
        setPendingUserId(null);
        return;
      }

      setLocalParticipants((current) =>
        current.map((participant) =>
          participant.id === userId ? { ...participant, canScore } : participant,
        ),
      );
      setMessage(labels.scorerUpdated);
      setPendingUserId(null);
      router.refresh();
    });
  }

  function updateCategoryAssignment(userId: string, categoryId: string, assigned: boolean) {
    const participant = localParticipants.find((entry) => entry.id === userId);
    if (!participant) {
      return;
    }

    const categoryIds = assigned
      ? Array.from(new Set([...participant.categoryIds, categoryId]))
      : participant.categoryIds.filter((id) => id !== categoryId);
    setPendingUserId(userId);
    setMessage("");

    startTransition(async () => {
      const result = await setCategoryScorerAssignmentsAction({
        competitionId,
        userId,
        categoryIds,
        expectedCategoryIds: participant.categoryIds,
      });

      if (result?.error) {
        setMessage("stale" in result && result.stale ? labels.stalePageRefresh : result.error);
        setPendingUserId(null);
        return;
      }

      setLocalParticipants((current) =>
        current.map((entry) => entry.id === userId ? { ...entry, categoryIds } : entry),
      );
      setMessage(labels.assignmentUpdated);
      setPendingUserId(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-10 gap-2">
        <SlidersHorizontal className="h-4 w-4" />
        {labels.manageScorers}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-950">{labels.scoringParticipantsTitle}</h3>
                <p className="text-sm text-slate-500">{labels.scoringParticipantsDesc}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="gap-2">
                <X className="h-4 w-4" />
                {labels.close}
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-width:thin]">
              {localParticipants.map((participant) => (
                <div key={participant.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-950">{participant.name}</p>
                        <Badge tone={getRoleTone(participant.role)}>
                          {getRoleLabel(participant.role)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {participant.canScore ? labels.canScore : labels.cannotScore}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:w-[240px]">
                      <Button
                        type="button"
                        variant={participant.canScore ? "primary" : "outline"}
                        size="sm"
                        aria-label={`${labels.canScore} ${participant.name}`}
                        onClick={() => updateStatus(participant.id, true)}
                        disabled={pending && pendingUserId === participant.id}
                        className="gap-2"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {labels.canScore}
                      </Button>
                      <Button
                        type="button"
                        variant={participant.canScore ? "outline" : "danger"}
                        size="sm"
                        aria-label={`${labels.cannotScore} ${participant.name}`}
                        onClick={() => updateStatus(participant.id, false)}
                        disabled={pending && pendingUserId === participant.id}
                      >
                        {labels.cannotScore}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{labels.awardCategories}</p>
                      <p className="text-xs text-slate-500">{labels.categoryAssignmentsDesc}</p>
                    </div>
                    {categories.length ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {categories.map((category) => (
                          <label key={category.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={participant.categoryIds.includes(category.id)}
                              onChange={(event) => updateCategoryAssignment(participant.id, category.id, event.target.checked)}
                              disabled={pending && pendingUserId === participant.id}
                            />
                            <span>{category.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{labels.noCategoryAssigned}</p>
                    )}
                  </div>
                </div>
              ))}
              <FeedbackMessage message={message} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
