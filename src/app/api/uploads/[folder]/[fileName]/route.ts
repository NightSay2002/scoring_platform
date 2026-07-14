import { readFile } from "fs/promises";
import path from "path";

import { ApprovalStatus, Role, TeamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeUploadName, type UploadFolder } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedFolders = new Set<UploadFolder>(["avatars", "documents", "competitions"]);

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

function isSafeFileName(fileName: string) {
  return Boolean(fileName) && fileName === path.basename(fileName) && /^[a-zA-Z0-9._-]+$/.test(fileName);
}

async function canAccessUpload(userId: string, folder: UploadFolder, fileName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true },
  });

  if (!user?.active) {
    return false;
  }

  if (folder === "competitions" || user.role === Role.ADMIN || user.role === Role.CHIEF_JUDGE) {
    return true;
  }

  const uploadUrl = `/uploads/${folder}/${fileName}`;
  const team = await prisma.team.findFirst({
    where: {
      OR: [
        { imageUrl: uploadUrl },
        { applicationFormUrl: uploadUrl },
        { documentUrl: uploadUrl },
        { documentLinks: { contains: uploadUrl } },
      ],
      ...(user.role === Role.TEAM ? { ownerUserId: user.id } : {}),
    },
    select: {
      status: true,
      submissionStatus: true,
      category: {
        select: {
          competitionId: true,
          judgeAssignments: {
            where: { judgeId: user.id },
            select: { id: true },
          },
        },
      },
      assignments: {
        where: { judgeId: user.id },
        select: { id: true },
      },
    },
  });

  if (!team) {
    return user.role === Role.TEAM && fileName.includes(`-${sanitizeUploadName(user.id)}-`);
  }

  if (user.role === Role.TEAM) {
    return true;
  }

  if (user.role !== Role.JUDGE || team.status !== TeamStatus.ACTIVE || team.submissionStatus !== ApprovalStatus.APPROVED) {
    return false;
  }

  const competitionId = team.category?.competitionId;
  if (!competitionId) {
    return false;
  }

  const [settings, scorerStatus] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" }, select: { judgeScope: true } }),
    prisma.competitionScorer.findUnique({
      where: { competitionId_userId: { competitionId, userId: user.id } },
      select: { canScore: true },
    }),
  ]);

  if (scorerStatus?.canScore === false) {
    return false;
  }

  return settings?.judgeScope !== "ASSIGNED" || team.assignments.length > 0 || (team.category?.judgeAssignments.length ?? 0) > 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folder: string; fileName: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { folder, fileName } = await params;
  if (!allowedFolders.has(folder as UploadFolder) || !isSafeFileName(fileName)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!(await canAccessUpload(session.user.id, folder as UploadFolder, fileName))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "runtime-uploads", folder, fileName),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads", folder, fileName),
  ];

  let contents: Buffer | null = null;
  for (const candidate of candidates) {
    try {
      contents = await readFile(/*turbopackIgnore: true*/ candidate);
      break;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (!contents) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();
  return new NextResponse(new Uint8Array(contents), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Type": contentTypes[ext] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
