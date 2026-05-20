"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ApprovalStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withSqliteWriteRetry } from "@/lib/sqlite-write-retry";
import { normalizeDocumentLinks, serializeDocumentLinks, type DocumentLink } from "@/lib/utils";
import {
  competitionSchema,
  categorySchema,
  criterionSchema,
  criterionSubItemSchema,
  competitionImageSchema,
  settingsSchema,
  teamSchema,
  userAccountSchema,
} from "@/lib/validators";

const staleAdminPageResult = {
  stale: true,
  error: "This page has been updated by another admin. Please refresh and try again.",
} as const;

function isStaleVersion(currentUpdatedAt: Date | null | undefined, expectedUpdatedAt?: string) {
  if (!expectedUpdatedAt || !currentUpdatedAt) {
    return false;
  }

  const expectedTime = new Date(expectedUpdatedAt).getTime();
  return Number.isNaN(expectedTime) || currentUpdatedAt.getTime() !== expectedTime;
}

function compareSequenceCode(left: string, right: string) {
  return new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare(left, right);
}

function isAdminLikeRole(role: Role) {
  return role === Role.ADMIN || role === Role.CHIEF_JUDGE;
}

async function requireAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== Role.ADMIN) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

async function requireAdminLike() {
  const session = await auth();

  if (!session?.user || !isAdminLikeRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

async function requireTeamUser() {
  const session = await auth();

  if (!session?.user || session.user.role !== Role.TEAM) {
    throw new Error("Unauthorized");
  }

  return {
    user: session.user,
  };
}

function revalidateAppData() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/leaderboard");
  revalidatePath("/admin/settings");
  revalidatePath("/judge");
  revalidatePath("/judge/teams");
  revalidatePath("/team");
  revalidatePath("/team/submission");
}

const uploadRules = {
  avatar: {
    folder: "avatars",
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]),
    maxBytes: 3 * 1024 * 1024,
  },
  document: {
    folder: "documents",
    extensions: new Set([".pdf", ".docx", ".zip"]),
    maxBytes: 20 * 1024 * 1024,
  },
} as const;

function sanitizeUploadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "upload";
}

export async function uploadTeamAssetAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== Role.ADMIN && session.user.role !== Role.TEAM)) {
    throw new Error("Unauthorized");
  }

  const kind = formData.get("kind");
  const file = formData.get("file");
  if ((kind !== "avatar" && kind !== "document") || !file || typeof file === "string" || !("arrayBuffer" in file)) {
    return { error: "Please choose a valid file to upload." };
  }

  const originalName = "name" in file && typeof file.name === "string" ? file.name : "upload";
  const ext = path.extname(originalName).toLowerCase();
  const rule = uploadRules[kind];
  const size = "size" in file && typeof file.size === "number" ? file.size : 0;

  if (!rule.extensions.has(ext)) {
    return {
      error:
        kind === "avatar"
          ? "Avatar must be a JPG, PNG, WEBP, or GIF image."
          : "Document must be a PDF, DOCX, or ZIP file.",
    };
  }

  if (size > rule.maxBytes) {
    return { error: kind === "avatar" ? "Avatar must be 3MB or smaller." : "Document must be 20MB or smaller." };
  }

  const safeOriginalName = sanitizeUploadName(originalName);
  const fileName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", rule.folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

  return {
    success: true,
    url: `/uploads/${rule.folder}/${fileName}`,
    name: originalName,
  };
}

async function generateNextTeamCode(tx: Prisma.TransactionClient) {
  const teams = await tx.team.findMany({ select: { teamCode: true } });
  const usedCodes = new Set(teams.map((team) => team.teamCode.trim()).filter(Boolean));
  const maxNumericCode = teams.reduce((max, team) => {
    const value = Number.parseInt(team.teamCode, 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);
  let nextCode = String(maxNumericCode + 1);

  while (usedCodes.has(nextCode)) {
    nextCode = String(Number.parseInt(nextCode, 10) + 1);
  }

  return nextCode;
}

function buildTeamData(parsed: ReturnType<typeof teamSchema.parse>) {
  const documentLinks = parsed.documentLinks === undefined ? undefined : normalizeDocumentLinks(parsed.documentLinks);

  return {
    teamName: parsed.teamName.trim(),
    categoryId: parsed.categoryId,
    projectTitle: parsed.projectTitle.trim(),
    projectDescription: parsed.projectDescription.trim(),
    organization: parsed.organization?.trim() || null,
    teamMembers: parsed.teamMembers.trim(),
    videoUrl: parsed.videoUrl?.trim() || null,
    imageUrl: parsed.imageUrl?.trim() || null,
    documentUrl: documentLinks ? documentLinks[0]?.url ?? null : parsed.documentUrl?.trim() || null,
    documentName: documentLinks ? documentLinks[0]?.name ?? null : parsed.documentName?.trim() || null,
    ...(documentLinks ? { documentLinks: serializeDocumentLinks(documentLinks) } : {}),
    reviewNote: parsed.reviewNote?.trim() || null,
  };
}

async function validateCategoryCompetition(categoryId: string, competitionId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      active: true,
      competitionId: true,
    },
  });

  if (!category) {
    return "Category not found.";
  }

  if (!category.active) {
    return "Selected category is inactive.";
  }

  if (category.competitionId !== competitionId) {
    return "Selected category does not belong to the selected competition.";
  }

  return null;
}

