import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/api-helpers";
import { getPlaylistItems } from "@/lib/spotify/api";

/** GET /api/spotify/playlists/[id]/items?offset=0 — browse tracks in one of the user's Spotify playlists. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/spotify/playlists/[id]/items">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const offset = Number(request.nextUrl.searchParams.get("offset")) || 0;

  try {
    const result = await getPlaylistItems(userId, id, offset);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to load Spotify playlist items", err);
    const message = err instanceof Error ? err.message : "Failed to load playlist tracks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
