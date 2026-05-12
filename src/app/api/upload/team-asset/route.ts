import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";

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
  competitionImage: {
    folder: "competitions",
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]),
    maxBytes: 8 * 1024 * 1024,
  },
} as const;

function sanitizeUploadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "upload";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== Role.ADMIN && session.user.role !== Role.TEAM)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const kind = formData.get("kind");
  const file = formData.get("file");

  if ((kind !== "avatar" && kind !== "document" && kind !== "competitionImage") || !(file instanceof File)) {
    return NextResponse.json({ error: "Please choose a valid file to upload." }, { status: 400 });
  }

  if (kind === "competitionImage" && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originalName = file.name || "upload";
  const ext = path.extname(originalName).toLowerCase();
  const rule = uploadRules[kind];

  if (!rule.extensions.has(ext)) {
    return NextResponse.json(
      {
        error:
          kind === "avatar"
            ? "Avatar must be a JPG, PNG, WEBP, or GIF image."
            : kind === "competitionImage"
              ? "Competition image must be a JPG, PNG, WEBP, or GIF image."
              : "Document must be a PDF, DOCX, or ZIP file.",
      },
      { status: 400 },
    );
  }

  if (file.size > rule.maxBytes) {
    return NextResponse.json(
      {
        error:
          kind === "avatar"
            ? "Avatar must be 3MB or smaller."
            : kind === "competitionImage"
              ? "Competition image must be 8MB or smaller."
              : "Document must be 20MB or smaller.",
      },
      { status: 400 },
    );
  }

  const safeOriginalName = sanitizeUploadName(originalName);
  const fileName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", rule.folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    success: true,
    url: `/uploads/${rule.folder}/${fileName}`,
    name: originalName,
  });
}
