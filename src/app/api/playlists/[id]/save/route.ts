import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistSongs, songs } from "@/db/schema";
import { getUserId, unauthorized, notFound } from "@/lib/api-helpers";
import { saveSpotifyPlaylist } from "@/lib/spotify/api";

/**
 * POST /api/playlists/[id]/save — save (or re-save) this playlist to Spotify.
 * Each playlist syncs to its own Spotify playlist independently (Section 3/7).
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/playlists/[id]/save">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .limit(1);
  if (!playlist) return notFound("Playlist not found");

  const rows = await db
    .select({ spotifyUri: songs.spotifyUri })
    .from(playlistSongs)
    .innerJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(eq(playlistSongs.playlistId, id))
    .orderBy(asc(playlistSongs.position));

  try {
    const { spotifyPlaylistId } = await saveSpotifyPlaylist(userId, {
      spotifyPlaylistId: playlist.spotifyPlaylistId,
      name: playlist.name,
      trackUris: rows.map((r) => r.spotifyUri),
    });

    await db
      .update(playlists)
      .set({ spotifyPlaylistId, updatedAt: new Date() })
      .where(eq(playlists.id, id));

    return NextResponse.json({ spotifyPlaylistId });
  } catch (err) {
    console.error("Failed to save playlist to Spotify", err);
    const message = err instanceof Error ? err.message : "Failed to save playlist to Spotify";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
