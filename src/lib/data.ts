import { ApprovalStatus, Prisma, Role, ScoreStatus } from "@prisma/client";

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
type ScoringParticipant = { id: string; name: string; role: Role; canScore: boolean };
type CompetitionScorerStatus = { competitionId: string; userId: string; canScore: boolean };

const teamCodeCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const scoringParticipantWhere = {
  role: { in: [Role.ADMIN, Role.CHIEF_JUDGE, Role.JUDGE] },
  active: true,
} satisfies Prisma.UserWhereInput;

function compareTeamCodeValue(left: string, right: string) {
  return teamCodeCollator.compare(left, right);
}

function compareTeamCode<T extends { teamCode: string }>(left: T, right: T) {
  return compareTeamCodeValue(left.teamCode, right.teamCode);
}

function isAdminLikeRole(role: Role) {
  return role === Role.ADMIN || role === Role.CHIEF_JUDGE;
}

function getCompetitionScoringParticipants(
  users: Array<{ id: string; name: string; role: Role }>,
  statuses: CompetitionScorerStatus[],
  competitionId: string | null | undefined,
) {
  return users.map((user) => {
    const status = statuses.find((entry) => entry.userId === user.id && entry.competitionId === competitionId);

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      canScore: status?.canScore ?? true,
    };
  });
}

function getEnabledScoringParticipants(
  users: Array<{ id: string; name: string; role: Role }>,
  statuses: CompetitionScorerStatus[],
  competitionId: string | null | undefined,
) {
  return getCompetitionScoringParticipants(users, statuses, competitionId).filter((participant) => participant.canScore);
}

function canUserScoreCompetition(statuses: CompetitionScorerStatus[], userId: string, competitionId: string | null | undefined) {
  if (!competitionId) {
    return true;
  }

  return statuses.find((entry) => entry.userId === userId && entry.competitionId === competitionId)?.canScore ?? true;
}

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
  scoringParticipants: ScoringParticipant[],
) {
  if (settings?.judgeScope !== "ASSIGNED") {
    return scoringParticipants.map((participant) => participant.id);
  }

  const chiefJudgeIds = scoringParticipants
    .filter((participant) => isAdminLikeRole(participant.role))
    .map((participant) => participant.id);
  const enabledParticipantIds = new Set(scoringParticipants.map((participant) => participant.id));
  const assignedJudgeIds = team.assignments
    .map((assignment) => assignment.judgeId)
    .filter((judgeId) => enabledParticipantIds.has(judgeId));

  return Array.from(new Set([...chiefJudgeIds, ...assignedJudgeIds]));
}