async function validateOpenCompetition(competitionId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      active: true,
      scoringPaused: true,
    },
  });

  if (!competition || !competition.active) {
    return "Competition not found.";
  }

  if (competition.scoringPaused) {
    return "This competition has ended.";
  }

  return null;
}

export async function upsertTeamAction(payload: {
  id?: string;
  teamCode?: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
  documentUrl?: string;
  documentName?: string;
  documentLinks?: DocumentLink[];
  ownerUserId?: string;
  submissionStatus?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();

  const parsed = teamSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid team data." };
  }

  const categoryValidationError = await validateCategoryCompetition(parsed.data.categoryId, parsed.data.competitionId);
  if (categoryValidationError) {
    return { error: categoryValidationError };
  }

  if (parsed.data.id) {
    const currentTeam = await prisma.team.findUnique({
      where: { id: parsed.data.id },
      select: { updatedAt: true },
    });

    if (!currentTeam) {
      return { error: "Team not found." };
    }

    if (isStaleVersion(currentTeam.updatedAt, payload.expectedUpdatedAt)) {
      return staleAdminPageResult;
    }
  }

  const data = buildTeamData(parsed.data);

  try {
    await withSqliteWriteRetry(() =>
      prisma.$transaction(async (tx) => {
        const ownerUserId = payload.ownerUserId?.trim() || null;

        if (ownerUserId) {
          const owner = await tx.user.findUnique({
            where: { id: ownerUserId },
            select: { id: true, role: true },
          });

          if (!owner || owner.role !== Role.TEAM) {
            throw new Error("Selected owner account is not a team account.");
          }

        }

        if (parsed.data.id) {
          await tx.team.update({
            where: { id: parsed.data.id },
            data: {
              ...data,
              ownerUserId,
              ...(parsed.data.submissionStatus ? { submissionStatus: parsed.data.submissionStatus } : {}),
            },
          });
        } else {
          await tx.team.create({
            data: {
              ...data,
              teamCode: await generateNextTeamCode(tx),
              ownerUserId,
              submissionStatus: parsed.data.submissionStatus ?? ApprovalStatus.DRAFT,
            },
          });
        }
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Unable to save team. Check for duplicate team code or invalid category." };
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteTeamAction(teamId: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const currentTeam = await prisma.team.findUnique({
    where: { id: teamId },
    select: { updatedAt: true },
  });

  if (!currentTeam) {
    return { error: "Team not found." };
  }

  if (isStaleVersion(currentTeam.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() => prisma.team.delete({ where: { id: teamId } }));

  revalidateAppData();
  return { success: true };
}

export async function reorderTeamSequenceAction(teamId: string, targetTeamId: string, expectedUpdatedAt?: string) {
  await requireAdmin();

  if (teamId === targetTeamId) {
    return { success: true };
  }

  const result = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const [team, targetTeam] = await Promise.all([
        tx.team.findUnique({ where: { id: teamId }, select: { id: true, updatedAt: true } }),
        tx.team.findUnique({ where: { id: targetTeamId }, select: { id: true } }),
      ]);

      if (!team || !targetTeam) {
        return { error: "Team not found." };
      }

      if (isStaleVersion(team.updatedAt, expectedUpdatedAt)) {
        return staleAdminPageResult;
      }

      const teams = (await tx.team.findMany({
        select: { id: true, teamCode: true },
      })).sort((left, right) => compareSequenceCode(left.teamCode, right.teamCode));
      const reordered = teams.filter((item) => item.id !== teamId);
      const targetIndex = reordered.findIndex((item) => item.id === targetTeamId);

      if (targetIndex < 0) {
        return { error: "Target team not found." };
      }

      reordered.splice(targetIndex, 0, { id: teamId, teamCode: teamId });

      await Promise.all(
        reordered.map((item, index) =>
          tx.team.update({
            where: { id: item.id },
            data: { teamCode: `__seq_${index + 1}_${item.id}` },
          }),
        ),
      );

      await Promise.all(
        reordered.map((item, index) =>
          tx.team.update({
            where: { id: item.id },
            data: { teamCode: String(index + 1) },
          }),
        ),
      );

      return { success: true as const };
    }),
  );

  if ("error" in result && result.error) {
    return result;
  }

  revalidateAppData();
  return { success: true };
}

export async function upsertCriterionAction(payload: {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  minScore: number;
  maxScore: number;
  weight: number;
  displayOrder: number;
  active: boolean;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();
  const parsed = criterionSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid criterion." };
  }

  if (parsed.data.maxScore < parsed.data.minScore) {
    return { error: "Maximum score must be greater than or equal to minimum score." };
  }

  const result = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: parsed.data.categoryId },
        select: { id: true },
      });

      if (!category) {
        return { error: "Category not found." };
      }

      if (parsed.data.id) {
        const currentCriterion = await tx.criterion.findUnique({
          where: { id: parsed.data.id },
          select: { updatedAt: true },
        });

        if (!currentCriterion) {
          return { error: "Criterion not found." };
        }

        if (isStaleVersion(currentCriterion.updatedAt, payload.expectedUpdatedAt)) {
          return staleAdminPageResult;
        }
      }

      const activeWeight = await tx.criterion.aggregate({
        where: {
          categoryId: parsed.data.categoryId,
          active: true,
          ...(parsed.data.id ? { NOT: { id: parsed.data.id } } : {}),
        },
        _sum: {
          weight: true,
        },
      });

      const projectedWeight = Number(activeWeight._sum.weight ?? 0) + (parsed.data.active ? parsed.data.weight : 0);
      if (projectedWeight > 100.0001) {
        return {
          error: `Total active criterion weight cannot exceed 100%. Current total would be ${projectedWeight.toFixed(2)}%.`,
        };
      }

      const data = {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        minScore: parsed.data.minScore,
        maxScore: parsed.data.maxScore,
        weight: parsed.data.weight,
        displayOrder: parsed.data.displayOrder,
        active: parsed.data.active,
      };

      if (parsed.data.id) {
        await tx.criterion.update({
          where: { id: parsed.data.id },
          data,
        });
      } else {
        await tx.criterion.create({ data });
      }

      return { success: true as const };
    }),
  );

  if ("error" in result && result.error) {
    return result;
  }

  revalidateAppData();
  return { success: true };
}

