import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notes, playlists, playlistSongs, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, notFound } from "@/lib/api-helpers";

async function loadOwnedPlaylist(userId: string, id: string) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .limit(1);
  return playlist ?? null;
}

/** GET /api/playlists/[id] — playlist detail: flat, ordered song list + total duration (Section 7). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/playlists/[id]">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const playlist = await loadOwnedPlaylist(userId, id);
  if (!playlist) return notFound("Playlist not found");

  const rows = await db
    .select({
      playlistSongId: playlistSongs.id,
      position: playlistSongs.position,
      song: songs,
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(eq(playlistSongs.playlistId, id))
    .orderBy(asc(playlistSongs.position));

  const songIds = rows.map((r) => r.song.id);
  const noteRows = songIds.length
    ? await db.select().from(notes).where(inArray(notes.songId, songIds)).orderBy(asc(notes.startMs))
    : [];
  const notesBySong = new Map<string, typeof noteRows>();
  for (const n of noteRows) {
    const list = notesBySong.get(n.songId) ?? [];
    list.push(n);
    notesBySong.set(n.songId, list);
  }

  const totalDurationMs = rows.reduce((sum, r) => sum + r.song.durationMs, 0);

  return NextResponse.json({
    playlist: {
      ...playlist,
      totalDurationMs,
      songs: rows.map((r) => ({
        playlistSongId: r.playlistSongId,
        position: r.position,
        ...r.song,
        notes: notesBySong.get(r.song.id) ?? [],
      })),
    },
  });
}

/** PATCH /api/playlists/[id] — rename and/or toggle smoothTransitions (Section 10). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/playlists/[id]">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const existing = await loadOwnedPlaylist(userId, id);
  if (!existing) return notFound("Playlist not found");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const update: { name?: string; smoothTransitions?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return badRequest("Invalid name");
    update.name = body.name.trim();
  }
  if ("smoothTransitions" in body) {
    if (typeof body.smoothTransitions !== "boolean") return badRequest("Invalid smoothTransitions");
    update.smoothTransitions = body.smoothTransitions;
  }

  await db.update(playlists).set(update).where(eq(playlists.id, id));
  const [updated] = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
  return NextResponse.json({ playlist: updated });
}

/** DELETE /api/playlists/[id] — deleting a playlist has no effect on My Songs or song tags (Section 7). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/playlists/[id]">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const existing = await loadOwnedPlaylist(userId, id);
  if (!existing) return notFound("Playlist not found");

  await db.delete(playlists).where(eq(playlists.id, id));
  return NextResponse.json({ ok: true });
}
