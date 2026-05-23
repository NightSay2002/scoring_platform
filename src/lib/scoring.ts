import { round } from "@/lib/utils";

export type WeightedScoringItem = {
  maxScore: number;
  weight: number;
};

export function getScoreContribution(item: WeightedScoringItem, numericScore: number) {
  if (!Number.isFinite(item.maxScore) || item.maxScore <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  return round((numericScore / item.maxScore) * item.weight);
}
