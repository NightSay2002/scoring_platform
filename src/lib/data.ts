import { ApprovalStatus, Prisma, ScoreStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime, parseDocumentLinks, parseMembers, round } from "@/lib/utils";

const teamInclude = {
  category: {
    include: {
      competition: true,
    },
  },
  ownerUser: true,
  approvedBy: true,
  scores: {
    include: {
      judge: true,
      items: {
        include: {
          criterion: {
            include: {
              subCriteria: true,
            },
          },
          subItems: {
            include: {
              subCriterion: true,
            },
          },
        },
      },
    },
  },
  assignments: {
    include: {
      judge: true,
    },
  },
} satisfies Prisma.TeamInclude;

type TeamWithRelations = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

function getActiveCompetitionId(settings: { competitionId: string | null } | null) {
  return settings?.competitionId ?? null;
}

function getScoringAvailability(
  settings: { competitionId: string | null; scoringPaused: boolean; submissionDeadline: Date | null; deadlineOverride: boolean } | null,
  competition?: { id: string; scoringPaused: boolean; deadlineOverride: boolean } | null,
) {
  const scoringPaused = competition?.scoringPaused ?? settings?.scoringPaused ?? false;
  const deadlineOverride = competition?.deadlineOverride ?? settings?.deadlineOverride ?? false;
  const deadlineApplies = !competition?.id || !settings?.competitionId || settings.competitionId === competition.id;
  const submissionDeadline = deadlineApplies ? settings?.submissionDeadline : null;

  if (scoringPaused) {
    return {
      scoringClosed: true,
      scoringClosedReason: "Competition has ended. Scoring is currently closed.",
    };
  }

  if (submissionDeadline && submissionDeadline.getTime() <= Date.now() && !deadlineOverride) {
    return {
      scoringClosed: true,
      scoringClosedReason: "The submission deadline has passed. Scoring is currently closed.",
    };
  }

  return {
    scoringClosed: false,
    scoringClosedReason: "",
  };
}

