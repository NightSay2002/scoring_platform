import type { Prisma } from "@prisma/client";

export async function deleteJudgeScoreRecords(tx: Prisma.TransactionClient) {
  const scoreSubItems = await tx.scoreSubItem.deleteMany();
  const scoreAudits = await tx.scoreAudit.deleteMany();
  const scoreItems = await tx.scoreItem.deleteMany();
  const scores = await tx.score.deleteMany();

  return {
    scores: scores.count,
    scoreItems: scoreItems.count,
    scoreSubItems: scoreSubItems.count,
    scoreAudits: scoreAudits.count,
  };
}
