import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistSongs, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest } from "@/lib/api-helpers";

/** GET /api/playlists — list the user's playlists with song count + total duration. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      spotifyPlaylistId: playlists.spotifyPlaylistId,
      smoothTransitions: playlists.smoothTransitions,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      songCount: sql<number>`count(${playlistSongs.id})::int`,
      totalDurationMs: sql<number>`coalesce(sum(${songs.durationMs}), 0)::int`,
    })
    .from(playlists)
    .leftJoin(playlistSongs, eq(playlistSongs.playlistId, playlists.id))
    .leftJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(eq(playlists.userId, userId))
    .groupBy(playlists.id)
    .orderBy(playlists.createdAt);

  return NextResponse.json({ playlists: rows });
}

/** POST /api/playlists — create a new (initially empty) playlist. No cap on count (Section 7). */
export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name is required");

  const [created] = await db.insert(playlists).values({ userId, name }).returning();
  return NextResponse.json({ playlist: created }, { status: 201 });
}
