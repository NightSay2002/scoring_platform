import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getExportData } from "@/lib/data";
import { csvEscape } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId") ?? undefined;
  const { leaderboard } = await getExportData(competitionId);
  const header = [
    "Rank",
    "Category",
    "Team Code",
    "Team Name",
    "Project Title",
    "Average Score",
    "Submitted Count",
    "Expected Count",
    "Pending Judges",
  ];

  const rows = leaderboard.map((row) =>
    [
      row.rank,
      row.categoryName,
      row.teamCode,
      row.teamName,
      row.projectTitle,
      row.averageScore,
      row.submittedCount,
      row.expectedCount,
      row.pendingJudgeNames.join("; "),
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
