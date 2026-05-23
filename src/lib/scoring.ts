import { round } from "@/lib/utils";

export type WeightedScoringItem = {
  minScore?: number;
  maxScore: number;
  weight: number;
};

export function getScoreContribution(item: WeightedScoringItem, numericScore: number) {
  if (!Number.isFinite(numericScore) || !Number.isFinite(item.maxScore) || item.maxScore <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  const minScore = Number.isFinite(item.minScore) ? item.minScore ?? 0 : 0;
  const clampedScore = Math.min(Math.max(numericScore, minScore), item.maxScore);

  return round((clampedScore / item.maxScore) * item.weight);
}
