import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistSongs } from "@/db/schema";
import { getUserId, unauthorized, notFound } from "@/lib/api-helpers";

/** DELETE /api/playlists/[id]/songs/[songId] — remove from this playlist only; My Songs untouched. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/songs/[songId]">
) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id: playlistId, songId } = await ctx.params;

  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
    .limit(1);
  if (!playlist) return notFound("Playlist not found");

  await db
    .delete(playlistSongs)
    .where(and(eq(playlistSongs.playlistId, playlistId), eq(playlistSongs.songId, songId)));

  return NextResponse.json({ ok: true });
}
