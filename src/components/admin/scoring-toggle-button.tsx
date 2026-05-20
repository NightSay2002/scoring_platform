"use client";

import { useState, useTransition } from "react";
import { Play, Square } from "lucide-react";

import { toggleCompetitionScoringAction } from "@/actions/team";
import { Button } from "@/components/shared/button";
import { FeedbackMessage } from "@/components/shared/form-feedback";

export function ScoringToggleButton({
  isClosed,
  competitionId,
  competitionUpdatedAt,
  labels,
}: {
  isClosed: boolean;
  competitionId: string;
  competitionUpdatedAt: string;
  labels: {
    endCompetition: string;
    continueCompetition: string;
    competitionEnded: string;
    competitionContinued: string;
    stalePageRefresh: string;
  };
}) {
  const [closed, setClosed] = useState(isClosed);
  const [currentCompetitionUpdatedAt, setCurrentCompetitionUpdatedAt] = useState(competitionUpdatedAt);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleScoring() {
    startTransition(async () => {
      const result = await toggleCompetitionScoringAction(closed, competitionId, currentCompetitionUpdatedAt);
      if (result?.error) {
        setMessage("stale" in result && result.stale ? labels.stalePageRefresh : result.error);
        return;
      }

      if (result && "competitionUpdatedAt" in result) {
        setCurrentCompetitionUpdatedAt(result.competitionUpdatedAt ?? "");
      }
      setClosed((current) => !current);
      setMessage(closed ? labels.competitionContinued : labels.competitionEnded);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant={closed ? "secondary" : "outline"} onClick={toggleScoring} disabled={pending} className="h-10 gap-2">
        {closed ? <Play className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        {closed ? labels.continueCompetition : labels.endCompetition}
      </Button>
      <FeedbackMessage message={message} className="text-xs" />
    </div>
  );
}
