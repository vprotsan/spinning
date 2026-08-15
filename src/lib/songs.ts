import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { songs } from "@/db/schema";
import type { TrackPayload } from "@/lib/api-helpers";

/** Finds the user's existing DB row for this Spotify track, or creates one. Does NOT set inMySongs. */
export async function getOrCreateSong(userId: string, track: TrackPayload): Promise<string> {
  const [existing] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.userId, userId), eq(songs.spotifyTrackId, track.spotifyTrackId)))
    .limit(1);
  if (existing) return existing.id;

  const [inserted] = await db
    .insert(songs)
    .values({
      userId,
      spotifyTrackId: track.spotifyTrackId,
      spotifyUri: track.spotifyUri,
      title: track.title,
      artist: track.artist,
      durationMs: track.durationMs,
    })
    .returning({ id: songs.id });
  return inserted.id;
}

/** Marks a song as belonging to My Songs (idempotent). Membership is one-way — see v2 Section 4. */
export async function markInMySongs(songId: string) {
  await db.update(songs).set({ inMySongs: true, updatedAt: new Date() }).where(eq(songs.id, songId));
}