export async function reorderCriterionAction(criterionId: string, targetCriterionId: string, expectedUpdatedAt?: string) {
  await requireAdmin();

  if (criterionId === targetCriterionId) {
    return { success: true };
  }

  const result = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const [criterion, targetCriterion] = await Promise.all([
        tx.criterion.findUnique({ where: { id: criterionId }, select: { id: true, categoryId: true, updatedAt: true } }),
        tx.criterion.findUnique({ where: { id: targetCriterionId }, select: { id: true, categoryId: true } }),
      ]);

      if (!criterion || !targetCriterion) {
        return { error: "Criterion not found." };
      }

      if (criterion.categoryId !== targetCriterion.categoryId) {
        return { error: "Criteria can only be reordered within the same category." };
      }

      if (isStaleVersion(criterion.updatedAt, expectedUpdatedAt)) {
        return staleAdminPageResult;
      }

      const siblings = await tx.criterion.findMany({
        where: { categoryId: criterion.categoryId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      });
      const reordered = siblings.filter((item) => item.id !== criterionId);
      const targetIndex = reordered.findIndex((item) => item.id === targetCriterionId);

      if (targetIndex < 0) {
        return { error: "Target criterion not found." };
      }

      reordered.splice(targetIndex, 0, { id: criterionId });

      await Promise.all(
        reordered.map((item, index) =>
          tx.criterion.update({
            where: { id: item.id },
            data: { displayOrder: index + 1 },
          }),
        ),
      );

      return { success: true as const };
    }),
  );

  if ("error" in result && result.error) {
    return result;
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteCriterionAction(criterionId: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const currentCriterion = await prisma.criterion.findUnique({
    where: { id: criterionId },
    select: { updatedAt: true },
  });

  if (!currentCriterion) {
    return { error: "Criterion not found." };
  }

  if (isStaleVersion(currentCriterion.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() => prisma.criterion.delete({ where: { id: criterionId } }));

  revalidateAppData();
  return { success: true };
}

export async function upsertCriterionSubItemAction(payload: {
  id?: string;
  criterionId: string;
  name: string;
  description?: string;
  minScore: number;
  maxScore: number;
  weight: number;
  displayOrder: number;
  active: boolean;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();
  const parsed = criterionSubItemSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sub-criterion." };
  }

  if (parsed.data.maxScore < parsed.data.minScore) {
    return { error: "Maximum score must be greater than or equal to minimum score." };
  }

  const result = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const criterion = await tx.criterion.findUnique({
        where: { id: parsed.data.criterionId },
        select: { id: true },
      });

      if (!criterion) {
        return { error: "Parent criterion not found." };
      }

      if (parsed.data.id) {
        const currentSubCriterion = await tx.criterionSubItem.findUnique({
          where: { id: parsed.data.id },
          select: { updatedAt: true },
        });

        if (!currentSubCriterion) {
          return { error: "Sub-criterion not found." };
        }

        if (isStaleVersion(currentSubCriterion.updatedAt, payload.expectedUpdatedAt)) {
          return staleAdminPageResult;
        }
      }

      const activeWeight = await tx.criterionSubItem.aggregate({
        where: {
          criterionId: parsed.data.criterionId,
          active: true,
          ...(parsed.data.id ? { NOT: { id: parsed.data.id } } : {}),
        },
        _sum: {
          weight: true,
        },
      });

      const projectedWeight = Number(activeWeight._sum.weight ?? 0) + (parsed.data.active ? parsed.data.weight : 0);
      if (projectedWeight > 100.0001) {
        return {
          error: `Total active sub-criterion weight cannot exceed 100%. Current total would be ${projectedWeight.toFixed(2)}%.`,
        };
      }

      const data = {
        criterionId: parsed.data.criterionId,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        minScore: parsed.data.minScore,
        maxScore: parsed.data.maxScore,
        weight: parsed.data.weight,
        displayOrder: parsed.data.displayOrder,
        active: parsed.data.active,
      };

      if (parsed.data.id) {
        await tx.criterionSubItem.update({
          where: { id: parsed.data.id },
          data,
        });
      } else {
        await tx.criterionSubItem.create({ data });
      }

      return { success: true as const };
    }),
  );

  if ("error" in result && result.error) {
    return result;
  }

  revalidateAppData();
  return { success: true };
}

