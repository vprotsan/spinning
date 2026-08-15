"use client";

import { useEffect, useState } from "react";
import CueSelector from "@/components/CueSelector";
import NoteEditor from "@/components/NoteEditor";
import { apiFetch } from "@/lib/api-client";
import type { ApiSong, ApiNote, ApiPlaylistSummary } from "@/lib/types";
import type { Cue } from "@/lib/cues";

/**
 * The shared tagging surface: category tag, time-stamped notes, add-to-playlist,
 * and (for songs already in My Songs) explicit removal. Reachable from My Songs,
 * Search, and a playlist's song list alike (Section 4 — editable everywhere).
 */
export default function SongDetailSheet({
  song,
  onClose,
  onSongUpdated,
  onRemovedFromMySongs,
}: {
  song: ApiSong;
  onClose: () => void;
  onSongUpdated: (song: ApiSong) => void;
  onRemovedFromMySongs?: (songId: string) => void;
}) {
  const [current, setCurrent] = useState(song);
  const [editingNotes, setEditingNotes] = useState(false);
  const [playlists, setPlaylists] = useState<ApiPlaylistSummary[] | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    apiFetch<{ playlists: ApiPlaylistSummary[] }>("/api/playlists")
      .then((d) => setPlaylists(d.playlists))
      .catch(() => setPlaylists([]));
  }, []);

  async function handleCueChange(cue: Cue | null) {
    setBusy(true);
    try {
      const { song: updated } = await apiFetch<{ song: ApiSong }>(`/api/songs/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cue }),
      });
      const merged = { ...current, ...updated };
      setCurrent(merged);
      onSongUpdated(merged);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToPlaylist(playlistId: string) {
    await apiFetch(`/api/playlists/${playlistId}/songs`, {
      method: "POST",
      body: JSON.stringify({ songId: current.id }),
    });
    setAddedTo((prev) => new Set(prev).add(playlistId));
    const merged = { ...current, inMySongs: true };
    setCurrent(merged);
    onSongUpdated(merged);
  }

  async function handleCreatePlaylistAndAdd() {
    const name = newPlaylistName.trim();
    if (!name) return;
    const { playlist } = await apiFetch<{ playlist: ApiPlaylistSummary }>("/api/playlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setPlaylists((prev) => [...(prev ?? []), { ...playlist, songCount: 0, totalDurationMs: 0 }]);
    setNewPlaylistName("");
    await handleAddToPlaylist(playlist.id);
  }

  async function handleRemoveFromMySongs() {
    setBusy(true);
    try {
      await apiFetch(`/api/songs/${current.id}`, { method: "DELETE" });
      onRemovedFromMySongs?.(current.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function handleNotesChanged(notes: ApiNote[]) {
    const merged = { ...current, notes, inMySongs: true };
    setCurrent(merged);
    onSongUpdated(merged);
  }

  if (editingNotes) {
    return (
      <NoteEditor
        song={current}
        onClose={() => setEditingNotes(false)}
        onNotesChanged={handleNotesChanged}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-neutral-950 border-t border-neutral-800 p-5 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{current.title}</h2>
            <p className="truncate text-sm text-neutral-400">{current.artist}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm">
            Close
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-400">Category (optional)</h3>
          <CueSelector value={current.cue} onChange={handleCueChange} disabled={busy} />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-400">
            Time-stamped notes ({current.notes.length})
          </h3>
          <button
            onClick={() => setEditingNotes(true)}
            className="w-full rounded-xl bg-sky-700 py-3 text-sm font-semibold"
          >
            Mark Start / Mark End…
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-400">Add to playlist</h3>
          <div className="space-y-2">
            {(playlists ?? []).map((p) => {
              const added = addedTo.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => !added && handleAddToPlaylist(p.id)}
                  disabled={added}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm ${
                    added
                      ? "border-emerald-700 bg-emerald-950/40 text-emerald-400"
                      : "border-neutral-800 bg-neutral-900"
                  }`}
                >
                  <span>{p.name}</span>
                  <span>{added ? "Added ✓" : "Add"}</span>
                </button>
              );
            })}
            {playlists?.length === 0 && (
              <p className="text-sm text-neutral-500">No playlists yet — create one below.</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
            <button
              onClick={handleCreatePlaylistAndAdd}
              className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium"
            >
              Create & Add
            </button>
          </div>
        </section>

        {current.inMySongs && (
          <section className="space-y-2 border-t border-neutral-800 pt-4">
            {!confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="w-full rounded-xl border border-red-900 py-3 text-sm font-semibold text-red-400"
              >
                Remove from My Songs
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-red-900 bg-red-950/30 p-3">
                <p className="text-sm text-red-300">
                  This clears the category and all notes, and removes this song from every
                  playlist it&rsquo;s in. This can&rsquo;t be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRemoveFromMySongs}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold"
                  >
                    Yes, remove entirely
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 rounded-lg bg-neutral-800 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
