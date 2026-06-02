import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getEffectiveScoreRange(item: { minScore: number; maxScore: number; allowNegativeScore?: boolean }) {
  if (!item.allowNegativeScore) {
    return {
      minScore: Math.max(item.minScore, 0),
      maxScore: Math.max(item.maxScore, 0),
    };
  }

  const mirroredNegativeMinScore = item.maxScore > 0 ? -Math.abs(item.maxScore) : item.minScore;

  return {
    minScore: Math.min(item.minScore, mirroredNegativeMinScore),
    maxScore: item.maxScore,
  };
}

function clampScore(item: { minScore: number; maxScore: number; allowNegativeScore?: boolean }, numericScore: number) {
  const range = getEffectiveScoreRange(item);

  if (!Number.isFinite(numericScore)) {
    return range.minScore;
  }

  return Math.min(Math.max(numericScore, range.minScore), range.maxScore);
}

function getScoreScale(item: { minScore: number; maxScore: number; allowNegativeScore?: boolean }) {
  const range = getEffectiveScoreRange(item);

  return Math.max(Math.abs(range.minScore), Math.abs(range.maxScore));
}

function getScoreContribution(item: { minScore: number; maxScore: number; allowNegativeScore?: boolean; weight: number }, numericScore: number) {
  const scale = getScoreScale(item);

  if (scale <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  return round((clampScore(item, numericScore) / scale) * item.weight);
}

async function main() {
  const scores = await prisma.score.findMany({
    include: {
      items: {
        include: {
          criterion: true,
          subItems: {
            include: {
              subCriterion: true,
            },
          },
        },
      },
    },
  });

  let changedScores = 0;
  let changedItems = 0;
  let changedSubItems = 0;

  for (const score of scores) {
    const itemUpdates = score.items.map((item) => {
      const subItemUpdates = item.subItems.map((subItem) => {
        const subCriterionScoringConfig = {
          ...subItem.subCriterion,
          allowNegativeScore: item.criterion.allowNegativeScore,
        };
        const numericScore = clampScore(subCriterionScoringConfig, subItem.numericScore);

        return {
          id: subItem.id,
          numericScore,
          weightedValue: getScoreContribution(subCriterionScoringConfig, numericScore),
        };
      });
      const subWeightedScore = subItemUpdates.reduce((sum, subItem) => sum + subItem.weightedValue, 0);
      const subWeightedMax = item.subItems.reduce(
        (sum, subItem) =>
          sum +
          getScoreContribution(
            { ...subItem.subCriterion, allowNegativeScore: item.criterion.allowNegativeScore },
            subItem.subCriterion.maxScore,
          ),
        0,
      );
      const numericScore = item.subItems.length && subWeightedMax > 0
        ? round((subWeightedScore / subWeightedMax) * item.criterion.maxScore)
        : clampScore(item.criterion, item.numericScore);

      return {
        id: item.id,
        numericScore,
        weightedValue: getScoreContribution(item.criterion, numericScore),
        subItemUpdates,
      };
    });
    const weightedScore = round(itemUpdates.reduce((sum, item) => sum + item.weightedValue, 0));

    await prisma.$transaction([
      ...itemUpdates.flatMap((item) =>
        item.subItemUpdates.map((subItem) =>
          prisma.scoreSubItem.update({
            where: { id: subItem.id },
            data: {
              numericScore: subItem.numericScore,
              weightedValue: subItem.weightedValue,
            },
          }),
        ),
      ),
      ...itemUpdates.map((item) =>
        prisma.scoreItem.update({
          where: { id: item.id },
          data: {
            numericScore: item.numericScore,
            weightedValue: item.weightedValue,
          },
        }),
      ),
      prisma.score.update({
        where: { id: score.id },
        data: {
          totalScore: weightedScore,
          weightedScore,
        },
      }),
    ]);

    changedScores += 1;
    changedItems += itemUpdates.length;
    changedSubItems += itemUpdates.reduce((sum, item) => sum + item.subItemUpdates.length, 0);
  }

  console.log(`Recalculated ${changedScores} scores, ${changedItems} score items, ${changedSubItems} sub-score items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
