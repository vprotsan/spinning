import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, notFound } from "@/lib/api-helpers";

async function loadOwnedNote(userId: string, songId: string, noteId: string) {
  const [song] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.userId, userId)))
    .limit(1);
  if (!song) return null;
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.songId, songId)))
    .limit(1);
  return note ?? null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** PATCH /api/songs/[id]/notes/[noteId] — edit a note's span/text, re-validating overlap. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/songs/[id]/notes/[noteId]">
) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id, noteId } = await ctx.params;

  const existing = await loadOwnedNote(userId, id, noteId);
  if (!existing) return notFound("Note not found");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");
  const startMs = typeof body.startMs === "number" ? body.startMs : existing.startMs;
  const endMs = typeof body.endMs === "number" ? body.endMs : existing.endMs;
  const note = "note" in body ? body.note : existing.note;

  if (endMs <= startMs) return badRequest("endMs must be greater than startMs");
  if (note !== undefined && note !== null && typeof note !== "string") {
    return badRequest("note must be a string");
  }

  const siblings = await db.select().from(notes).where(eq(notes.songId, id));
  const conflict = siblings.some((n) => n.id !== noteId && overlaps(startMs, endMs, n.startMs, n.endMs));
  if (conflict) {
    return NextResponse.json({ error: "Note overlaps an existing note on this song" }, { status: 409 });
  }

  await db.update(notes).set({ startMs, endMs, note: note ?? null }).where(eq(notes.id, noteId));
  const [updated] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  return NextResponse.json({ note: updated });
}

/** DELETE /api/songs/[id]/notes/[noteId] — remove a note. Does not affect My Songs membership. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/songs/[id]/notes/[noteId]">
) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id, noteId } = await ctx.params;

  const existing = await loadOwnedNote(userId, id, noteId);
  if (!existing) return notFound("Note not found");

  await db.delete(notes).where(eq(notes.id, noteId));
  return NextResponse.json({ ok: true });
}
