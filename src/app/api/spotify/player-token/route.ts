import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/api-helpers";
import { getValidAccessToken } from "@/lib/spotify/api";

/**
 * GET /api/spotify/player-token — a short-lived access token for the browser
 * to hand to the Spotify Web Playback SDK's getOAuthToken callback. The SDK
 * requires a real user-scoped token client-side to stream audio; this route
 * exists so the token is always freshly refreshed server-side first.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const accessToken = await getValidAccessToken(userId);
  return NextResponse.json({ accessToken });
}
