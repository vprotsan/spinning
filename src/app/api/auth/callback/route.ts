import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { exchangeCodeForToken, fetchSpotifyProfile } from "@/lib/spotify/auth";
import { createSession } from "@/lib/session";

const STATE_COOKIE = "cpd_oauth_state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (error) {
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(error)}`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/?error=invalid_state`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const profile = await fetchSpotifyProfile(token.access_token);

    if (!token.refresh_token) {
      // Should always be present on the first authorization; guard anyway.
      throw new Error("Spotify did not return a refresh token.");
    }

    const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);

    await db
      .insert(users)
      .values({
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: profile.display_name,
          email: profile.email,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpiresAt,
        },
      });

    await createSession({ userId: profile.id });

    return NextResponse.redirect(`${appUrl}/my-songs`);
  } catch (err) {
    console.error("Spotify OAuth callback failed", err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}
