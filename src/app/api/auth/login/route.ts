import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSpotifyAuthorizeUrl } from "@/lib/spotify/auth";

const STATE_COOKIE = "cpd_oauth_state";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return NextResponse.redirect(getSpotifyAuthorizeUrl(state));
}