export async function reorderCriterionSubItemAction(subCriterionId: string, targetSubCriterionId: string, expectedUpdatedAt?: string) {
  await requireAdmin();

  if (subCriterionId === targetSubCriterionId) {
    return { success: true };
  }

  const result = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const [subCriterion, targetSubCriterion] = await Promise.all([
        tx.criterionSubItem.findUnique({ where: { id: subCriterionId }, select: { id: true, criterionId: true, updatedAt: true } }),
        tx.criterionSubItem.findUnique({ where: { id: targetSubCriterionId }, select: { id: true, criterionId: true } }),
      ]);

      if (!subCriterion || !targetSubCriterion) {
        return { error: "Sub-criterion not found." };
      }

      if (subCriterion.criterionId !== targetSubCriterion.criterionId) {
        return { error: "Sub-criteria can only be reordered within the same parent criterion." };
      }

      if (isStaleVersion(subCriterion.updatedAt, expectedUpdatedAt)) {
        return staleAdminPageResult;
      }

      const siblings = await tx.criterionSubItem.findMany({
        where: { criterionId: subCriterion.criterionId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      });
      const reordered = siblings.filter((item) => item.id !== subCriterionId);
      const targetIndex = reordered.findIndex((item) => item.id === targetSubCriterionId);

      if (targetIndex < 0) {
        return { error: "Target sub-criterion not found." };
      }

      reordered.splice(targetIndex, 0, { id: subCriterionId });

      await Promise.all(
        reordered.map((item, index) =>
          tx.criterionSubItem.update({
            where: { id: item.id },
            data: { displayOrder: index + 1 },
          }),
        ),
      );

      return { success: true as const };
    }),
  );

  if ("error" in result && result.error) {
    return result;
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteCriterionSubItemAction(subCriterionId: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const currentSubCriterion = await prisma.criterionSubItem.findUnique({
    where: { id: subCriterionId },
    select: { updatedAt: true },
  });

  if (!currentSubCriterion) {
    return { error: "Sub-criterion not found." };
  }

  if (isStaleVersion(currentSubCriterion.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() => prisma.criterionSubItem.delete({ where: { id: subCriterionId } }));

  revalidateAppData();
  return { success: true };
}

export async function upsertCategoryAction(payload: {
  id?: string;
  competitionId: string;
  name: string;
  description?: string;
  displayOrder: number;
  active: boolean;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();
  const parsed = categorySchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category." };
  }

  const data = {
    competitionId: parsed.data.competitionId,
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim() || null,
    displayOrder: parsed.data.displayOrder,
    active: parsed.data.active,
  };

  try {
    if (parsed.data.id) {
      const currentCategory = await prisma.category.findUnique({
        where: { id: parsed.data.id },
        select: { updatedAt: true },
      });

      if (!currentCategory) {
        return { error: "Category not found." };
      }

      if (isStaleVersion(currentCategory.updatedAt, payload.expectedUpdatedAt)) {
        return staleAdminPageResult;
      }

      await withSqliteWriteRetry(() =>
        prisma.category.update({
          where: { id: parsed.data.id },
          data,
        }),
      );
    } else {
      await withSqliteWriteRetry(() => prisma.category.create({ data }));
    }
  } catch {
    return { error: "Unable to save category. Check for duplicate category name in the same competition." };
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteCategoryAction(categoryId: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const currentCategory = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { updatedAt: true },
  });

  if (!currentCategory) {
    return { error: "Category not found." };
  }

  if (isStaleVersion(currentCategory.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() => prisma.category.delete({ where: { id: categoryId } }));

  revalidateAppData();
  return { success: true };
}

export async function updateSettingsAction(payload: {
  competitionId: string;
  judgingRounds: number;
  allowEditAfterSubmit: boolean;
  showLeaderboard: boolean;
  judgeScope: "ALL" | "ASSIGNED";
  submissionDeadline?: string;
  exportIncludeComments: boolean;
  expectedSettingsUpdatedAt?: string;
}) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const competition = await prisma.competition.findUnique({
    where: { id: parsed.data.competitionId },
    select: { id: true, name: true },
  });

  if (!competition) {
    return { error: "Competition not found." };
  }

  const currentSettings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (isStaleVersion(currentSettings?.updatedAt, payload.expectedSettingsUpdatedAt)) {
    return staleAdminPageResult;
  }

  const nextDeadline = parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null;
  const deadlineChanged =
    (currentSettings?.submissionDeadline?.getTime() ?? null) !== (nextDeadline?.getTime() ?? null) ||
    currentSettings?.competitionId !== competition.id;

  const updatedSettings = await withSqliteWriteRetry(() =>
    prisma.settings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        competitionId: competition.id,
        competitionName: competition.name,
        judgingRounds: parsed.data.judgingRounds,
        allowEditAfterSubmit: parsed.data.allowEditAfterSubmit,
        showLeaderboard: parsed.data.showLeaderboard,
        judgeScope: parsed.data.judgeScope,
        submissionDeadline: nextDeadline,
        scoringPaused: false,
        deadlineOverride: false,
        exportIncludeComments: parsed.data.exportIncludeComments,
      },
      update: {
        competitionId: competition.id,
        competitionName: competition.name,
        judgingRounds: parsed.data.judgingRounds,
        allowEditAfterSubmit: parsed.data.allowEditAfterSubmit,
        showLeaderboard: parsed.data.showLeaderboard,
        judgeScope: parsed.data.judgeScope,
        submissionDeadline: nextDeadline,
        ...(deadlineChanged ? { deadlineOverride: false } : {}),
        exportIncludeComments: parsed.data.exportIncludeComments,
      },
    }),
  );

  if (deadlineChanged) {
    await withSqliteWriteRetry(() =>
      prisma.competition.update({
        where: { id: competition.id },
        data: { deadlineOverride: false },
      }),
    );
  }

  revalidateAppData();
  return { success: true, settingsUpdatedAt: updatedSettings.updatedAt.toISOString() };
}