async function resolveCompetitionScope(requestedCompetitionId?: string) {
  const [settings, competitions] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.competition.findMany({
      where: { active: true },
      include: {
        images: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const fallbackCompetitionId = settings?.competitionId ?? competitions[0]?.id ?? null;
  const selectedCompetitionId =
    requestedCompetitionId && competitions.some((competition) => competition.id === requestedCompetitionId)
      ? requestedCompetitionId
      : fallbackCompetitionId;

  return {
    settings,
    competitions,
    selectedCompetitionId,
  };
}

function getSubmittedScores(team: TeamWithRelations) {
  return team.scores.filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED);
}

function getAllVisibleJudgeIds(
  settings: { judgeScope: "ALL" | "ASSIGNED" } | null,
  team: TeamWithRelations,
  allJudgeIds: string[],
) {
  return settings?.judgeScope === "ASSIGNED" ? team.assignments.map((assignment) => assignment.judgeId) : allJudgeIds;
}

function computeTeamMetrics(
  team: TeamWithRelations,
  settings: { judgeScope: "ALL" | "ASSIGNED" } | null,
  allJudgeIds: string[],
) {
  const submitted = getSubmittedScores(team);
  const expectedJudgeIds = getAllVisibleJudgeIds(settings, team, allJudgeIds);

  return {
    submitted,
    expectedJudgeIds,
    averageScore: submitted.length
      ? round(submitted.reduce((sum, score) => sum + score.weightedScore, 0) / submitted.length)
      : 0,
    weightedScore: submitted.length
      ? round(submitted.reduce((sum, score) => sum + score.weightedScore, 0) / submitted.length)
      : 0,
  };
}

function getApprovedTeams(teams: TeamWithRelations[]) {
  return teams.filter((team) => team.status === "ACTIVE" && team.submissionStatus === ApprovalStatus.APPROVED);
}

function getRankedRows(teams: TeamWithRelations[], settings: { judgeScope: "ALL" | "ASSIGNED" } | null, judgeNames: Array<{ id: string; name: string }>) {
  const allJudgeIds = judgeNames.map((judge) => judge.id);

  return teams
    .map((team) => {
      const metrics = computeTeamMetrics(team, settings, allJudgeIds);
      const submittedByJudgeId = new Map(metrics.submitted.map((score) => [score.judgeId, score]));
      const pendingJudgeNames = judgeNames
        .filter((judge) => metrics.expectedJudgeIds.includes(judge.id))
        .filter((judge) => !metrics.submitted.some((score) => score.judgeId === judge.id))
        .map((judge) => judge.name);

      return {
        id: team.id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        categoryId: team.categoryId,
        categoryName: team.category?.name ?? "Uncategorized",
        projectTitle: team.projectTitle,
        averageScore: metrics.averageScore,
        weightedScore: metrics.weightedScore,
        submittedCount: metrics.submitted.length,
        expectedCount: metrics.expectedJudgeIds.length,
        completionRate: metrics.expectedJudgeIds.length ? round((metrics.submitted.length / metrics.expectedJudgeIds.length) * 100, 0) : 0,
        pendingJudgeNames,
        perJudgeScores: judgeNames
          .filter((judge) => metrics.expectedJudgeIds.includes(judge.id))
          .map((judge) => {
            const judgeScore = submittedByJudgeId.get(judge.id);

            return {
              judgeName: judge.name,
              score: judgeScore?.weightedScore ?? null,
              status: judgeScore?.status ?? "PENDING",
              scoreComment: judgeScore?.comment ?? "",
              updatedAt: judgeScore?.updatedAt.toISOString() ?? null,
              criterionScores:
                judgeScore?.items
                  .slice()
                  .sort((a, b) => a.criterion.displayOrder - b.criterion.displayOrder)
                  .map((item) => ({
                    criterionName: item.criterion.name,
                    numericScore: item.numericScore,
                    comment: item.comment,
                    subScores: item.subItems
                      .slice()
                      .sort((a, b) => a.subCriterion.displayOrder - b.subCriterion.displayOrder)
                      .map((subItem) => ({
                        subCriterionName: subItem.subCriterion.name,
                        numericScore: subItem.numericScore,
                        weightedValue: subItem.weightedValue,
                        weight: subItem.subCriterion.weight,
                        comment: subItem.comment,
                      })),
                  })) ?? [],
            };
          }),
      };
    })
    .sort((a, b) => {
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }

      return a.teamCode.localeCompare(b.teamCode);
    });
}

export async function getAdminDashboardData() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const activeCompetitionId = getActiveCompetitionId(settings);

  const [teams, judges, recentAudits] = await Promise.all([
    prisma.team.findMany({
      where: activeCompetitionId
        ? {
            OR: [
              { category: { competitionId: activeCompetitionId } },
              { categoryId: null },
            ],
          }
        : undefined,
      include: teamInclude,
      orderBy: { teamCode: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "JUDGE", active: true },
      include: {
        assignments: activeCompetitionId
          ? {
              where: {
                team: {
                  category: {
                    competitionId: activeCompetitionId,
                  },
                },
              },
            }
          : true,
        scores: activeCompetitionId
          ? {
              where: {
                team: {
                  category: {
                    competitionId: activeCompetitionId,
                  },
                },
              },
              orderBy: { updatedAt: "desc" },
            }
          : {
              orderBy: { updatedAt: "desc" },
            },
      },
      orderBy: { name: "asc" },
    }),
    prisma.scoreAudit.findMany({
      where: activeCompetitionId
        ? {
            score: {
              team: {
                category: {
                  competitionId: activeCompetitionId,
                },
              },
            },
          }
        : undefined,
      include: {
        actor: true,
        score: {
          include: {
            team: {
              include: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const approvedTeams = getApprovedTeams(teams);
  const judgeNames = judges.map((judge) => ({ id: judge.id, name: judge.name }));
  const rankedRows = getRankedRows(approvedTeams, settings, judgeNames);
  const allJudgeIds = judgeNames.map((judge) => judge.id);
  const pendingApprovalTeams = teams.filter((team) => team.submissionStatus === ApprovalStatus.PENDING).length;
  const approvedCount = approvedTeams.length;

  const submittedScores = approvedTeams.reduce((sum, team) => sum + getSubmittedScores(team).length, 0);
  const expectedScores = approvedTeams.reduce((sum, team) => {
    return sum + getAllVisibleJudgeIds(settings, team, allJudgeIds).length;
  }, 0);

  const judgeProgress = judges.map((judge) => {
    const visibleApprovedTeams =
      settings?.judgeScope === "ASSIGNED"
        ? approvedTeams.filter((team) => team.assignments.some((assignment) => assignment.judgeId === judge.id))
        : approvedTeams;
    const submittedCount = judge.scores.filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED).length;
    const draftCount = judge.scores.filter((score) => score.status === ScoreStatus.DRAFT).length;

    return {
      id: judge.id,
      name: judge.name,
      assignedTeams: visibleApprovedTeams.length,
      submittedCount,
      draftCount,
      pendingCount: Math.max(visibleApprovedTeams.length - submittedCount, 0),
      lastActivity: judge.scores[0]?.updatedAt ?? judge.lastLoginAt ?? judge.updatedAt,
    };
  });

  return {
    settings,
    stats: [
      { label: "Team accounts", value: teams.length, help: "Competition team submissions" },
      { label: "Approved for judging", value: approvedCount, help: "Visible to judges now" },
      { label: "Pending approval", value: pendingApprovalTeams, help: "Waiting for admin review" },
      { label: "Submitted scores", value: `${submittedScores}/${expectedScores}`, help: "Completed scoring records" },
    ],
    leaderboard: rankedRows.slice(0, 5),
    recentAudits: recentAudits.map((audit) => ({
      id: audit.id,
      action: audit.action,
      actor: audit.actor.name,
      team: audit.score.team.teamName,
      category: audit.score.team.category?.name ?? "Uncategorized",
      createdAt: audit.createdAt,
    })),
    judgeProgress,
    categorySummary: Array.from(
      new Map(
        rankedRows.map((row) => [
          row.categoryName,
          {
            categoryName: row.categoryName,
            leader: row.teamName,
            averageScore: row.averageScore,
          },
        ]),
      ).values(),
    ),
  };
}

export async function getTeamsManagementData() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [teams, judges, teamAccounts, competitions, categories] = await Promise.all([
    prisma.team.findMany({
      include: teamInclude,
      orderBy: [{ teamCode: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "JUDGE", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TEAM", active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.competition.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: {
        active: true,
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const allJudgeIds = judges.map((judge) => judge.id);

  return {
    teams: teams.map((team) => {
      const metrics = computeTeamMetrics(team, settings, allJudgeIds);

      return {
        id: team.id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        competitionId: team.category?.competitionId ?? "",
        competitionName: team.category?.competition?.name ?? "Uncategorized",
        categoryId: team.categoryId ?? "",
        categoryName: team.category?.name ?? "Uncategorized",
        ownerUserId: team.ownerUserId ?? "",
        ownerEmail: team.ownerUser?.email ?? "",
        projectTitle: team.projectTitle,
        projectDescription: team.projectDescription,
        organization: team.organization ?? "",
        teamMembers: team.teamMembers,
        videoUrl: team.videoUrl ?? "",
        imageUrl: team.imageUrl ?? "",
        documentUrl: team.documentUrl ?? "",
        documentName: team.documentName ?? "",
        documentLinks: parseDocumentLinks(team.documentLinks, {
          documentName: team.documentName,
          documentUrl: team.documentUrl,
        }),
        submissionStatus: team.submissionStatus,
        reviewNote: team.reviewNote ?? "",
        submittedCount: metrics.submitted.length,
        expectedCount: metrics.expectedJudgeIds.length,
        averageScore: metrics.averageScore,
        weightedScore: metrics.weightedScore,
        updatedAt: team.updatedAt,
      };
    }),
    competitions,
    teamAccounts,
    categories: categories.map((category) => ({
      id: category.id,
      competitionId: category.competitionId,
      competitionName: category.competition.name,
      name: category.name,
    })),
    judges,
    judgeScope: settings?.judgeScope ?? "ALL",
  };
}

export async function getCommentsReviewData(filters: {
  teamId?: string;
  judgeId?: string;
  status?: string;
  categoryId?: string;
  query?: string;
}) {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const activeCompetitionId = getActiveCompetitionId(settings);
  const teamScopeForScores = filters.categoryId
    ? { categoryId: filters.categoryId }
    : activeCompetitionId
      ? { category: { competitionId: activeCompetitionId } }
      : {};

  const [teams, judges, categories, scores] = await Promise.all([
    prisma.team.findMany({
      where: activeCompetitionId
        ? {
            category: {
              competitionId: activeCompetitionId,
            },
          }
        : undefined,
      select: { id: true, teamName: true },
      orderBy: { teamName: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "JUDGE", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: activeCompetitionId ? { competitionId: activeCompetitionId } : undefined,
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.score.findMany({
      where: {
        ...(filters.teamId ? { teamId: filters.teamId } : {}),
        ...(filters.judgeId ? { judgeId: filters.judgeId } : {}),
        ...(filters.status && filters.status !== "ALL" ? { status: filters.status as ScoreStatus } : {}),
        ...(Object.keys(teamScopeForScores).length
          ? {
              team: teamScopeForScores,
            }
          : {}),
        ...(filters.query
          ? {
              comment: {
                contains: filters.query,
              },
            }
          : {}),
      },
      include: {
        team: {
          include: {
            category: true,
          },
        },
        judge: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  return {
    teams,
    judges,
    categories,
    scores,
  };
}

export async function getLeaderboardData(competitionId?: string) {
  const { settings, competitions, selectedCompetitionId } = await resolveCompetitionScope(competitionId);
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId) ?? null;

  const [teams, judges, categories] = await Promise.all([
    prisma.team.findMany({
      where: selectedCompetitionId
        ? {
            category: {
              competitionId: selectedCompetitionId,
            },
          }
        : undefined,
      include: teamInclude,
      orderBy: { teamCode: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "JUDGE", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: selectedCompetitionId ? { competitionId: selectedCompetitionId } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const approvedTeams = getApprovedTeams(teams);
  const judgeNames = judges.map((judge) => ({ id: judge.id, name: judge.name }));
  const overallRows = getRankedRows(approvedTeams, settings, judgeNames).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  const categorySections = categories.map((category) => {
    const rows = getRankedRows(
      approvedTeams.filter((team) => team.categoryId === category.id),
      settings,
      judgeNames,
    ).map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      rows,
      podium: rows.slice(0, 3),
    };
  });

  return {
    settings,
    scoringAvailability: getScoringAvailability(settings, selectedCompetition),
    competitions,
    selectedCompetitionId: selectedCompetitionId ?? "",
    overallRows,
    categorySections,
    judges,
  };
}

export async function getSettingsPageData(competitionId?: string) {
  const { settings, competitions, selectedCompetitionId } = await resolveCompetitionScope(competitionId);

  const [criteria, categories, accounts, teams] = await Promise.all([
    prisma.criterion.findMany({
      where: selectedCompetitionId
        ? {
            category: {
              competitionId: selectedCompetitionId,
            },
          }
        : undefined,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subCriteria: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }],
    }),
    prisma.category.findMany({
      where: selectedCompetitionId ? { competitionId: selectedCompetitionId } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        ownedTeam: {
          include: {
            category: true,
          },
        },
        assignments: true,
        scores: {
          where: {
            status: {
              in: [ScoreStatus.SUBMITTED, ScoreStatus.EDITED],
            },
            ...(selectedCompetitionId
              ? {
                  team: {
                    category: {
                      competitionId: selectedCompetitionId,
                    },
                  },
                }
              : {}),
          },
        },
      },
    }),
    prisma.team.findMany({
      where: selectedCompetitionId
        ? {
            category: {
              competitionId: selectedCompetitionId,
            },
          }
        : undefined,
      select: {
        id: true,
        teamCode: true,
        teamName: true,
        ownerUserId: true,
      },
      orderBy: { teamCode: "asc" },
    }),
  ]);

  return {
    settings,
    competitions,
    selectedCompetitionId: selectedCompetitionId ?? "",
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      categoryId: criterion.categoryId,
      categoryName: criterion.category.name,
      name: criterion.name,
      description: criterion.description,
      minScore: criterion.minScore,
      maxScore: criterion.maxScore,
      weight: criterion.weight,
      displayOrder: criterion.displayOrder,
      active: criterion.active,
      subCriteria: criterion.subCriteria.map((subCriterion) => ({
        id: subCriterion.id,
        criterionId: subCriterion.criterionId,
        name: subCriterion.name,
        description: subCriterion.description,
        minScore: subCriterion.minScore,
        maxScore: subCriterion.maxScore,
        weight: subCriterion.weight,
        displayOrder: subCriterion.displayOrder,
        active: subCriterion.active,
      })),
    })),
    categories,
    teams,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      active: account.active,
      assignmentCount: account.assignments.length,
      submittedCount: account.scores.length,
      linkedTeamId: account.ownedTeam?.id ?? "",
      linkedTeamLabel: account.ownedTeam ? `${account.ownedTeam.teamCode} · ${account.ownedTeam.teamName}` : "",
      categoryName: account.ownedTeam?.category?.name ?? "",
    })),
  };
}

export async function getJudgeDashboardData(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [judge, teams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignments: true,
        scores: {
          include: {
            team: {
              include: {
                category: {
                  include: {
                    competition: true,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.team.findMany({
      where: {
        status: "ACTIVE",
        submissionStatus: ApprovalStatus.APPROVED,
      },
      include: {
        category: {
          include: {
            competition: {
              include: {
                images: {
                  orderBy: { displayOrder: "asc" },
                },
              },
            },
          },
        },
        scores: {
          where: { judgeId: userId },
        },
        assignments: {
          where: { judgeId: userId },
        },
      },
      orderBy: [{ category: { displayOrder: "asc" } }, { teamCode: "asc" }],
    }),
  ]);

  if (!judge) {
    return null;
  }

  const visibleTeams = settings?.judgeScope === "ASSIGNED" ? teams.filter((team) => team.assignments.length > 0) : teams;
  const submittedCount = judge.scores.filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED).length;
  const draftCount = judge.scores.filter((score) => score.status === ScoreStatus.DRAFT).length;
  const completionRate = visibleTeams.length ? round((submittedCount / visibleTeams.length) * 100, 0) : 0;
  const competitions = Array.from(
    new Map(
      visibleTeams
        .filter((team) => team.category?.competition)
        .map((team) => [
          team.category?.competition?.id ?? "",
          {
            id: team.category?.competition?.id ?? "",
            name: team.category?.competition?.name ?? "",
            description: team.category?.competition?.description ?? null,
            images:
              team.category?.competition?.images.map((image) => ({
                id: image.id,
                imageUrl: image.imageUrl,
                imageName: image.imageName,
                displayOrder: image.displayOrder,
              })) ?? [],
          },
        ]),
    ).values(),
  ).filter((competition) => competition.id);
  const categories = Array.from(
    new Map(
      visibleTeams
        .filter((team) => team.category)
        .map((team) => [
          team.category?.id ?? "",
          {
            id: team.category?.id ?? "",
            name: team.category?.name ?? "",
            competitionId: team.category?.competitionId ?? "",
            competitionName: team.category?.competition?.name ?? "",
          },
        ]),
    ).values(),
  ).filter((category) => category.id);

  return {
    judge,
    settings,
    visibleTeams: visibleTeams.map((team) => ({
      id: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      competitionId: team.category?.competitionId ?? "",
      competitionName: team.category?.competition?.name ?? "Uncategorized",
      categoryId: team.category?.id ?? "",
      categoryName: team.category?.name ?? "Uncategorized",
      projectTitle: team.projectTitle,
      status: (team.scores[0]?.status ?? "PENDING") as ScoreStatus | "PENDING",
      updatedAt: team.scores[0]?.updatedAt ?? team.updatedAt,
    })),
    stats: {
      assignedCount: visibleTeams.length,
      submittedCount,
      draftCount,
      pendingCount: Math.max(visibleTeams.length - submittedCount, 0),
      completionRate,
    },
    competitions,
    categories,
    recentScores: judge.scores.slice(0, 4),
  };
}

export async function getJudgeTeamsData(userId: string) {
  return getJudgeDashboardData(userId);
}

export async function getJudgeScoringPageData(userId: string, teamId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [allTeams, team, existingScore] = await Promise.all([
    prisma.team.findMany({
      where: {
        status: "ACTIVE",
        submissionStatus: ApprovalStatus.APPROVED,
      },
      select: {
        id: true,
        teamCode: true,
        teamName: true,
        assignments: {
          where: { judgeId: userId },
          select: { id: true },
        },
        scores: {
          where: { judgeId: userId },
          select: {
            status: true,
          },
        },
      },
      orderBy: { teamCode: "asc" },
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        category: {
          include: {
            competition: true,
          },
        },
        scores: {
          where: { judgeId: userId },
          include: {
            items: {
              include: {
                subItems: true,
              },
            },
          },
        },
      },
    }),
    prisma.score.findUnique({
      where: {
        teamId_judgeId: {
          teamId,
          judgeId: userId,
        },
      },
      include: {
        items: {
          include: {
            subItems: true,
          },
        },
      },
    }),
  ]);

  if (!team || team.submissionStatus !== ApprovalStatus.APPROVED || !team.categoryId) {
    return null;
  }

  const criteria = await prisma.criterion.findMany({
    where: {
      categoryId: team.categoryId,
      active: true,
    },
    include: {
      subCriteria: {
        where: { active: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  const isVisible = settings?.judgeScope === "ALL" || allTeams.some((entry) => entry.id === teamId && entry.assignments.length > 0);
  if (!isVisible) {
    return null;
  }

  const visibleTeams = settings?.judgeScope === "ALL" ? allTeams : allTeams.filter((entry) => entry.assignments.length > 0);
  const currentIndex = visibleTeams.findIndex((entry) => entry.id === teamId);
  const submittedCount = visibleTeams.filter((entry) =>
    entry.scores.some((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED),
  ).length;

  return {
    settings,
    scoringAvailability: getScoringAvailability(settings, team.category?.competition ?? null),
    criteria,
    team: {
      ...team,
      documentLinks: parseDocumentLinks(team.documentLinks, {
        documentName: team.documentName,
        documentUrl: team.documentUrl,
      }),
      members: parseMembers(team.teamMembers),
    },
    existingScore,
    navigation: {
      previousTeamId: currentIndex > 0 ? visibleTeams[currentIndex - 1]?.id : null,
      nextTeamId: currentIndex < visibleTeams.length - 1 ? visibleTeams[currentIndex + 1]?.id : null,
      currentIndex: currentIndex + 1,
      totalTeams: visibleTeams.length,
      submittedCount,
    },
  };
}

export async function getTeamPortalData(userId: string) {
  const [settings, team] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.team.findUnique({
      where: { ownerUserId: userId },
      include: {
        category: {
          include: {
            competition: true,
          },
        },
        scores: {
          include: {
            judge: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
  ]);

  if (!team) {
    return null;
  }

  const [competitions, categories] = await Promise.all([
    prisma.competition.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: {
        active: true,
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ competition: { name: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const submittedJudgeCount = team.scores.filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED).length;
  const averageScore =
    submittedJudgeCount > 0
      ? round(
          team.scores
            .filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED)
            .reduce((sum, score) => sum + score.weightedScore, 0) / submittedJudgeCount,
        )
      : 0;

  return {
    settings,
    competitions,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      competitionId: category.competitionId,
      competitionName: category.competition.name,
    })),
    team: {
      id: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      competitionId: team.category?.competitionId ?? "",
      competitionName: team.category?.competition?.name ?? "",
      categoryId: team.categoryId ?? "",
      categoryName: team.category?.name ?? "",
      projectTitle: team.projectTitle,
      projectDescription: team.projectDescription,
      organization: team.organization ?? "",
      teamMembers: team.teamMembers,
      videoUrl: team.videoUrl ?? "",
      imageUrl: team.imageUrl ?? "",
      documentUrl: team.documentUrl ?? "",
      documentName: team.documentName ?? "",
      documentLinks: parseDocumentLinks(team.documentLinks, {
        documentName: team.documentName,
        documentUrl: team.documentUrl,
      }),
      submissionStatus: team.submissionStatus,
      submittedAt: team.submittedAt,
      approvedAt: team.approvedAt,
      reviewNote: team.reviewNote ?? "",
      updatedAt: team.updatedAt,
      scores: team.scores.map((score) => ({
        id: score.id,
        judgeName: score.judge.name,
        status: score.status,
        averageScore: score.weightedScore,
      })),
      stats: {
        submittedJudgeCount,
        averageScore,
      },
    },
  };
}

export async function getExportData(competitionId?: string) {
  const { selectedCompetitionId } = await resolveCompetitionScope(competitionId);

  const [leaderboard, comments] = await Promise.all([
    getLeaderboardData(selectedCompetitionId ?? undefined),
    prisma.score.findMany({
      where: selectedCompetitionId
        ? {
            team: {
              category: {
                competitionId: selectedCompetitionId,
              },
            },
          }
        : undefined,
      include: {
        team: {
          include: {
            category: true,
          },
        },
        judge: true,
      },
      orderBy: [{ team: { teamCode: "asc" } }, { judge: { name: "asc" } }],
    }),
  ]);

  return {
    leaderboard: leaderboard.overallRows,
    comments,
  };
}

export function describeScoreStatus(status: ScoreStatus | "PENDING") {
  switch (status) {
    case ScoreStatus.DRAFT:
      return "Draft";
    case ScoreStatus.SUBMITTED:
      return "Submitted";
    case ScoreStatus.EDITED:
      return "Edited";
    default:
      return "Pending";
  }
}

export function describeSubmissionStatus(status: ApprovalStatus) {
  switch (status) {
    case ApprovalStatus.APPROVED:
      return "Approved";
    case ApprovalStatus.PENDING:
      return "Pending approval";
    case ApprovalStatus.REJECTED:
      return "Rejected";
    default:
      return "Draft";
  }
}

export function getLastUpdatedLabel(date: Date | string | null | undefined) {
  return formatRelativeTime(date);
}
