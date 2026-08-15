import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistSongs, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, notFound, parseTrackPayload } from "@/lib/api-helpers";
import { getOrCreateSong, markInMySongs } from "@/lib/songs";

async function loadOwnedPlaylist(userId: string, id: string) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .limit(1);
  return playlist ?? null;
}

/**
 * POST /api/playlists/[id]/songs — add a song, either by { songId } (from My
 * Songs) or by track fields (straight from Spotify search). Either path also
 * joins My Songs (Section 3 / Section 4).
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/playlists/[id]/songs">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id: playlistId } = await ctx.params;

  const playlist = await loadOwnedPlaylist(userId, playlistId);
  if (!playlist) return notFound("Playlist not found");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  let songId: string;
  if (typeof body.songId === "string") {
    const [owned] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.id, body.songId), eq(songs.userId, userId)))
      .limit(1);
    if (!owned) return notFound("Song not found");
    songId = owned.id;
  } else {
    const track = parseTrackPayload(body);
    if (!track) return badRequest("Provide either songId or full track fields");
    songId = await getOrCreateSong(userId, track);
  }

  await markInMySongs(songId);

  const [{ nextPosition }] = await db
    .select({ nextPosition: sql<number>`coalesce(max(${playlistSongs.position}), -1) + 1` })
    .from(playlistSongs)
    .where(eq(playlistSongs.playlistId, playlistId));

  const [inserted] = await db
    .insert(playlistSongs)
    .values({ playlistId, songId, position: nextPosition })
    .onConflictDoNothing({ target: [playlistSongs.playlistId, playlistSongs.songId] })
    .returning();

  return NextResponse.json({ playlistSong: inserted ?? { playlistId, songId, alreadyPresent: true } }, { status: 201 });
}

/** PATCH /api/playlists/[id]/songs — reorder: body { orderedSongIds: string[] } (Section 7). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/playlists/[id]/songs">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id: playlistId } = await ctx.params;

  const playlist = await loadOwnedPlaylist(userId, playlistId);
  if (!playlist) return notFound("Playlist not found");

  const body = await request.json().catch(() => null);
  const orderedSongIds = body?.orderedSongIds;
  if (!Array.isArray(orderedSongIds) || orderedSongIds.some((v) => typeof v !== "string")) {
    return badRequest("orderedSongIds must be a string array");
  }

  const current = await db
    .select({ songId: playlistSongs.songId })
    .from(playlistSongs)
    .where(eq(playlistSongs.playlistId, playlistId));
  const currentIds = new Set(current.map((c) => c.songId));
  if (
    orderedSongIds.length !== currentIds.size ||
    !orderedSongIds.every((songId: string) => currentIds.has(songId))
  ) {
    return badRequest("orderedSongIds must contain exactly the playlist's current songs");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedSongIds.length; i++) {
      await tx
        .update(playlistSongs)
        .set({ position: i })
        .where(and(eq(playlistSongs.playlistId, playlistId), eq(playlistSongs.songId, orderedSongIds[i])));
    }
  });

  return NextResponse.json({ ok: true });
}