export async function toggleCompetitionScoringAction(resume: boolean, competitionId?: string, expectedCompetitionUpdatedAt?: string) {
  await requireAdminLike();

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const targetCompetitionId = competitionId || settings?.competitionId;
  if (!targetCompetitionId) {
    return { error: "Please select a competition before changing scoring status." };
  }

  const competition = await prisma.competition.findUnique({
    where: { id: targetCompetitionId },
    select: { updatedAt: true },
  });

  if (!competition) {
    return { error: "Competition not found." };
  }

  if (isStaleVersion(competition.updatedAt, expectedCompetitionUpdatedAt)) {
    return staleAdminPageResult;
  }

  const updatedCompetition = await withSqliteWriteRetry(() =>
    prisma.competition.update({
      where: { id: targetCompetitionId },
      data: resume
        ? {
            scoringPaused: false,
            deadlineOverride: true,
          }
        : {
            scoringPaused: true,
            deadlineOverride: false,
          },
    }),
  );

  revalidateAppData();
  return { success: true, competitionUpdatedAt: updatedCompetition.updatedAt.toISOString() };
}

export async function setCompetitionScorerStatusAction(payload: {
  competitionId: string;
  userId: string;
  canScore: boolean;
  expectedCanScore?: boolean;
}) {
  await requireAdminLike();

  const competitionId = payload.competitionId?.trim();
  const userId = payload.userId?.trim();

  if (!competitionId || !userId || typeof payload.canScore !== "boolean") {
    return { error: "Invalid scoring participant payload." };
  }

  const [competition, user, currentScorerStatus] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true },
    }),
    prisma.competitionScorer.findUnique({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      select: { canScore: true },
    }),
  ]);

  if (!competition) {
    return { error: "Competition not found." };
  }

  if (!user || !user.active || (!isAdminLikeRole(user.role) && user.role !== Role.JUDGE)) {
    return { error: "Selected account cannot be a scoring participant." };
  }

  const currentCanScore = currentScorerStatus?.canScore ?? true;
  if (typeof payload.expectedCanScore === "boolean" && currentCanScore !== payload.expectedCanScore) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() =>
    prisma.competitionScorer.upsert({
      where: {
        competitionId_userId: {
          competitionId,
          userId,
        },
      },
      create: {
        competitionId,
        userId,
        canScore: payload.canScore,
      },
      update: {
        canScore: payload.canScore,
      },
    }),
  );

  revalidateAppData();
  return { success: true };
}

