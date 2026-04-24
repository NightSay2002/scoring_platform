"use server";

import bcrypt from "bcryptjs";
import { ApprovalStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withSqliteWriteRetry } from "@/lib/sqlite-write-retry";
import {
  competitionSchema,
  categorySchema,
  criterionSchema,
  settingsSchema,
  teamSchema,
  userAccountSchema,
} from "@/lib/validators";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== Role.ADMIN) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

async function requireTeamUser() {
  const session = await auth();

  if (!session?.user || session.user.role !== Role.TEAM) {
    throw new Error("Unauthorized");
  }

  const team = await prisma.team.findUnique({
    where: { ownerUserId: session.user.id },
  });

  if (!team) {
    throw new Error("No team is linked to this account.");
  }

  return {
    user: session.user,
    team,
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

function buildTeamData(parsed: ReturnType<typeof teamSchema.parse>) {
  return {
    teamCode: parsed.teamCode.trim(),
    teamName: parsed.teamName.trim(),
    categoryId: parsed.categoryId,
    projectTitle: parsed.projectTitle.trim(),
    projectDescription: parsed.projectDescription.trim(),
    organization: parsed.organization?.trim() || null,
    teamMembers: parsed.teamMembers.trim(),
    videoUrl: parsed.videoUrl?.trim() || null,
    imageUrl: parsed.imageUrl?.trim() || null,
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

export async function upsertTeamAction(payload: {
  id?: string;
  teamCode: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
  submissionStatus?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string;
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

  const data = buildTeamData(parsed.data);

  try {
    if (parsed.data.id) {
      await withSqliteWriteRetry(() =>
        prisma.team.update({
          where: { id: parsed.data.id },
          data: {
            ...data,
            ...(parsed.data.submissionStatus ? { submissionStatus: parsed.data.submissionStatus } : {}),
          },
        }),
      );
    } else {
      await withSqliteWriteRetry(() =>
        prisma.team.create({
          data: {
            ...data,
            submissionStatus: parsed.data.submissionStatus ?? ApprovalStatus.DRAFT,
          },
        }),
      );
    }
  } catch {
    return { error: "Unable to save team. Check for duplicate team code or invalid category." };
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteTeamAction(teamId: string) {
  await requireAdmin();
  await withSqliteWriteRetry(() => prisma.team.delete({ where: { id: teamId } }));

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
    return { error: result.error };
  }

  revalidateAppData();
  return { success: true };
}

export async function deleteCriterionAction(criterionId: string) {
  await requireAdmin();
  await withSqliteWriteRetry(() => prisma.criterion.delete({ where: { id: criterionId } }));

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

export async function deleteCategoryAction(categoryId: string) {
  await requireAdmin();
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

  await withSqliteWriteRetry(() =>
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
        submissionDeadline: parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null,
        exportIncludeComments: parsed.data.exportIncludeComments,
      },
      update: {
        competitionId: competition.id,
        competitionName: competition.name,
        judgingRounds: parsed.data.judgingRounds,
        allowEditAfterSubmit: parsed.data.allowEditAfterSubmit,
        showLeaderboard: parsed.data.showLeaderboard,
        judgeScope: parsed.data.judgeScope,
        submissionDeadline: parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null,
        exportIncludeComments: parsed.data.exportIncludeComments,
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

export async function upsertUserAccountAction(payload: {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "JUDGE" | "TEAM";
  active: boolean;
  linkedTeamId?: string;
}) {
  await requireAdmin();

  const parsed = userAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid account." };
  }

  if (parsed.data.role === "TEAM" && !parsed.data.linkedTeamId) {
    return { error: "A team account must be linked to a team submission." };
  }

  try {
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

        await tx.team.updateMany({
          where: { ownerUserId: user.id },
          data: { ownerUserId: null },
        });

        if (parsed.data.role === "TEAM" && parsed.data.linkedTeamId) {
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

export async function approveTeamSubmissionAction(teamId: string) {
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

export async function rejectTeamSubmissionAction(teamId: string, reviewNote?: string) {
  await requireAdmin();

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
    teamCode: string;
    teamName: string;
    competitionId: string;
    categoryId: string;
    projectTitle: string;
    projectDescription: string;
    organization?: string;
    teamMembers: string;
    videoUrl?: string;
    imageUrl?: string;
  },
  mode: "draft" | "submit",
) {
  const { team } = await requireTeamUser();

  const parsed = teamSchema.safeParse({
    ...payload,
    id: team.id,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission data." };
  }

  if (team.submissionStatus === ApprovalStatus.APPROVED) {
    return { error: "This submission has already been approved by the admin." };
  }

  const categoryValidationError = await validateCategoryCompetition(parsed.data.categoryId, parsed.data.competitionId);
  if (categoryValidationError) {
    return { error: categoryValidationError };
  }

  const data = buildTeamData(parsed.data);

  const updated = await withSqliteWriteRetry(() =>
    prisma.team.update({
      where: { id: team.id },
      data: {
        ...data,
        submissionStatus: mode === "submit" ? ApprovalStatus.PENDING : ApprovalStatus.DRAFT,
        submittedAt: mode === "submit" ? new Date() : team.submittedAt,
        approvedAt: null,
        approvedById: null,
        reviewNote: mode === "submit" ? null : data.reviewNote,
      },
    }),
  );

  revalidateAppData();
  return {
    success: true,
    team: {
      id: updated.id,
      submissionStatus: updated.submissionStatus,
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

export async function saveTeamDraftAction(payload: {
  teamCode: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
}) {
  return saveTeamSubmission(payload, "draft");
}

export async function submitTeamForApprovalAction(payload: {
  teamCode: string;
  teamName: string;
  competitionId: string;
  categoryId: string;
  projectTitle: string;
  projectDescription: string;
  organization?: string;
  teamMembers: string;
  videoUrl?: string;
  imageUrl?: string;
}) {
  return saveTeamSubmission(payload, "submit");
}
