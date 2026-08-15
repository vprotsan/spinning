import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized, badRequest } from "@/lib/api-helpers";
import { searchTracks } from "@/lib/spotify/api";

/** GET /api/songs/search?q=... — proxy a Spotify track search (Section 2). */
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return badRequest("q is required");

  try {
    const tracks = await searchTracks(userId, q);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("Spotify search failed", err);
    const message = err instanceof Error ? err.message : "Spotify search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