export async function createCompetitionAction(payload: {
  name: string;
  description?: string;
}) {
  await requireAdmin();

  const parsed = competitionSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid competition." };
  }

  try {
    const created = await withSqliteWriteRetry(() =>
      prisma.competition.create({
        data: {
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          active: true,
        },
        select: {
          id: true,
        },
      }),
    );

    revalidateAppData();
    return {
      success: true,
      competitionId: created.id,
    };
  } catch {
    return { error: "Unable to create competition. Check for duplicate competition name." };
  }
}

export async function updateCompetitionAction(payload: {
  id: string;
  name: string;
  description?: string;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();

  const parsed = competitionSchema.safeParse({
    id: payload.id,
    name: payload.name,
    description: payload.description,
    active: true,
  });
  if (!parsed.success || !parsed.data.id) {
    return { error: parsed.error?.issues[0]?.message ?? "Invalid competition." };
  }

  try {
    const currentCompetition = await prisma.competition.findUnique({
      where: { id: parsed.data.id },
      select: { updatedAt: true },
    });

    if (!currentCompetition) {
      return { error: "Competition not found." };
    }

    if (isStaleVersion(currentCompetition.updatedAt, payload.expectedUpdatedAt)) {
      return staleAdminPageResult;
    }

    const updatedCompetition = await withSqliteWriteRetry(() =>
      prisma.$transaction(async (tx) => {
        const competition = await tx.competition.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name.trim(),
            description: parsed.data.description?.trim() || null,
          },
          select: { id: true, name: true, updatedAt: true },
        });

        await tx.settings.updateMany({
          where: { competitionId: competition.id },
          data: { competitionName: competition.name },
        });

        return competition;
      }),
    );

    revalidateAppData();
    return { success: true, competitionUpdatedAt: updatedCompetition.updatedAt.toISOString() };
  } catch {
    return { error: "Unable to update competition. Check for duplicate competition name." };
  }
}

