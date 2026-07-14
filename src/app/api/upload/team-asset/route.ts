import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { persistUpload, type UploadKind } from "@/lib/upload-storage";

export const runtime = "nodejs";

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

  const result = await persistUpload(kind as UploadKind, file, session.user.id);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
