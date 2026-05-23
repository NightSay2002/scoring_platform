import { round } from "@/lib/utils";

export type WeightedScoringItem = {
  minScore?: number;
  maxScore: number;
  weight: number;
};

export function getEffectiveScoreRange(item: { minScore?: number; maxScore: number }) {
  const configuredMinScore = Number.isFinite(item.minScore) ? item.minScore ?? 0 : 0;
  const maxScore = Number.isFinite(item.maxScore) ? item.maxScore : 0;
  const mirroredNegativeMinScore = maxScore > 0 ? -Math.abs(maxScore) : configuredMinScore;

  return {
    minScore: Math.min(configuredMinScore, mirroredNegativeMinScore),
    maxScore,
  };
}

export function clampScoreToRange(item: { minScore?: number; maxScore: number }, numericScore: number) {
  const { minScore, maxScore } = getEffectiveScoreRange(item);

  if (!Number.isFinite(numericScore)) {
    return minScore;
  }

  return Math.min(Math.max(numericScore, minScore), maxScore);
}

export function getScoreScale(item: { minScore?: number; maxScore: number }) {
  const { minScore, maxScore } = getEffectiveScoreRange(item);

  return Math.max(Math.abs(minScore), Math.abs(maxScore));
}

export function getScoreContribution(item: WeightedScoringItem, numericScore: number) {
  const scale = getScoreScale(item);

  if (!Number.isFinite(numericScore) || scale <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  return round((clampScoreToRange(item, numericScore) / scale) * item.weight);
}
