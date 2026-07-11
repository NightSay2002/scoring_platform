import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
    },
  },
});

async function getTeamColumns() {
  return prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Team")');
}

const additions = [
  ['documentLinks', 'ALTER TABLE "Team" ADD COLUMN "documentLinks" TEXT'],
  ['nominationType', 'ALTER TABLE "Team" ADD COLUMN "nominationType" TEXT'],
  ['locations', 'ALTER TABLE "Team" ADD COLUMN "locations" TEXT'],
  [
    'supportingEvidenceSubmitted',
    'ALTER TABLE "Team" ADD COLUMN "supportingEvidenceSubmitted" BOOLEAN NOT NULL DEFAULT false',
  ],
  ['videoSubmitted', 'ALTER TABLE "Team" ADD COLUMN "videoSubmitted" BOOLEAN NOT NULL DEFAULT false'],
  ['applicationFormUrl', 'ALTER TABLE "Team" ADD COLUMN "applicationFormUrl" TEXT'],
  ['applicationFormName', 'ALTER TABLE "Team" ADD COLUMN "applicationFormName" TEXT'],
  ['relevantUrls', 'ALTER TABLE "Team" ADD COLUMN "relevantUrls" TEXT'],
  ['note', 'ALTER TABLE "Team" ADD COLUMN "note" TEXT'],
] as const;

async function main() {
  const existingColumns = new Set((await getTeamColumns()).map((column) => column.name));
  const added: string[] = [];

  for (const [name, sql] of additions) {
    if (existingColumns.has(name)) {
      continue;
    }

    await prisma.$executeRawUnsafe(sql);
    added.push(name);
  }

  if (added.includes("videoSubmitted")) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Team"
      SET "videoSubmitted" = CASE
        WHEN "videoUrl" IS NOT NULL AND TRIM("videoUrl") <> '' THEN true
        ELSE false
      END
    `);
  }

  console.log(
    added.length
      ? `Team field migration applied. Added: ${added.join(", ")}.`
      : "Team field migration already applied.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
