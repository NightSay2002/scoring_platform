import { PrismaClient, type Prisma } from "@prisma/client";

import { deleteJudgeScoreRecords } from "../src/lib/reset-judge-scores";

const prisma = new PrismaClient();

const scoreTables = ["scores", "scoreItems", "scoreSubItems", "scoreAudits"] as const;
const protectedTables = [
  "users",
  "competitions",
  "competitionScorers",
  "competitionImages",
  "categories",
  "teams",
  "teamAssignments",
  "criteria",
  "criterionSubItems",
  "settings",
] as const;

type Snapshot = Record<(typeof scoreTables)[number] | (typeof protectedTables)[number], number>;

class RollbackVerification extends Error {}

type CountClient = PrismaClient | Prisma.TransactionClient;

async function snapshot(client: CountClient = prisma) {
  const [
    users,
    competitions,
    competitionScorers,
    competitionImages,
    categories,
    teams,
    teamAssignments,
    criteria,
    criterionSubItems,
    settings,
    scores,
    scoreItems,
    scoreSubItems,
    scoreAudits,
  ] = await Promise.all([
    client.user.count(),
    client.competition.count(),
    client.competitionScorer.count(),
    client.competitionImage.count(),
    client.category.count(),
    client.team.count(),
    client.teamAssignment.count(),
    client.criterion.count(),
    client.criterionSubItem.count(),
    client.settings.count(),
    client.score.count(),
    client.scoreItem.count(),
    client.scoreSubItem.count(),
    client.scoreAudit.count(),
  ]);

  return {
    users,
    competitions,
    competitionScorers,
    competitionImages,
    categories,
    teams,
    teamAssignments,
    criteria,
    criterionSubItems,
    settings,
    scores,
    scoreItems,
    scoreSubItems,
    scoreAudits,
  } satisfies Snapshot;
}

function assertProtectedCountsUnchanged(before: Snapshot, after: Snapshot) {
  for (const table of protectedTables) {
    if (before[table] !== after[table]) {
      throw new Error(`${table} changed: before=${before[table]} after=${after[table]}`);
    }
  }
}

function assertScoreTablesCleared(after: Snapshot) {
  for (const table of scoreTables) {
    if (after[table] !== 0) {
      throw new Error(`${table} was not cleared: after=${after[table]}`);
    }
  }
}

async function main() {
  const before = await snapshot();
  let deleted = {
    scores: 0,
    scoreItems: 0,
    scoreSubItems: 0,
    scoreAudits: 0,
  };

  try {
    await prisma.$transaction(async (tx) => {
      deleted = await deleteJudgeScoreRecords(tx);
      const afterDelete = await snapshot(tx);

      assertProtectedCountsUnchanged(before, afterDelete);
      assertScoreTablesCleared(afterDelete);

      throw new RollbackVerification();
    });
  } catch (error) {
    if (!(error instanceof RollbackVerification)) {
      throw error;
    }
  }

  const afterRollback = await snapshot();
  for (const table of [...protectedTables, ...scoreTables]) {
    if (before[table] !== afterRollback[table]) {
      throw new Error(`${table} was not rolled back: before=${before[table]} after=${afterRollback[table]}`);
    }
  }

  console.log("Reset judge scores verification passed.");
  console.log(`Would delete ${deleted.scores} scores, ${deleted.scoreItems} score items, ${deleted.scoreSubItems} sub-score items, ${deleted.scoreAudits} score audits.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
