export const nominationTypes = ["SELF", "THIRD_PARTY"] as const;
export type NominationType = (typeof nominationTypes)[number];

export const locationOptions = ["ACT", "NT", "NSW", "QLD", "SA", "TAS", "VIC", "WA"] as const;
export type TeamLocation = (typeof locationOptions)[number];

export function serializeTeamLocations(locations: readonly TeamLocation[]) {
  return JSON.stringify(locations);
}

export function parseTeamLocations(value?: string | null): TeamLocation[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is TeamLocation =>
          typeof entry === "string" && locationOptions.some((option) => option === entry),
        )
      : [];
  } catch {
    return [];
  }
}
