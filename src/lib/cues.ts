// The five fixed cue categories (v2 requirements Section 5). Kept as a plain
// array/type so it can be imported from client components without pulling in
// the Postgres-specific drizzle schema.
export const CUES = ["Jumps", "Climbs", "Sprints", "Standing Choreo", "Flat", "Jog"] as const;
export type Cue = (typeof CUES)[number];

export function isCue(value: unknown): value is Cue {
  return typeof value === "string" && (CUES as readonly string[]).includes(value);
}
