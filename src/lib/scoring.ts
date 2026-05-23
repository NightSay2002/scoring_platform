import { round } from "@/lib/utils";

export type WeightedScoringItem = {
  minScore?: number;
  maxScore: number;
  weight: number;
};

export function clampScoreToRange(item: { minScore?: number; maxScore: number }, numericScore: number) {
  const minScore = Number.isFinite(item.minScore) ? item.minScore ?? 0 : 0;

  if (!Number.isFinite(numericScore)) {
    return minScore;
  }

  return Math.min(Math.max(numericScore, minScore), item.maxScore);
}

export function getScoreScale(item: { minScore?: number; maxScore: number }) {
  const minScore = Number.isFinite(item.minScore) ? item.minScore ?? 0 : 0;
  const maxScore = Number.isFinite(item.maxScore) ? item.maxScore : 0;

  return Math.max(Math.abs(minScore), Math.abs(maxScore));
}

export function getScoreContribution(item: WeightedScoringItem, numericScore: number) {
  const scale = getScoreScale(item);

  if (!Number.isFinite(numericScore) || scale <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  return round((clampScoreToRange(item, numericScore) / scale) * item.weight);
}
