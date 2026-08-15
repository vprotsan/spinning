import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/api-helpers";
import { getUserPlaylists } from "@/lib/spotify/api";

/** GET /api/spotify/playlists — list the user's own Spotify playlists. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const playlists = await getUserPlaylists(userId);
    return NextResponse.json({ playlists });
  } catch (err) {
    console.error("Failed to load Spotify playlists", err);
    const message = err instanceof Error ? err.message : "Failed to load Spotify playlists";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
