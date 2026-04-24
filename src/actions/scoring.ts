"use server";

import { Prisma, Role, ScoreStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withSqliteWriteRetry } from "@/lib/sqlite-write-retry";
import { round } from "@/lib/utils";

const scorePayloadSchema = z.object({
  teamId: z.string().min(1),
  comment: z.string().default(""),
  items: z.array(
    z.object({
      criterionId: z.string().min(1),
      numericScore: z.number(),
      comment: z.string().default(""),
    }),
  ),
});

async function requireJudge() {
  const session = await auth();

  if (!session?.user || session.user.role !== Role.JUDGE) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

async function saveScore(payload: z.infer<typeof scorePayloadSchema>, status: ScoreStatus) {
  const judge = await requireJudge();
  const parsed = scorePayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: "Invalid score payload." };
  }

  const [settings, team] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.team.findUnique({
      where: { id: parsed.data.teamId },
      include: {
        category: true,
        assignments: {
          where: { judgeId: judge.id },
        },
      },
    }),
  ]);

  if (!team) {
    return { error: "Team not found." };
  }

  if (settings?.judgeScope === "ASSIGNED" && team.assignments.length === 0) {
    return { error: "You are not assigned to this team." };
  }

  if (!team.categoryId) {
    return { error: "Team category is required before scoring." };
  }

  const criteria = await prisma.criterion.findMany({
    where: {
      categoryId: team.categoryId,
      active: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  if (!criteria.length) {
    return { error: "No active criteria found for this category." };
  }

  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.001) {
    return { error: "Category criteria weights must total exactly 100% before scoring." };
  }

  const criteriaMap = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const normalizedItems: Array<{ criterionId: string; numericScore: number; weightedValue: number; comment: string }> =
    [];

  for (const item of parsed.data.items) {
    const criterion = criteriaMap.get(item.criterionId);

    if (!criterion) {
      return { error: "One or more criteria are invalid." };
    }

    if (item.numericScore < criterion.minScore || item.numericScore > criterion.maxScore) {
      return { error: `${criterion.name} must be between ${criterion.minScore} and ${criterion.maxScore}.` };
    }

    normalizedItems.push({
      criterionId: criterion.id,
      numericScore: item.numericScore,
      weightedValue: round(item.numericScore * (criterion.weight / 100)),
      comment: item.comment.trim(),
    });
  }

  const existing = await prisma.score.findUnique({
    where: {
      teamId_judgeId: {
        teamId: parsed.data.teamId,
        judgeId: judge.id,
      },
    },
  });

  if (existing?.status === ScoreStatus.SUBMITTED && !settings?.allowEditAfterSubmit) {
    return { error: "Editing after submission is disabled by the admin." };
  }

  // Final score is the percentage-weighted average across all criteria.
  const weightedAverage = round(normalizedItems.reduce((sum, item) => sum + item.weightedValue, 0));
  const totalScore = weightedAverage;
  const weightedScore = weightedAverage;
  const nextStatus =
    existing?.status === ScoreStatus.SUBMITTED && status === ScoreStatus.SUBMITTED
      ? ScoreStatus.EDITED
      : status;

  const saveData: Prisma.ScoreUncheckedCreateInput = {
    teamId: parsed.data.teamId,
    judgeId: judge.id,
    comment: parsed.data.comment.trim(),
    totalScore,
    weightedScore,
    status: nextStatus,
    submittedAt: status === ScoreStatus.SUBMITTED ? new Date() : existing?.submittedAt ?? null,
  };

  const score = await withSqliteWriteRetry(() =>
    existing
      ? prisma.score.update({
          where: { id: existing.id },
          data: {
            ...saveData,
            items: {
              deleteMany: {},
              create: normalizedItems,
            },
            audits: {
              create: {
                actorId: judge.id,
                action: status === ScoreStatus.SUBMITTED ? "submit" : "save_draft",
                snapshot: JSON.stringify({
                  comment: parsed.data.comment.trim(),
                  items: normalizedItems,
                }),
              },
            },
          },
        })
      : prisma.score.create({
          data: {
            ...saveData,
            items: {
              create: normalizedItems,
            },
            audits: {
              create: {
                actorId: judge.id,
                action: status === ScoreStatus.SUBMITTED ? "submit" : "save_draft",
                snapshot: JSON.stringify({
                  comment: parsed.data.comment.trim(),
                  items: normalizedItems,
                }),
              },
            },
          },
        }),
  );

  revalidatePath("/judge");
  revalidatePath("/judge/teams");
  revalidatePath(`/judge/teams/${parsed.data.teamId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/leaderboard");

  return {
    success: true,
    score: {
      id: score.id,
      status: score.status,
      totalScore: score.totalScore,
      weightedScore: score.weightedScore,
      updatedAt: score.updatedAt.toISOString(),
    },
  };
}

export async function saveDraftAction(payload: z.infer<typeof scorePayloadSchema>) {
  return saveScore(payload, ScoreStatus.DRAFT);
}

export async function submitScoreAction(payload: z.infer<typeof scorePayloadSchema>) {
  return saveScore(payload, ScoreStatus.SUBMITTED);
}
