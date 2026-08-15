import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notes, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, parseTrackPayload } from "@/lib/api-helpers";
import { getOrCreateSong } from "@/lib/songs";
import { isCue } from "@/lib/cues";

/** GET /api/songs?cue=Jumps|untagged  — list My Songs, optionally filtered by cue. */
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const cueParam = request.nextUrl.searchParams.get("cue");
  const conditions = [eq(songs.userId, userId), eq(songs.inMySongs, true)];
  if (cueParam === "untagged") {
    conditions.push(isNull(songs.cue));
  } else if (cueParam && isCue(cueParam)) {
    conditions.push(eq(songs.cue, cueParam));
  }

  const rows = await db
    .select()
    .from(songs)
    .where(and(...conditions))
    .orderBy(asc(songs.title));

  const songIds = rows.map((r) => r.id);
  const noteRows = songIds.length
    ? await db.select().from(notes).where(inArray(notes.songId, songIds)).orderBy(asc(notes.startMs))
    : [];

  const notesBySong = new Map<string, typeof noteRows>();
  for (const n of noteRows) {
    const list = notesBySong.get(n.songId) ?? [];
    list.push(n);
    notesBySong.set(n.songId, list);
  }

  return NextResponse.json({
    songs: rows.map((s) => ({ ...s, notes: notesBySong.get(s.id) ?? [] })),
  });
}

/** POST /api/songs — get-or-create a song row for a Spotify track (does not by itself join My Songs). */
export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");
  const track = parseTrackPayload(body);
  if (!track) return badRequest("Missing/invalid track fields");

  const songId = await getOrCreateSong(userId, track);
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  return NextResponse.json({ song }, { status: 201 });
}