function computeTeamMetrics(
  team: TeamWithRelations,
  settings: { judgeScope: "ALL" | "ASSIGNED" } | null,
  scoringParticipants: ScoringParticipant[],
) {
  const expectedJudgeIds = getAllVisibleJudgeIds(settings, team, scoringParticipants);
  const submitted = getSubmittedScores(team).filter((score) => expectedJudgeIds.includes(score.judgeId));

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

function getRankedRows(
  teams: TeamWithRelations[],
  settings: { judgeScope: "ALL" | "ASSIGNED" } | null,
  scoringParticipants: ScoringParticipant[],
) {
  return teams
    .map((team) => {
      const metrics = computeTeamMetrics(team, settings, scoringParticipants);
      const submittedByJudgeId = new Map(metrics.submitted.map((score) => [score.judgeId, score]));
      const pendingJudgeNames = scoringParticipants
        .filter((participant) => metrics.expectedJudgeIds.includes(participant.id))
        .filter((participant) => !metrics.submitted.some((score) => score.judgeId === participant.id))
        .map((participant) => participant.name);

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
        perJudgeScores: scoringParticipants
          .filter((participant) => metrics.expectedJudgeIds.includes(participant.id))
          .map((participant) => {
            const judgeScore = submittedByJudgeId.get(participant.id);

            return {
              judgeId: participant.id,
              judgeName: participant.name,
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
                    weightedValue: item.weightedValue,
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

      return compareTeamCodeValue(a.teamCode, b.teamCode);
    });
}

export async function getAdminDashboardData() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const activeCompetitionId = getActiveCompetitionId(settings);

  const [teams, judges, scoringStatuses] = await Promise.all([
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
      where: scoringParticipantWhere,
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
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    activeCompetitionId
      ? prisma.competitionScorer.findMany({
          where: { competitionId: activeCompetitionId },
          select: { competitionId: true, userId: true, canScore: true },
        })
      : Promise.resolve([]),
  ]);

  const approvedTeams = getApprovedTeams(teams);
  const scoringParticipants = getEnabledScoringParticipants(judges, scoringStatuses, activeCompetitionId);
  const rankedRows = getRankedRows(approvedTeams, settings, scoringParticipants);
  const pendingApprovalTeams = teams.filter((team) =>
    team.submissionStatus === ApprovalStatus.DRAFT || team.submissionStatus === ApprovalStatus.PENDING,
  ).length;
  const approvedCount = approvedTeams.length;

  const submittedScores = approvedTeams.reduce((sum, team) => sum + getSubmittedScores(team).length, 0);
  const expectedScores = approvedTeams.reduce((sum, team) => {
    return sum + getAllVisibleJudgeIds(settings, team, scoringParticipants).length;
  }, 0);

  const judgeProgress = judges.map((judge) => {
    const judgeCanScore = canUserScoreCompetition(scoringStatuses, judge.id, activeCompetitionId);
    const visibleApprovedTeams =
      !judgeCanScore
        ? []
        : settings?.judgeScope === "ASSIGNED"
        ? isAdminLikeRole(judge.role)
          ? approvedTeams
          : approvedTeams.filter((team) => team.assignments.some((assignment) => assignment.judgeId === judge.id))
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
    leaderboard: rankedRows,
    judgeProgress: judgeProgress.filter(
      (judge) => judge.assignedTeams || judge.draftCount || judge.submittedCount || judge.pendingCount,
    ),
  };
}

export async function getRecentAdminActivityData() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const activeCompetitionId = getActiveCompetitionId(settings);

  const recentAudits = await prisma.scoreAudit.findMany({
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
  });

  return recentAudits.map((audit) => ({
    id: audit.id,
    action: audit.action,
    actor: audit.actor.name,
    team: audit.score.team.teamName,
    category: audit.score.team.category?.name ?? "Uncategorized",
    createdAt: audit.createdAt.toISOString(),
  }));
}

export async function getTeamsManagementData() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [teams, judges, scoringParticipants, scoringStatuses, teamAccounts, competitions, categories] = await Promise.all([
    prisma.team.findMany({
      include: teamInclude,
      orderBy: [{ teamCode: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: Role.JUDGE, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: scoringParticipantWhere,
      select: { id: true, name: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.competitionScorer.findMany({
      select: { competitionId: true, userId: true, canScore: true },
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

  return {
    teams: teams.slice().sort(compareTeamCode).map((team) => {
      const metrics = computeTeamMetrics(
        team,
        settings,
        getEnabledScoringParticipants(scoringParticipants, scoringStatuses, team.category?.competitionId),
      );

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
        updatedAt: team.updatedAt.toISOString(),
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
      where: scoringParticipantWhere,
      select: { id: true, name: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
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

export async function getLeaderboardData(competitionId?: string, judgeId?: string) {
  const { settings, competitions, selectedCompetitionId } = await resolveCompetitionScope(competitionId);
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId) ?? null;

  const [teams, judges, scoringStatuses, categories] = await Promise.all([
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
      where: scoringParticipantWhere,
      select: { id: true, name: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    selectedCompetitionId
      ? prisma.competitionScorer.findMany({
          where: { competitionId: selectedCompetitionId },
          select: { competitionId: true, userId: true, canScore: true },
        })
      : Promise.resolve([]),
    prisma.category.findMany({
      where: selectedCompetitionId ? { competitionId: selectedCompetitionId } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const approvedTeams = getApprovedTeams(teams);
  const scoringParticipants = getCompetitionScoringParticipants(judges, scoringStatuses, selectedCompetitionId);
  const enabledScoringParticipants = scoringParticipants.filter((participant) => participant.canScore);
  const overallRows = getRankedRows(approvedTeams, settings, enabledScoringParticipants).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
  const judgeRankingOptions = enabledScoringParticipants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    role: participant.role,
  }));
  const selectedJudgeRankingId =
    judgeId && judgeRankingOptions.some((participant) => participant.id === judgeId)
      ? judgeId
      : judgeRankingOptions[0]?.id ?? "";
  const judgeRankingRows = selectedJudgeRankingId
    ? overallRows
        .map((row) => {
          const selectedJudgeScore = row.perJudgeScores.find((score) => score.judgeId === selectedJudgeRankingId);

          if (!selectedJudgeScore) {
            return null;
          }

          return {
            ...row,
            averageScore: selectedJudgeScore.score ?? 0,
            perJudgeScores: [selectedJudgeScore],
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => {
          if (b.averageScore !== a.averageScore) {
            return b.averageScore - a.averageScore;
          }

          return compareTeamCodeValue(a.teamCode, b.teamCode);
        })
        .map((row, index) => ({
          ...row,
          rank: index + 1,
        }))
    : [];

  const categorySections = categories.map((category) => {
    const rows = getRankedRows(
      approvedTeams.filter((team) => team.categoryId === category.id),
      settings,
      enabledScoringParticipants,
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
    selectedCompetitionUpdatedAt: selectedCompetition?.updatedAt.toISOString() ?? "",
    overallRows,
    judgeRankingOptions,
    selectedJudgeRankingId,
    judgeRankingRows,
    categorySections,
    judges,
    scoringParticipants,
  };
}

export async function getSettingsPageData(competitionId?: string) {
  const { settings, competitions, selectedCompetitionId } = await resolveCompetitionScope(competitionId);

  const [criteria, categories, accounts] = await Promise.all([
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
        ownedTeams: {
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
  ]);

  return {
    settings: settings
      ? {
          ...settings,
          updatedAt: settings.updatedAt.toISOString(),
        }
      : null,
    competitions: competitions.map((competition) => ({
      id: competition.id,
      name: competition.name,
      description: competition.description,
      active: competition.active,
      updatedAt: competition.updatedAt.toISOString(),
      images: competition.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        imageName: image.imageName,
        displayOrder: image.displayOrder,
        updatedAt: image.updatedAt.toISOString(),
      })),
    })),
    selectedCompetitionId: selectedCompetitionId ?? "",
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      categoryId: criterion.categoryId,
      categoryName: criterion.category.name,
      name: criterion.name,
      description: criterion.description,
      minScore: criterion.minScore,
      maxScore: criterion.maxScore,
      allowNegativeScore: criterion.allowNegativeScore,
      weight: criterion.weight,
      displayOrder: criterion.displayOrder,
      active: criterion.active,
      updatedAt: criterion.updatedAt.toISOString(),
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
        updatedAt: subCriterion.updatedAt.toISOString(),
      })),
    })),
    categories: categories.map((category) => ({
      id: category.id,
      competitionId: category.competitionId,
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
      active: category.active,
      updatedAt: category.updatedAt.toISOString(),
    })),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      active: account.active,
      updatedAt: account.updatedAt.toISOString(),
      assignmentCount: account.assignments.length,
      submittedCount: account.scores.length,
      ownedTeamCount: account.ownedTeams.length,
      linkedTeamId: "",
      linkedTeamLabel: "",
      categoryName: account.ownedTeams.map((team) => team.category?.name).filter(Boolean).join(", "),
    })),
  };
}

export async function getJudgeDashboardData(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [judge, teams, scoringStatuses] = await Promise.all([
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
    prisma.competitionScorer.findMany({
      where: { userId },
      select: { competitionId: true, userId: true, canScore: true },
    }),
  ]);

  if (!judge) {
    return null;
  }

  const isChiefJudge = isAdminLikeRole(judge.role);
  const scorableTeams = teams.filter((team) =>
    canUserScoreCompetition(scoringStatuses, userId, team.category?.competitionId),
  );
  const visibleTeams = (
    !isChiefJudge && settings?.judgeScope === "ASSIGNED"
      ? scorableTeams.filter((team) => team.assignments.length > 0)
      : scorableTeams
  ).slice().sort(compareTeamCode);
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
      score: round(team.scores[0]?.weightedScore ?? 0),
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

export async function getJudgeScoringPageData(userId: string, teamId: string, role?: Role) {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });

  const [allTeams, team, existingScore, scoringStatuses] = await Promise.all([
    prisma.team.findMany({
      where: {
        status: "ACTIVE",
        submissionStatus: ApprovalStatus.APPROVED,
      },
      select: {
        id: true,
        teamCode: true,
        teamName: true,
        category: {
          select: {
            competitionId: true,
          },
        },
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
    prisma.competitionScorer.findMany({
      where: { userId },
      select: { competitionId: true, userId: true, canScore: true },
    }),
  ]);

  if (!team || team.submissionStatus !== ApprovalStatus.APPROVED || !team.categoryId) {
    return null;
  }

  if (!canUserScoreCompetition(scoringStatuses, userId, team.category?.competitionId)) {
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

  const isChiefJudge = role === Role.ADMIN || role === Role.CHIEF_JUDGE;
  const scorableAllTeams = allTeams.filter((entry) =>
    canUserScoreCompetition(scoringStatuses, userId, entry.category?.competitionId),
  );
  const isVisible =
    isChiefJudge ||
    settings?.judgeScope === "ALL" ||
    scorableAllTeams.some((entry) => entry.id === teamId && entry.assignments.length > 0);
  if (!isVisible) {
    return null;
  }

  const visibleTeams = (
    isChiefJudge || settings?.judgeScope === "ALL"
      ? scorableAllTeams
      : scorableAllTeams.filter((entry) => entry.assignments.length > 0)
  ).slice().sort(compareTeamCode);
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

export async function getTeamPortalData(userId: string, requestedCompetitionId?: string) {
  const [settings, teams, competitions] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.team.findMany({
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
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.competition.findMany({
      where: {
        active: true,
        scoringPaused: false,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!competitions.length) {
    return null;
  }

  const selectedCompetitionId =
    requestedCompetitionId && competitions.some((competition) => competition.id === requestedCompetitionId)
      ? requestedCompetitionId
      : teams.find((team) => competitions.some((competition) => competition.id === team.category?.competitionId))?.category?.competitionId ??
        competitions[0]?.id ??
        "";
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId);
  const team = teams.find((entry) => entry.category?.competitionId === selectedCompetitionId) ?? null;
  const openCompetitionIds = competitions.map((competition) => competition.id);

  const categories = await prisma.category.findMany({
    where: {
      active: true,
      competitionId: {
        in: openCompetitionIds,
      },
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
  });

  const submittedJudgeCount =
    team?.scores.filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED).length ?? 0;
  const averageScore =
    team && submittedJudgeCount > 0
      ? round(
          team.scores
            .filter((score) => score.status === ScoreStatus.SUBMITTED || score.status === ScoreStatus.EDITED)
            .reduce((sum, score) => sum + score.weightedScore, 0) / submittedJudgeCount,
        )
      : 0;
  const selectedCategory = categories.find((category) => category.competitionId === selectedCompetitionId);
  const mappedCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    competitionId: category.competitionId,
    competitionName: category.competition.name,
  }));

  return {
    settings,
    competitions,
    selectedCompetitionId,
    categories: mappedCategories,
    submissions: teams.map((entry) => ({
      id: entry.id,
      teamCode: entry.teamCode,
      teamName: entry.teamName,
      competitionId: entry.category?.competitionId ?? "",
      competitionName: entry.category?.competition?.name ?? "",
      categoryName: entry.category?.name ?? "",
      projectTitle: entry.projectTitle,
      submissionStatus: entry.submissionStatus,
      updatedAt: entry.updatedAt,
    })),
    team: team
      ? {
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
        }
      : {
          id: "",
          teamCode: "",
          teamName: "",
          competitionId: selectedCompetitionId,
          competitionName: selectedCompetition?.name ?? "",
          categoryId: selectedCategory?.id ?? "",
          categoryName: selectedCategory?.name ?? "",
          projectTitle: "",
          projectDescription: "",
          organization: "",
          teamMembers: "",
          videoUrl: "",
          imageUrl: "",
          documentUrl: "",
          documentName: "",
          documentLinks: [],
          submissionStatus: ApprovalStatus.DRAFT,
          submittedAt: null,
          approvedAt: null,
          reviewNote: "",
          updatedAt: new Date(),
          scores: [],
          stats: {
            submittedJudgeCount: 0,
            averageScore: 0,
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
      orderBy: [{ judge: { name: "asc" } }],
    }),
  ]);

  return {
    leaderboard: leaderboard.overallRows,
    comments: comments.slice().sort((left, right) => {
      const sequenceCompare = compareTeamCode(left.team, right.team);

      if (sequenceCompare !== 0) {
        return sequenceCompare;
      }

      return left.judge.name.localeCompare(right.judge.name, "en", { sensitivity: "base" });
    }),
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
