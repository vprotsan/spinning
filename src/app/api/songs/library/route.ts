import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/api-helpers";
import { getSavedTracks } from "@/lib/spotify/api";

/** GET /api/songs/library?offset=0 — browse the user's saved Spotify tracks (Section 2). */
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0") || 0;

  try {
    const result = await getSavedTracks(userId, offset);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Spotify saved tracks failed", err);
    return NextResponse.json({ error: "Failed to load your Spotify library" }, { status: 502 });
  }
}
