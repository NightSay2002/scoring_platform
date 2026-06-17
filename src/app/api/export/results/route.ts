import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getExportData } from "@/lib/data";
import { csvEscape } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "CHIEF_JUDGE")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId") ?? undefined;
  const { detailedResults } = await getExportData(competitionId);
  const header = [
    "Rank",
    "AWARD Category",
    "Sequence",
    "Team Name",
    "Project Title",
    "Team Average Score",
    "Submitted Count",
    "Expected Count",
    "Pending Judges",
    "Judge",
    "Judge Role",
    "Judge Expected",
    "Judge Status",
    "Judge Total Score",
    "Judge Overall Comment",
    "Judge Updated At",
    "Item Level",
    "Criterion",
    "Sub-Criterion",
    "Range",
    "Weight",
    "Raw Score",
    "Contribution Score",
    "Item Comment",
  ];

  const rows = detailedResults.map((row) =>
    [
      row.rank,
      row.categoryName,
      row.sequence,
      row.teamName,
      row.projectTitle,
      row.teamAverageScore,
      row.submittedCount,
      row.expectedCount,
      row.pendingJudges,
      row.judgeName,
      row.judgeRole,
      row.judgeExpected,
      row.judgeStatus,
      row.judgeTotalScore,
      row.judgeComment,
      row.judgeUpdatedAt,
      row.itemLevel,
      row.criterionName,
      row.subCriterionName,
      row.range,
      row.weight,
      row.rawScore,
      row.contributionScore,
      row.itemComment,
    ]
      .map(csvEscape)
      .join(","),
  );

  return new NextResponse([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="results-export.csv"',
    },
  });
}
