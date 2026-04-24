import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  sqlitePragmasPromise?: Promise<void>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const SQLITE_BUSY_TIMEOUT_MS = Number(process.env.SQLITE_BUSY_TIMEOUT_MS ?? 5000);

function isSqliteDatasource() {
  return (process.env.DATABASE_URL ?? "").startsWith("file:");
}

export async function ensureSqlitePragmas() {
  if (!isSqliteDatasource()) {
    return;
  }

  if (!globalForPrisma.sqlitePragmasPromise) {
    globalForPrisma.sqlitePragmasPromise = (async () => {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};`);
      await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    })().catch((error) => {
      globalForPrisma.sqlitePragmasPromise = undefined;
      throw error;
    });
  }

  await globalForPrisma.sqlitePragmasPromise;
}
