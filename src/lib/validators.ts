import { z } from "zod";

function normalizeMemberName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export const teamSchema = z.object({
  id: z.string().optional(),
  teamCode: z.string().optional().or(z.literal("")),
  teamName: z.string().min(1, "Team name is required."),
  competitionId: z.string().min(1, "Competition is required."),
  categoryId: z.string().min(1, "Category is required."),
  projectTitle: z.string().min(1, "Project title is required."),
  projectDescription: z.string().min(1, "Project description is required."),
  organization: z.string().optional(),
  teamMembers: z.string().min(1, "At least one team member is required."),
  videoUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  documentUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  documentName: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  documentLinks: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Document name is required."),
        url: z.string().trim().min(1, "Document URL is required."),
      }),
    )
    .max(20, "You can add up to 20 document links.")
    .optional(),
  submissionStatus: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewNote: z.string().optional(),
}).superRefine((value, context) => {
  const members = value.teamMembers
    .split("\n")
    .map(normalizeMemberName)
    .filter(Boolean);
  const duplicates = members.filter((member, index) => members.indexOf(member) !== index);

  if (duplicates.length) {
    context.addIssue({
      code: "custom",
      path: ["teamMembers"],
      message: "Team member names must be unique.",
    });
  }
});

export const criterionSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "Category is required."),
  name: z.string().min(1, "Criterion name is required."),
  description: z.string().optional(),
  minScore: z.coerce.number().finite(),
  maxScore: z.coerce.number().finite(),
  weight: z.coerce.number().min(0).max(100),
  displayOrder: z.coerce.number().int().nonnegative(),
  active: z.boolean().default(true),
});

export const criterionSubItemSchema = z.object({
  id: z.string().optional(),
  criterionId: z.string().min(1, "Parent criterion is required."),
  name: z.string().min(1, "Sub-criterion name is required."),
  description: z.string().optional(),
  minScore: z.coerce.number().finite(),
  maxScore: z.coerce.number().finite(),
  weight: z.coerce.number().min(0).max(100),
  displayOrder: z.coerce.number().int().nonnegative(),
  active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  competitionId: z.string().min(1),
  judgingRounds: z.coerce.number().int().positive(),
  allowEditAfterSubmit: z.boolean(),
  showLeaderboard: z.boolean(),
  judgeScope: z.enum(["ALL", "ASSIGNED"]),
  submissionDeadline: z
    .string()
    .optional()
    .transform((value) => value || ""),
  exportIncludeComments: z.boolean(),
});

export const judgeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal("")),
  active: z.boolean(),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  competitionId: z.string().min(1, "Competition is required."),
  name: z.string().min(1, "Category name is required."),
  description: z.string().optional(),
  displayOrder: z.coerce.number().int().nonnegative(),
  active: z.boolean().default(true),
});

export const competitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Competition name is required."),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

export const competitionImageSchema = z.object({
  competitionId: z.string().min(1, "Competition is required."),
  imageUrl: z.string().min(1, "Image URL is required."),
  imageName: z.string().optional(),
});

export const userAccountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required."),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "CHIEF_JUDGE", "JUDGE", "TEAM"]),
  active: z.boolean(),
  linkedTeamId: z.string().optional().or(z.literal("")),
});
