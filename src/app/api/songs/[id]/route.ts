import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { getUserId, unauthorized, badRequest, notFound } from "@/lib/api-helpers";
import { isCue } from "@/lib/cues";

async function loadOwnedSong(userId: string, id: string) {
  const [song] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), eq(songs.userId, userId)))
    .limit(1);
  return song ?? null;
}

/** PATCH /api/songs/[id] — set/change/clear the category cue. Setting a non-null cue joins My Songs. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/songs/[id]">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const existing = await loadOwnedSong(userId, id);
  if (!existing) return notFound("Song not found");

  const body = await request.json().catch(() => null);
  if (!body || !("cue" in body)) return badRequest("Missing cue field");
  const { cue } = body as { cue: unknown };
  if (cue !== null && !isCue(cue)) return badRequest("Invalid cue value");

  await db
    .update(songs)
    .set({ cue, inMySongs: cue !== null ? true : existing.inMySongs, updatedAt: new Date() })
    .where(eq(songs.id, id));

  const [updated] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  return NextResponse.json({ song: updated });
}

/** DELETE /api/songs/[id] — explicit removal from My Songs (full delete; Section 4). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/songs/[id]">) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;

  const existing = await loadOwnedSong(userId, id);
  if (!existing) return notFound("Song not found");

  // Cascades to notes and playlist_songs via FK ON DELETE CASCADE.
  await db.delete(songs).where(eq(songs.id, id));
  return NextResponse.json({ ok: true });
}
