"use client";

import { useState, useTransition } from "react";
import { Play, Square } from "lucide-react";

import { toggleCompetitionScoringAction } from "@/actions/team";
import { Button } from "@/components/shared/button";

export function ScoringToggleButton({
  isClosed,
  competitionId,
  labels,
}: {
  isClosed: boolean;
  competitionId: string;
  labels: {
    endCompetition: string;
    continueCompetition: string;
    competitionEnded: string;
    competitionContinued: string;
  };
}) {
  const [closed, setClosed] = useState(isClosed);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleScoring() {
    startTransition(async () => {
      const result = await toggleCompetitionScoringAction(closed, competitionId);
      if (result?.error) {
        setMessage(result.error);
        return;
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
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
