import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/** Returns the current user id, or null if not authenticated. */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export type TrackPayload = {
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  durationMs: number;
};

export function parseTrackPayload(body: Record<string, unknown>): TrackPayload | null {
  const { spotifyTrackId, spotifyUri, title, artist, durationMs } = body;
  if (
    typeof spotifyTrackId !== "string" ||
    typeof spotifyUri !== "string" ||
    typeof title !== "string" ||
    typeof artist !== "string" ||
    typeof durationMs !== "number"
  ) {
    return null;
  }
  return { spotifyTrackId, spotifyUri, title, artist, durationMs };
}
