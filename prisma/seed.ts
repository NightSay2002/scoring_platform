import { ApprovalStatus, JudgeScope, PrismaClient, Role, ScoreStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const criteriaTemplate = [
  {
    name: "Innovation",
    description: "Originality of the technical concept and solution.",
    minScore: 0,
    maxScore: 100,
    weight: 20,
    displayOrder: 1,
  },
  {
    name: "Technical Execution",
    description: "Architecture quality, implementation depth, and reliability.",
    minScore: 0,
    maxScore: 100,
    weight: 10,
    displayOrder: 2,
  },
  {
    name: "Impact",
    description: "Usefulness, market relevance, and measurable value.",
    minScore: 0,
    maxScore: 100,
    weight: 30,
    displayOrder: 3,
  },
  {
    name: "Presentation",
    description: "Clarity of pitch, demo quality, and delivery.",
    minScore: 0,
    maxScore: 100,
    weight: 20,
    displayOrder: 4,
  },
  {
    name: "Feasibility",
    description: "Implementation practicality, scalability, and delivery risk.",
    minScore: 0,
    maxScore: 100,
    weight: 20,
    displayOrder: 5,
  },
] as const;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getScoreContribution(score: number, minScore: number, maxScore: number, allowNegativeScore: boolean, weight: number) {
  const effectiveMinScore = allowNegativeScore
    ? Math.min(minScore, maxScore > 0 ? -Math.abs(maxScore) : minScore)
    : Math.max(minScore, 0);
  const effectiveMaxScore = allowNegativeScore ? maxScore : Math.max(maxScore, 0);
  const scale = Math.max(Math.abs(effectiveMinScore), Math.abs(effectiveMaxScore));

  if (scale <= 0 || !Number.isFinite(weight)) {
    return 0;
  }

  return round((Math.min(Math.max(score, effectiveMinScore), effectiveMaxScore) / scale) * weight);
}

async function main() {
  await prisma.scoreAudit.deleteMany();
  await prisma.scoreItem.deleteMany();
  await prisma.score.deleteMany();
  await prisma.teamAssignment.deleteMany();
  await prisma.team.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.category.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Demo123!", 10);

  const [admin, judge1, judge2, judge3, teamUser1, teamUser2, teamUser3, teamUser4, teamUser5] =
    await Promise.all([
      prisma.user.create({
        data: {
          name: "Competition Admin",
          email: "admin@techscore.local",
          passwordHash,
          role: Role.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          name: "Maya Chen",
          email: "maya@techscore.local",
          passwordHash,
          role: Role.JUDGE,
        },
      }),
      prisma.user.create({
        data: {
          name: "Daniel Wong",
          email: "daniel@techscore.local",
          passwordHash,
          role: Role.JUDGE,
        },
      }),
      prisma.user.create({
        data: {
          name: "Aisha Patel",
          email: "aisha@techscore.local",
          passwordHash,
          role: Role.JUDGE,
        },
      }),
      prisma.user.create({
        data: {
          name: "Circuit Breakers",
          email: "team1@techscore.local",
          passwordHash,
          role: Role.TEAM,
        },
      }),
      prisma.user.create({
        data: {
          name: "Signal Foundry",
          email: "team2@techscore.local",
          passwordHash,
          role: Role.TEAM,
        },
      }),
      prisma.user.create({
        data: {
          name: "Data Harbor",
          email: "team3@techscore.local",
          passwordHash,
          role: Role.TEAM,
        },
      }),
      prisma.user.create({
        data: {
          name: "Byte Mechanics",
          email: "team4@techscore.local",
          passwordHash,
          role: Role.TEAM,
        },
      }),
      prisma.user.create({
        data: {
          name: "NovaForge",
          email: "team5@techscore.local",
          passwordHash,
          role: Role.TEAM,
        },
      }),
    ]);

  const [competition, competition2] = await Promise.all([
    prisma.competition.create({
      data: {
        name: "Tech Innovation Challenge 2026",
        description: "Main event for the 2026 judging season.",
      },
    }),
    prisma.competition.create({
      data: {
        name: "Campus Prototype Cup 2026",
        description: "Secondary event used to demonstrate competition switching.",
      },
    }),
  ]);

  const [categoryAi, categoryRobotics, categorySustainability] = await Promise.all([
    prisma.category.create({
      data: {
        competitionId: competition.id,
        name: "AI & Data",
        description: "Artificial intelligence, analytics, and smart automation solutions.",
        displayOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        competitionId: competition.id,
        name: "Robotics & Hardware",
        description: "Robotics, embedded systems, and physical product innovation.",
        displayOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        competitionId: competition.id,
        name: "Sustainability & Health",
        description: "Technology submissions focused on health, environment, and public good.",
        displayOrder: 3,
      },
    }),
  ]);

  await prisma.category.createMany({
    data: [
      {
        competitionId: competition2.id,
        name: "Software",
        description: "Prototype software products and applications.",
        displayOrder: 1,
      },
      {
        competitionId: competition2.id,
        name: "Hardware",
        description: "Prototype hardware builds and mechatronics.",
        displayOrder: 2,
      },
    ],
  });

  const categoryCriteria = new Map<
    string,
    Array<{
      id: string;
      minScore: number;
      maxScore: number;
      allowNegativeScore: boolean;
      weight: number;
    }>
  >();
  for (const category of [categoryAi, categoryRobotics, categorySustainability]) {
    const created = await Promise.all(
      criteriaTemplate.map((criterion) =>
        prisma.criterion.create({
          data: {
            ...criterion,
            categoryId: category.id,
          },
          select: {
            id: true,
            minScore: true,
            maxScore: true,
            allowNegativeScore: true,
            weight: true,
          },
        }),
      ),
    );
    categoryCriteria.set(category.id, created);
  }

  await prisma.settings.create({
    data: {
      id: "default",
      competitionId: competition.id,
      competitionName: competition.name,
      judgingRounds: 1,
      allowEditAfterSubmit: true,
      showLeaderboard: false,
      judgeScope: JudgeScope.ALL,
      submissionDeadline: new Date("2026-05-15T18:00:00.000Z"),
      exportIncludeComments: true,
    },
  });

  const teams = await Promise.all([
    prisma.team.create({
      data: {
        teamCode: "0",
        teamName: "Circuit Breakers",
        categoryId: categoryAi.id,
        ownerUserId: teamUser1.id,
        projectTitle: "GridSense AI",
        projectDescription:
          "A predictive maintenance platform for campus power systems using IoT telemetry and anomaly detection.",
        organization: "Hong Kong Polytechnic University",
        teamMembers: "Karen Lee\nMarcus Ho\nNathan Yip",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        submissionStatus: ApprovalStatus.APPROVED,
        submittedAt: new Date("2026-04-17T08:30:00.000Z"),
        approvedAt: new Date("2026-04-18T04:00:00.000Z"),
        approvedById: admin.id,
      },
    }),
    prisma.team.create({
      data: {
        teamCode: "1",
        teamName: "Signal Foundry",
        categoryId: categorySustainability.id,
        ownerUserId: teamUser2.id,
        projectTitle: "CarePath Voice",
        projectDescription:
          "A multilingual voice triage assistant for outpatient clinics with automated follow-up summaries.",
        organization: "CityU Startup Lab",
        teamMembers: "Sarah Ng\nEthan Lau\nPriscilla Mak",
        videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
        submissionStatus: ApprovalStatus.APPROVED,
        submittedAt: new Date("2026-04-17T11:00:00.000Z"),
        approvedAt: new Date("2026-04-18T05:00:00.000Z"),
        approvedById: admin.id,
      },
    }),
    prisma.team.create({
      data: {
        teamCode: "2",
        teamName: "Data Harbor",
        categoryId: categorySustainability.id,
        ownerUserId: teamUser3.id,
        projectTitle: "Cold Chain Vision",
        projectDescription:
          "Computer vision and edge sensors for monitoring vaccine logistics in real time.",
        organization: "HKUST",
        teamMembers: "Ivan Cheung\nOlivia Choi",
        videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        submissionStatus: ApprovalStatus.APPROVED,
        submittedAt: new Date("2026-04-18T03:00:00.000Z"),
        approvedAt: new Date("2026-04-18T08:00:00.000Z"),
        approvedById: admin.id,
      },
    }),
    prisma.team.create({
      data: {
        teamCode: "3",
        teamName: "Byte Mechanics",
        categoryId: categoryRobotics.id,
        ownerUserId: teamUser4.id,
        projectTitle: "RoboDesk",
        projectDescription:
          "An adaptive robotics workstation that assists technicians with repeatable assembly tasks.",
        organization: "Shenzhen Tech Institute",
        teamMembers: "Liam Zhao\nTina Wu\nChris Leung",
        videoUrl: "https://www.youtube.com/watch?v=ScMzIvxBSi4",
        submissionStatus: ApprovalStatus.APPROVED,
        submittedAt: new Date("2026-04-18T10:00:00.000Z"),
        approvedAt: new Date("2026-04-19T01:00:00.000Z"),
        approvedById: admin.id,
      },
    }),
    prisma.team.create({
      data: {
        teamCode: "4",
        teamName: "NovaForge",
        categoryId: categoryAi.id,
        ownerUserId: teamUser5.id,
        projectTitle: "Aegis Ledger",
        projectDescription:
          "A compliance-first audit trail platform for industrial equipment certification.",
        organization: "Industry Innovation Hub",
        teamMembers: "Grace Lui\nMichael Chan",
        videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        submissionStatus: ApprovalStatus.PENDING,
        submittedAt: new Date("2026-04-20T03:00:00.000Z"),
        reviewNote: "Waiting for admin approval before opening to judges.",
      },
    }),
  ]);

  await prisma.teamAssignment.createMany({
    data: [
      { teamId: teams[0].id, judgeId: judge1.id },
      { teamId: teams[0].id, judgeId: judge2.id },
      { teamId: teams[0].id, judgeId: judge3.id },
      { teamId: teams[1].id, judgeId: judge1.id },
      { teamId: teams[1].id, judgeId: judge2.id },
      { teamId: teams[1].id, judgeId: judge3.id },
      { teamId: teams[2].id, judgeId: judge1.id },
      { teamId: teams[2].id, judgeId: judge2.id },
      { teamId: teams[2].id, judgeId: judge3.id },
      { teamId: teams[3].id, judgeId: judge1.id },
      { teamId: teams[3].id, judgeId: judge2.id },
      { teamId: teams[3].id, judgeId: judge3.id },
      { teamId: teams[4].id, judgeId: judge1.id },
      { teamId: teams[4].id, judgeId: judge2.id },
      { teamId: teams[4].id, judgeId: judge3.id },
    ],
  });

  async function createScore(input: {
    teamId: string;
    categoryId: string;
    judgeId: string;
    status: ScoreStatus;
    scores: number[];
    comment: string;
  }) {
    const categoryRule = categoryCriteria.get(input.categoryId) ?? [];
    const weightedScore = round(
      input.scores.reduce(
        (sum, value, index) =>
          sum +
          getScoreContribution(
            value,
            categoryRule[index]?.minScore ?? 0,
            categoryRule[index]?.maxScore ?? 100,
            categoryRule[index]?.allowNegativeScore ?? false,
            categoryRule[index]?.weight ?? 0,
          ),
        0,
      ),
    );
    const totalScore = round(input.scores.reduce((sum, value) => sum + value, 0) / (input.scores.length || 1));

    return prisma.score.create({
      data: {
        teamId: input.teamId,
        judgeId: input.judgeId,
        status: input.status,
        comment: input.comment,
        totalScore,
        weightedScore,
        submittedAt:
          input.status === ScoreStatus.SUBMITTED ? new Date("2026-04-20T09:00:00.000Z") : null,
        items: {
          create: categoryRule.map((criterion, index) => ({
            criterionId: criterion.id,
            numericScore: input.scores[index] ?? 0,
            weightedValue: getScoreContribution(
              input.scores[index] ?? 0,
              criterion.minScore,
              criterion.maxScore,
              criterion.allowNegativeScore,
              criterion.weight,
            ),
          })),
        },
        audits: {
          create: {
            actorId: input.judgeId,
            action: input.status === ScoreStatus.SUBMITTED ? "submit" : "save_draft",
            snapshot: JSON.stringify({
              scores: input.scores,
              comment: input.comment,
            }),
          },
        },
      },
    });
  }

  await Promise.all([
    createScore({
      teamId: teams[0].id,
      categoryId: categoryAi.id,
      judgeId: judge1.id,
      status: ScoreStatus.SUBMITTED,
      scores: [82, 76, 88, 79, 81],
      comment: "Strong technical concept with a polished demo and clear operational value.",
    }),
    createScore({
      teamId: teams[0].id,
      categoryId: categoryAi.id,
      judgeId: judge2.id,
      status: ScoreStatus.SUBMITTED,
      scores: [78, 85, 84, 77, 80],
      comment: "Solid engineering depth. The maintenance workflow was communicated clearly.",
    }),
    createScore({
      teamId: teams[0].id,
      categoryId: categoryAi.id,
      judgeId: judge3.id,
      status: ScoreStatus.SUBMITTED,
      scores: [80, 79, 86, 75, 83],
      comment: "Clear value proposition and well paced demo.",
    }),
    createScore({
      teamId: teams[1].id,
      categoryId: categorySustainability.id,
      judgeId: judge1.id,
      status: ScoreStatus.SUBMITTED,
      scores: [76, 74, 90, 78, 80],
      comment: "Promising healthcare application with strong accessibility benefits.",
    }),
    createScore({
      teamId: teams[1].id,
      categoryId: categorySustainability.id,
      judgeId: judge2.id,
      status: ScoreStatus.SUBMITTED,
      scores: [79, 77, 89, 81, 82],
      comment: "Good use case clarity and a realistic implementation path.",
    }),
    createScore({
      teamId: teams[1].id,
      categoryId: categorySustainability.id,
      judgeId: judge3.id,
      status: ScoreStatus.SUBMITTED,
      scores: [73, 76, 85, 79, 78],
      comment: "Useful solution with solid presentation.",
    }),
    createScore({
      teamId: teams[2].id,
      categoryId: categorySustainability.id,
      judgeId: judge1.id,
      status: ScoreStatus.SUBMITTED,
      scores: [75, 79, 88, 76, 80],
      comment: "Good market fit and clean use of edge inference.",
    }),
    createScore({
      teamId: teams[2].id,
      categoryId: categorySustainability.id,
      judgeId: judge2.id,
      status: ScoreStatus.SUBMITTED,
      scores: [77, 78, 90, 75, 82],
      comment: "Strong logistics application and strong proof of need.",
    }),
    createScore({
      teamId: teams[2].id,
      categoryId: categorySustainability.id,
      judgeId: judge3.id,
      status: ScoreStatus.SUBMITTED,
      scores: [79, 81, 92, 78, 84],
      comment: "High practical value and good commercial readiness.",
    }),
    createScore({
      teamId: teams[3].id,
      categoryId: categoryRobotics.id,
      judgeId: judge1.id,
      status: ScoreStatus.SUBMITTED,
      scores: [80, 88, 84, 77, 82],
      comment: "Robotics approach is credible and the prototype feels deployable.",
    }),
    createScore({
      teamId: teams[3].id,
      categoryId: categoryRobotics.id,
      judgeId: judge2.id,
      status: ScoreStatus.SUBMITTED,
      scores: [83, 86, 82, 80, 84],
      comment: "Well presented hardware concept with clear operator workflow benefits.",
    }),
    createScore({
      teamId: teams[3].id,
      categoryId: categoryRobotics.id,
      judgeId: judge3.id,
      status: ScoreStatus.DRAFT,
      scores: [78, 80, 79, 74, 77],
      comment: "Draft saved pending deeper review of reliability assumptions.",
    }),
  ]);

  console.log("Seed complete.");
  console.log("Admin: admin@techscore.local / Demo123!");
  console.log("Judge: maya@techscore.local / Demo123!");
  console.log("Judge: daniel@techscore.local / Demo123!");
  console.log("Judge: aisha@techscore.local / Demo123!");
  console.log("Team: team1@techscore.local / Demo123!");
  console.log("Team: team2@techscore.local / Demo123!");
  console.log("Team: team3@techscore.local / Demo123!");
  console.log(`Created ${teams.length} teams, 2 competitions, 3 categories, and ${criteriaTemplate.length} criteria per category.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