export async function deleteCompetitionAction(competitionId: string, expectedUpdatedAt?: string) {
  await requireAdmin();

  if (!competitionId) {
    return { error: "Competition is required." };
  }

  try {
    const result = await withSqliteWriteRetry(() =>
      prisma.$transaction(async (tx) => {
        const competition = await tx.competition.findUnique({
          where: { id: competitionId },
          select: { id: true, updatedAt: true },
        });

        if (!competition) {
          throw new Error("Competition not found.");
        }

        if (isStaleVersion(competition.updatedAt, expectedUpdatedAt)) {
          return staleAdminPageResult;
        }

        const fallbackCompetition = await tx.competition.findFirst({
          where: {
            active: true,
            NOT: { id: competitionId },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });

        await tx.settings.updateMany({
          where: { competitionId },
          data: {
            competitionId: fallbackCompetition?.id ?? null,
            competitionName: fallbackCompetition?.name ?? "Competition",
          },
        });

        await tx.competition.delete({
          where: { id: competitionId },
        });

        return {
          success: true as const,
          nextCompetitionId: fallbackCompetition?.id ?? "",
        };
      }),
    );

    if (!("success" in result)) {
      return result;
    }

    revalidateAppData();
    return { success: true, nextCompetitionId: result.nextCompetitionId };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Unable to delete competition." };
  }
}

export async function addCompetitionImageAction(payload: {
  competitionId: string;
  imageUrl: string;
  imageName?: string;
}) {
  await requireAdmin();

  const parsed = competitionImageSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid competition image." };
  }

  let image;
  try {
    image = await withSqliteWriteRetry(() =>
      prisma.$transaction(async (tx) => {
        const competition = await tx.competition.findUnique({
          where: { id: parsed.data.competitionId },
          select: { id: true },
        });

        if (!competition) {
          throw new Error("Competition not found.");
        }

        const count = await tx.competitionImage.count({
          where: { competitionId: parsed.data.competitionId },
        });

        return tx.competitionImage.create({
          data: {
            competitionId: parsed.data.competitionId,
            imageUrl: parsed.data.imageUrl.trim(),
            imageName: parsed.data.imageName?.trim() || null,
            displayOrder: count + 1,
          },
        });
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Unable to save competition image." };
  }

  revalidateAppData();
  return {
    success: true,
    image: {
      id: image.id,
      competitionId: image.competitionId,
      imageUrl: image.imageUrl,
      imageName: image.imageName,
      displayOrder: image.displayOrder,
    },
  };
}

export async function deleteCompetitionImageAction(imageId: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const currentImage = await prisma.competitionImage.findUnique({
    where: { id: imageId },
    select: { updatedAt: true },
  });

  if (!currentImage) {
    return { error: "Competition image not found." };
  }

  if (isStaleVersion(currentImage.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() => prisma.competitionImage.delete({ where: { id: imageId } }));

  revalidateAppData();
  return { success: true };
}

export async function upsertUserAccountAction(payload: {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "CHIEF_JUDGE" | "JUDGE" | "TEAM";
  active: boolean;
  linkedTeamId?: string;
  expectedUpdatedAt?: string;
}) {
  await requireAdmin();

  const parsed = userAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid account." };
  }

  try {
    if (parsed.data.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: parsed.data.id },
        select: { updatedAt: true },
      });

      if (!currentUser) {
        return { error: "Account not found." };
      }

      if (isStaleVersion(currentUser.updatedAt, payload.expectedUpdatedAt)) {
        return staleAdminPageResult;
      }
    }

    await withSqliteWriteRetry(() =>
      prisma.$transaction(async (tx) => {
        if (parsed.data.role === "TEAM" && parsed.data.linkedTeamId) {
          const linkedTeam = await tx.team.findUnique({
            where: { id: parsed.data.linkedTeamId },
          });

          if (!linkedTeam) {
            throw new Error("Linked team not found.");
          }

          if (linkedTeam.ownerUserId && linkedTeam.ownerUserId !== parsed.data.id) {
            throw new Error("This team already has a linked account.");
          }
        }

        const user = parsed.data.id
          ? await tx.user.update({
              where: { id: parsed.data.id },
              data: {
                name: parsed.data.name.trim(),
                email: parsed.data.email.trim().toLowerCase(),
                role: parsed.data.role,
                active: parsed.data.active,
                ...(parsed.data.password
                  ? {
                      passwordHash: await bcrypt.hash(parsed.data.password, 10),
                    }
                  : {}),
              },
            })
          : await tx.user.create({
              data: {
                name: parsed.data.name.trim(),
                email: parsed.data.email.trim().toLowerCase(),
                passwordHash: await bcrypt.hash(parsed.data.password || "Demo123!", 10),
                role: parsed.data.role,
                active: parsed.data.active,
              },
            });

        if (parsed.data.role !== "TEAM") {
          await tx.team.updateMany({
            where: { ownerUserId: user.id },
            data: { ownerUserId: null },
          });
        } else if (parsed.data.linkedTeamId) {
          await tx.team.update({
            where: { id: parsed.data.linkedTeamId },
            data: { ownerUserId: user.id },
          });
        }
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Unable to save account. Check for duplicate email." };
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteUserAccountAction(userId: string, expectedUpdatedAt?: string) {
  const admin = await requireAdmin();
  const targetUserId = userId.trim();

  if (!targetUserId) {
    return { error: "Account is required." };
  }

  if (targetUserId === admin.id) {
    return { error: "You cannot delete your own account while signed in." };
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, active: true, updatedAt: true },
  });

  if (!user) {
    return { error: "Account not found." };
  }

  if (isStaleVersion(user.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  if (user.role === Role.ADMIN && user.active) {
    const adminCount = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        active: true,
      },
    });

    if (adminCount <= 1) {
      return { error: "You cannot delete the last active admin account." };
    }
  }

  await withSqliteWriteRetry(() => prisma.user.delete({ where: { id: targetUserId } }));

  revalidateAppData();
  return { success: true };
}

export async function approveTeamSubmissionAction(teamId: string, expectedUpdatedAt?: string) {
  const admin = await requireAdmin();
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return { error: "Team not found." };
  }

  if (!team.categoryId) {
    return { error: "Team must be assigned to a category before approval." };
  }

  if (isStaleVersion(team.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() =>
    prisma.team.update({
      where: { id: teamId },
      data: {
        submissionStatus: ApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: admin.id,
        reviewNote: null,
      },
    }),
  );

  revalidateAppData();
  return { success: true };
}

export async function rejectTeamSubmissionAction(teamId: string, reviewNote?: string, expectedUpdatedAt?: string) {
  await requireAdmin();
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { updatedAt: true },
  });

  if (!team) {
    return { error: "Team not found." };
  }

  if (isStaleVersion(team.updatedAt, expectedUpdatedAt)) {
    return staleAdminPageResult;
  }

  await withSqliteWriteRetry(() =>
    prisma.team.update({
      where: { id: teamId },
      data: {
        submissionStatus: ApprovalStatus.REJECTED,
        approvedAt: null,
        approvedById: null,
        reviewNote: reviewNote?.trim() || "Please revise the submission and resubmit for admin approval.",
      },
    }),
  );

  revalidateAppData();
  return { success: true };
}

