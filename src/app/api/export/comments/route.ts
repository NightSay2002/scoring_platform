import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getExportData } from "@/lib/data";
import { csvEscape } from "@/lib/utils";

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { comments } = await getExportData();
  const header = ["Category", "Team", "Project Title", "Judge", "Status", "Average Score", "Comment", "Updated At"];
  const rows = comments.map((score) =>
    [
      score.team.category?.name ?? "Uncategorized",
      score.team.teamName,
      score.team.projectTitle,
      score.judge.name,
      score.status,
      score.weightedScore,
      score.comment,
      score.updatedAt.toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );

  return new NextResponse([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="comments-export.csv"',
    },
  });
}
