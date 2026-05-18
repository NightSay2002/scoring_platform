"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, SlidersHorizontal, X } from "lucide-react";

import { setCompetitionScorerStatusAction } from "@/actions/team";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";

type ScoringParticipant = {
  id: string;
  name: string;
  role: string;
  canScore: boolean;
};

export function ScoringParticipantsButton({
  competitionId,
  participants,
  labels,
}: {
  competitionId: string;
  participants: ScoringParticipant[];
  labels: {
    manageScorers: string;
    scoringParticipantsTitle: string;
    scoringParticipantsDesc: string;
    canScore: string;
    cannotScore: string;
    adminRole: string;
    judgeRole: string;
    scorerUpdated: string;
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
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
            <div className="space-y-3 px-5 py-4">
              {localParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{participant.name}</p>
                      <Badge tone={participant.role === "ADMIN" ? "blue" : "green"}>
                        {participant.role === "ADMIN" ? labels.adminRole : labels.judgeRole}
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
              ))}
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
