import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
    },
  },
});

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'CategoryAssignment'`,
  );

  if (!tables.length) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CategoryAssignment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "categoryId" TEXT NOT NULL,
        "judgeId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CategoryAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "CategoryAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  }

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAssignment_categoryId_judgeId_key"
    ON "CategoryAssignment"("categoryId", "judgeId")
  `);

  const migrated = await prisma.$executeRawUnsafe(`
    INSERT OR IGNORE INTO "CategoryAssignment" ("id", "categoryId", "judgeId", "createdAt")
    SELECT
      'category-assignment-' || lower(hex(randomblob(16))),
      "Team"."categoryId",
      "TeamAssignment"."judgeId",
      MIN("TeamAssignment"."createdAt")
    FROM "TeamAssignment"
    INNER JOIN "Team" ON "Team"."id" = "TeamAssignment"."teamId"
    WHERE "Team"."categoryId" IS NOT NULL
    GROUP BY "Team"."categoryId", "TeamAssignment"."judgeId"
  `);

  console.log(
    tables.length
      ? `Category assignment migration already installed; migrated ${migrated} legacy assignment(s).`
      : `Category assignment migration installed; migrated ${migrated} legacy assignment(s).`,
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
