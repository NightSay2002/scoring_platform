import { Prisma } from "@prisma/client";

import { ensureSqlitePragmas } from "@/lib/prisma";

type RetryOptions = {
  retries?: number;
  delaysMs?: number[];
};

function parseDelayList(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);

  return parsed.length ? parsed : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isSqliteBusyError(error: unknown) {
  if (!error) {
    return false;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1008" || error.code === "P2024" || error.code === "P2034") {
      return true;
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("database is locked") || message.includes("sqlite_busy");
}

export async function withSqliteWriteRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
) {
  const envRetries = Number(process.env.SQLITE_WRITE_RETRIES ?? 3);
  const retries = options.retries ?? (Number.isFinite(envRetries) && envRetries >= 0 ? envRetries : 3);
  const envDelays = parseDelayList(process.env.SQLITE_WRITE_RETRY_DELAYS_MS);
  const delaysMs = options.delaysMs ?? envDelays ?? [300, 700, 1200];

  await ensureSqlitePragmas();

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === retries) {
        throw error;
      }

      const delay = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? delaysMs[delaysMs.length - 1] ?? 500;
      await sleep(delay);
    }
  }

  throw lastError;
}