async function saveTeamSubmission(
  payload: {
    teamCode?: string;
    teamName: string;
    competitionId: string;
    categoryId: string;
    projectTitle: string;
    projectDescription: string;
    organization?: string;
    teamMembers: string;
    videoUrl?: string;
    imageUrl?: string;
    documentUrl?: string;
    documentName?: string;
    documentLinks?: DocumentLink[];
  },
  mode: "draft" | "submit",
) {
  const { user } = await requireTeamUser();

  const parsed = teamSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission data." };
  }

  const competitionValidationError = await validateOpenCompetition(parsed.data.competitionId);
  if (competitionValidationError) {
    return { error: competitionValidationError };
  }

  const categoryValidationError = await validateCategoryCompetition(parsed.data.categoryId, parsed.data.competitionId);
  if (categoryValidationError) {
    return { error: categoryValidationError };
  }

  const team = await prisma.team.findFirst({
    where: {
      ownerUserId: user.id,
      category: {
        competitionId: parsed.data.competitionId,
      },
    },
  });

  if (team?.submissionStatus === ApprovalStatus.APPROVED) {
    return { error: "This submission has already been approved by the admin." };
  }

  const updated = await withSqliteWriteRetry(() =>
    prisma.$transaction(async (tx) => {
      const data = buildTeamData(parsed.data);

      if (team) {
        return tx.team.update({
          where: { id: team.id },
          data: {
            ...data,
            submissionStatus: mode === "submit" ? ApprovalStatus.PENDING : ApprovalStatus.DRAFT,
            submittedAt: mode === "submit" ? new Date() : team.submittedAt,
            approvedAt: null,
            approvedById: null,
            reviewNote: mode === "submit" ? null : data.reviewNote,
          },
        });
      }

      return tx.team.create({
        data: {
          ...data,
          teamCode: await generateNextTeamCode(tx),
          ownerUserId: user.id,
          submissionStatus: mode === "submit" ? ApprovalStatus.PENDING : ApprovalStatus.DRAFT,
          submittedAt: mode === "submit" ? new Date() : null,
          approvedAt: null,
          approvedById: null,
          reviewNote: mode === "submit" ? null : data.reviewNote,
        },
      });
    }),
  );

  revalidateAppData();
  return {
    success: true,
    team: {
      id: updated.id,
      teamCode: updated.teamCode,
      submissionStatus: updated.submissionStatus,
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

export async function saveTeamDraftAction(payload: {
  teamCode?: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
  documentUrl?: string;
  documentName?: string;
  documentLinks?: DocumentLink[];
}) {
  return saveTeamSubmission(payload, "draft");
}

export async function submitTeamForApprovalAction(payload: {
  teamCode?: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
  documentUrl?: string;
  documentName?: string;
  documentLinks?: DocumentLink[];
}) {
  return saveTeamSubmission(payload, "submit");
}
