import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, notFound } from "@/lib/api-helpers";
import { markInMySongs } from "@/lib/songs";

async function loadOwnedSong(userId: string, id: string) {
  const [song] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), eq(songs.userId, userId)))
    .limit(1);
  return song ?? null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** POST /api/songs/[id]/notes — create a time-stamped note (Section 6). Joins My Songs. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/songs/[id]/notes">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const song = await loadOwnedSong(userId, id);
  if (!song) return notFound("Song not found");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");
  const { startMs, endMs, note } = body as { startMs?: unknown; endMs?: unknown; note?: unknown };

  if (typeof startMs !== "number" || typeof endMs !== "number" || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return badRequest("startMs and endMs must be numbers");
  }
  if (endMs <= startMs) return badRequest("endMs must be greater than startMs");
  if (note !== undefined && note !== null && typeof note !== "string") {
    return badRequest("note must be a string");
  }

  const existingNotes = await db.select().from(notes).where(eq(notes.songId, id));
  const conflict = existingNotes.some((n) => overlaps(startMs, endMs, n.startMs, n.endMs));
  if (conflict) {
    return NextResponse.json({ error: "Note overlaps an existing note on this song" }, { status: 409 });
  }

  const [inserted] = await db
    .insert(notes)
    .values({ songId: id, startMs, endMs, note: note ?? null })
    .returning();

  await markInMySongs(id);

  return NextResponse.json({ note: inserted }, { status: 201 });
}
