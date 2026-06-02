import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function columnExists(tableName: string, columnName: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${tableName}")`);

  return columns.some((column) => column.name === columnName);
}

async function main() {
  const hasAllowNegativeScoreColumn = await columnExists("Criterion", "allowNegativeScore");

  if (!hasAllowNegativeScoreColumn) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Criterion" ADD COLUMN "allowNegativeScore" BOOLEAN NOT NULL DEFAULT false');

    await prisma.criterion.updateMany({
      data: {
        allowNegativeScore: false,
      },
    });

    await prisma.criterion.updateMany({
      where: {
        minScore: {
          lt: 0,
        },
      },
      data: {
        minScore: 0,
      },
    });

    await prisma.criterionSubItem.updateMany({
      where: {
        minScore: {
          lt: 0,
        },
      },
      data: {
        minScore: 0,
      },
    });
  }

  console.log("Negative score toggle migration applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
