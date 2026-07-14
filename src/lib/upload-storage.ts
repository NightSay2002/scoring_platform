import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type UploadKind = "avatar" | "document" | "competitionImage";
export type UploadFolder = "avatars" | "documents" | "competitions";

export const uploadRules: Record<UploadKind, {
  folder: UploadFolder;
  extensions: ReadonlySet<string>;
  maxBytes: number;
}> = {
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
};

export function sanitizeUploadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "upload";
}

export function getUploadValidationError(kind: UploadKind, originalName: string, size: number) {
  const rule = uploadRules[kind];
  const ext = path.extname(originalName).toLowerCase();

  if (!rule.extensions.has(ext)) {
    return kind === "avatar"
      ? "Avatar must be a JPG, PNG, WEBP, or GIF image."
      : kind === "competitionImage"
        ? "Competition image must be a JPG, PNG, WEBP, or GIF image."
        : "Document must be a PDF, DOCX, or ZIP file.";
  }

  if (size > rule.maxBytes) {
    return kind === "avatar"
      ? "Avatar must be 3MB or smaller."
      : kind === "competitionImage"
        ? "Competition image must be 8MB or smaller."
        : "Document must be 20MB or smaller.";
  }

  return null;
}

function matchesFileSignature(ext: string, contents: Buffer) {
  if (ext === ".jpg" || ext === ".jpeg") {
    return contents.length >= 3 && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff;
  }
  if (ext === ".png") {
    return contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (ext === ".gif") {
    const header = contents.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (ext === ".webp") {
    return contents.subarray(0, 4).toString("ascii") === "RIFF" && contents.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (ext === ".pdf") {
    return contents.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (ext === ".docx" || ext === ".zip") {
    const signature = contents.subarray(0, 4);
    return (
      signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
    );
  }

  return false;
}

export async function persistUpload(
  kind: UploadKind,
  file: { name?: string; size?: number; arrayBuffer(): Promise<ArrayBuffer> },
  uploaderId?: string,
) {
  const originalName = file.name || "upload";
  const validationError = getUploadValidationError(kind, originalName, file.size ?? 0);

  if (validationError) {
    return { error: validationError } as const;
  }

  const rule = uploadRules[kind];
  const contents = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(originalName).toLowerCase();
  if (!matchesFileSignature(ext, contents)) {
    return { error: "File content does not match its extension." } as const;
  }

  const uploaderToken = uploaderId ? `${sanitizeUploadName(uploaderId)}-` : "";
  const fileName = `${Date.now()}-${uploaderToken}${randomUUID()}-${sanitizeUploadName(originalName)}`;
  const uploadDir = path.join(/*turbopackIgnore: true*/ process.cwd(), "runtime-uploads", rule.folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), contents);

  return {
    success: true,
    url: `/uploads/${rule.folder}/${fileName}`,
    name: originalName,
  } as const;
}
