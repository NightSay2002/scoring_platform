import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

async function main() {
  const teams = (await prisma.team.findMany({
    select: { id: true, teamCode: true, teamName: true },
  })).sort((left, right) => collator.compare(left.teamCode, right.teamCode));

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      teams.map((team, index) =>
        tx.team.update({
          where: { id: team.id },
          data: { teamCode: `__seq_${index}_${team.id}` },
        }),
      ),
    );

    await Promise.all(
      teams.map((team, index) =>
        tx.team.update({
          where: { id: team.id },
          data: { teamCode: String(index) },
        }),
      ),
    );
  });

  console.log(`Renumbered ${teams.length} teams to zero-based SEQ.`);
  for (const [index, team] of teams.entries()) {
    console.log(`${team.teamCode} -> ${index}: ${team.teamName}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
