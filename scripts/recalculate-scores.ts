import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampScore(item: { minScore: number; maxScore: number }, numericScore: number) {
  if (!Number.isFinite(numericScore)) {
    return item.minScore;
  }

  return Math.min(Math.max(numericScore, item.minScore), item.maxScore);
}

function getScoreContribution(item: { minScore: number; maxScore: number; weight: number }, numericScore: number) {
  if (!Number.isFinite(item.maxScore) || item.maxScore <= 0 || !Number.isFinite(item.weight)) {
    return 0;
  }

  return round((clampScore(item, numericScore) / item.maxScore) * item.weight);
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
        const numericScore = clampScore(subItem.subCriterion, subItem.numericScore);

        return {
          id: subItem.id,
          numericScore,
          weightedValue: getScoreContribution(subItem.subCriterion, numericScore),
        };
      });
      const subWeightedScore = subItemUpdates.reduce((sum, subItem) => sum + subItem.weightedValue, 0);
      const subWeightedMax = item.subItems.reduce(
        (sum, subItem) => sum + getScoreContribution(subItem.subCriterion, subItem.subCriterion.maxScore),
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
