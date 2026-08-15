"use client";

import { useEffect, useState } from "react";
import { usePlaybackSdk } from "@/lib/usePlaybackSdk";
import Scrubber from "@/components/Scrubber";
import { apiFetch } from "@/lib/api-client";
import { formatDuration } from "@/lib/types";
import type { ApiNote, ApiSong } from "@/lib/types";

/**
 * Mark Start / Mark End timestamp marking (Section 6). Large, thumb-reachable,
 * hard-to-misfire buttons per Section 8 — the user's attention is on the music,
 * not the screen, while tapping these.
 */
export default function NoteEditor({
  song,
  onClose,
  onNotesChanged,
}: {
  song: ApiSong;
  onClose: () => void;
  onNotesChanged: (notes: ApiNote[]) => void;
}) {
  const { ready, deviceId, error, position, duration, paused, currentTrackUri, playUri, togglePlay, seek } =
    usePlaybackSdk();
  const [notes, setNotes] = useState<ApiNote[]>(song.notes);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<ApiNote | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);

  const isThisTrackLoaded = currentTrackUri === song.spotifyUri;

  useEffect(() => {
    if (ready && deviceId) playUri(song.spotifyUri);
    // Only start playback once the player is ready — re-running on every
    // position tick would restart the track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, deviceId]);

  function handleMarkStart() {
    setPendingStart(position);
  }

  async function handleMarkEnd() {
    if (editingNote) {
      // Editing an existing note — just mark the new end locally; saving happens
      // via the separate Update button so start/end/text can be reviewed together.
      setPendingEnd(position);
      return;
    }

    if (pendingStart === null) return;
    const startMs = Math.min(pendingStart, position);
    const endMs = Math.max(pendingStart, position);
    if (endMs - startMs < 250) {
      setSaveError("That span is too short — try again.");
      setPendingStart(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { note } = await apiFetch<{ note: ApiNote }>(`/api/songs/${song.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ startMs, endMs, note: noteText.trim() || undefined }),
      });
      const updated = [...notes, note].sort((a, b) => a.startMs - b.startMs);
      setNotes(updated);
      onNotesChanged(updated);
      setNoteText("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setPendingStart(null);
      setSaving(false);
    }
  }

  async function handleSaveUpdate() {
    if (!editingNote) return;
    const startMs = pendingStart ?? editingNote.startMs;
    const endMs = pendingEnd ?? editingNote.endMs;
    if (endMs - startMs < 250) {
      setSaveError("That span is too short — try again.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { note } = await apiFetch<{ note: ApiNote }>(`/api/songs/${song.id}/notes/${editingNote.id}`, {
        method: "PATCH",
        body: JSON.stringify({ startMs, endMs, note: noteText.trim() || null }),
      });
      const updated = notes.map((n) => (n.id === note.id ? note : n)).sort((a, b) => a.startMs - b.startMs);
      setNotes(updated);
      onNotesChanged(updated);
      handleCancelEdit();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(n: ApiNote) {
    setEditingNote(n);
    setPendingStart(null);
    setPendingEnd(null);
    setNoteText(n.note ?? "");
    setSaveError(null);
    if (deviceId) seek(n.startMs);
  }

  function handleCancelEdit() {
    setEditingNote(null);
    setPendingStart(null);
    setPendingEnd(null);
    setNoteText("");
    setSaveError(null);
  }

  async function handleDelete(noteId: string) {
    await apiFetch(`/api/songs/${song.id}/notes/${noteId}`, { method: "DELETE" });
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    onNotesChanged(updated);
    if (editingNote?.id === noteId) handleCancelEdit();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <p className="text-sm text-neutral-400">Time-stamped notes</p>
          <h2 className="text-lg font-semibold">{song.title}</h2>
          <p className="text-sm text-neutral-400">{song.artist}</p>
        </div>
        <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium">
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {error && (
          <p className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {!error && !ready && (
          <p className="text-sm text-neutral-400">Connecting to Spotify playback…</p>
        )}
        {!error && ready && !deviceId && (
          <p className="text-sm text-neutral-400">Waiting for the player to become ready…</p>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono tabular-nums">
              {formatDuration(dragPosition ?? position)}
              <span className="text-base text-neutral-500"> / {formatDuration(duration)}</span>
            </span>
            <button
              onClick={togglePlay}
              disabled={!deviceId || !isThisTrackLoaded}
              className="rounded-full bg-emerald-500 px-6 py-3 text-lg font-semibold text-black disabled:opacity-40"
            >
              {paused ? "▶ Play" : "⏸ Pause"}
            </button>
          </div>

          <Scrubber
            position={position}
            duration={duration}
            disabled={!deviceId || !isThisTrackLoaded}
            onSeek={(ms) => {
              seek(ms);
              setDragPosition(null);
            }}
            onDrag={setDragPosition}
          />

          {editingNote && (
            <p className="text-center text-sm text-amber-400">
              Editing note (currently {formatDuration(editingNote.startMs)} –{" "}
              {formatDuration(editingNote.endMs)}) — seek and tap Update Start and/or Update End, then
              tap Update to save, or{" "}
              <button onClick={handleCancelEdit} className="underline">
                cancel
              </button>
              .
            </p>
          )}

          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Optional note for the next span (e.g. 'big jump')"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleMarkStart}
              disabled={!deviceId || saving}
              className="rounded-2xl bg-sky-600 py-6 text-lg font-bold active:scale-95 transition disabled:opacity-40"
            >
              {editingNote ? "Update Start" : "Mark Start"}
            </button>
            <button
              onClick={handleMarkEnd}
              disabled={!deviceId || saving || (!editingNote && pendingStart === null)}
              className="rounded-2xl bg-rose-600 py-6 text-lg font-bold active:scale-95 transition disabled:opacity-40"
            >
              {editingNote ? "Update End" : "Mark End"}
            </button>
          </div>

          {editingNote && (
            <button
              onClick={handleSaveUpdate}
              disabled={!deviceId || saving}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-black active:scale-95 transition disabled:opacity-40"
            >
              {saving ? "Saving…" : "Update"}
            </button>
          )}

          {(pendingStart !== null || pendingEnd !== null) && (
            <p className="text-center text-sm text-sky-400">
              {pendingStart !== null && <>New start: {formatDuration(pendingStart)}. </>}
              {pendingEnd !== null && <>New end: {formatDuration(pendingEnd)}. </>}
              {editingNote
                ? "Tap Update to save."
                : "Tap Mark End when the action ends."}
            </p>
          )}
          {saveError && <p className="text-center text-sm text-red-400">{saveError}</p>}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-400">
            Notes on this song ({notes.length})
          </h3>
          {notes.length === 0 && (
            <p className="text-sm text-neutral-500">No notes yet — mark a span above.</p>
          )}
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-3 ${
                  editingNote?.id === n.id
                    ? "border-amber-500 bg-amber-950/20"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <div>
                  <p className="font-mono text-sm">
                    {formatDuration(n.startMs)} – {formatDuration(n.endMs)}
                  </p>
                  {n.note && <p className="text-sm text-neutral-400">{n.note}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleEdit(n)}
                    disabled={!deviceId || saving}
                    className="rounded-full bg-neutral-800 px-3 py-2 text-xs text-neutral-300 disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="rounded-full bg-neutral-800 px-3 py-2 text-xs text-neutral-300"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
