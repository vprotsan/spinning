"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SortablePlaylistSongs from "@/components/SortablePlaylistSongs";
import AddSongsToPlaylistSheet from "@/components/AddSongsToPlaylistSheet";
import SongDetailSheet from "@/components/SongDetailSheet";
import PlaylistPlayerBar from "@/components/PlaylistPlayerBar";
import { apiFetch } from "@/lib/api-client";
import { formatPlaylistDuration } from "@/lib/types";
import type { ApiPlaylistDetail, ApiPlaylistSong, ApiSong } from "@/lib/types";

export default function PlaylistDetailClient({ playlistId }: { playlistId: string }) {
  const router = useRouter();
  const [playlist, setPlaylist] = useState<ApiPlaylistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [openSong, setOpenSong] = useState<ApiPlaylistSong | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    apiFetch<{ playlist: ApiPlaylistDetail }>(`/api/playlists/${playlistId}`)
      .then((d) => {
        setPlaylist(d.playlist);
        setNameDraft(d.playlist.name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load playlist"));
  }

  useEffect(load, [playlistId]);

  async function handleReorder(orderedSongIds: string[]) {
    if (!playlist) return;
    const prev = playlist;
    // Optimistic update.
    const bySongId = new Map(playlist.songs.map((s) => [s.id, s]));
    const reordered = orderedSongIds
      .map((id, i) => {
        const s = bySongId.get(id);
        return s ? { ...s, position: i } : null;
      })
      .filter((s): s is ApiPlaylistSong => s !== null);
    setPlaylist({ ...playlist, songs: reordered });
    try {
      await apiFetch(`/api/playlists/${playlistId}/songs`, {
        method: "PATCH",
        body: JSON.stringify({ orderedSongIds }),
      });
    } catch {
      setPlaylist(prev);
      setError("Failed to save the new order");
    }
  }

  async function handleRemove(songId: string) {
    if (!playlist) return;
    await apiFetch(`/api/playlists/${playlistId}/songs/${songId}`, { method: "DELETE" });
    setPlaylist({ ...playlist, songs: playlist.songs.filter((s) => s.id !== songId) });
  }

  async function handleRename() {
    const name = nameDraft.trim();
    if (!name || !playlist) return;
    const { playlist: updated } = await apiFetch<{ playlist: ApiPlaylistDetail }>(
      `/api/playlists/${playlistId}`,
      { method: "PATCH", body: JSON.stringify({ name }) }
    );
    setPlaylist({ ...playlist, name: updated.name });
    setEditingName(false);
  }

  async function handleToggleSmoothTransitions() {
    if (!playlist) return;
    const smoothTransitions = !playlist.smoothTransitions;
    setPlaylist({ ...playlist, smoothTransitions });
    await apiFetch(`/api/playlists/${playlistId}`, {
      method: "PATCH",
      body: JSON.stringify({ smoothTransitions }),
    });
  }

  async function handleSaveToSpotify() {
    setSaving(true);
    setSaveMessage(null);
    try {
      await apiFetch(`/api/playlists/${playlistId}/save`, { method: "POST" });
      setSaveMessage("Saved to Spotify.");
      load();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Failed to save to Spotify");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlaylist() {
    await apiFetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
    router.push("/playlists");
  }

  function handleSongUpdated(updated: ApiSong) {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      songs: playlist.songs.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
    });
    setOpenSong((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  function handleRemovedFromMySongs(songId: string) {
    // Removing from My Songs is a full delete — it also drops out of this playlist.
    if (!playlist) return;
    setPlaylist({ ...playlist, songs: playlist.songs.filter((s) => s.id !== songId) });
    setOpenSong(null);
  }

  if (error) return <p className="px-4 py-4 text-sm text-red-400">{error}</p>;
  if (!playlist) return <p className="px-4 py-4 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className={`px-4 py-4 space-y-4 ${playlist.songs.length > 0 ? "pb-72" : ""}`}>
      <div className="space-y-2">
        {editingName ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-lg font-semibold"
            />
            <button onClick={handleRename} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-black">
              Save
            </button>
          </div>
        ) : (
          <h1
            onClick={() => setEditingName(true)}
            className="text-2xl font-bold active:opacity-70"
          >
            {playlist.name} <span className="text-sm font-normal text-neutral-500">(edit)</span>
          </h1>
        )}
        <p className="text-sm text-neutral-400">
          {playlist.songs.length} song{playlist.songs.length === 1 ? "" : "s"} ·{" "}
          {formatPlaylistDuration(playlist.totalDurationMs)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowAddSheet(true)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-black"
        >
          + Add songs
        </button>
        <button
          onClick={handleSaveToSpotify}
          disabled={saving || playlist.songs.length === 0}
          className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "Saving…" : playlist.spotifyPlaylistId ? "Re-save to Spotify" : "Save to Spotify"}
        </button>
      </div>
      {saveMessage && <p className="text-sm text-neutral-400">{saveMessage}</p>}

      <label className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Smooth transitions</p>
          <p className="text-xs text-neutral-500">
            Optional fade-out/fade-in between songs (beta). Off by default.
          </p>
        </div>
        <input
          type="checkbox"
          checked={playlist.smoothTransitions}
          onChange={handleToggleSmoothTransitions}
          className="h-5 w-5 accent-emerald-500"
        />
      </label>

      {playlist.songs.length === 0 ? (
        <p className="text-sm text-neutral-500">No songs yet — tap “Add songs” above.</p>
      ) : (
        <SortablePlaylistSongs
          songs={playlist.songs}
          onReorder={handleReorder}
          onOpenSong={setOpenSong}
          onRemove={handleRemove}
        />
      )}

      <div className="border-t border-neutral-800 pt-4">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-medium text-red-400"
          >
            Delete this playlist
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-red-900 bg-red-950/30 p-3">
            <p className="text-sm text-red-300">
              This deletes the playlist itself. My Songs and each song&rsquo;s tags/notes are
              unaffected.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDeletePlaylist} className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold">
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg bg-neutral-800 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddSheet && (
        <AddSongsToPlaylistSheet
          playlistId={playlistId}
          existingSongIds={new Set(playlist.songs.map((s) => s.id))}
          onClose={() => {
            setShowAddSheet(false);
            load();
          }}
          onAdded={() => {}}
        />
      )}

      {openSong && (
        <SongDetailSheet
          song={openSong}
          onClose={() => setOpenSong(null)}
          onSongUpdated={handleSongUpdated}
          onRemovedFromMySongs={handleRemovedFromMySongs}
        />
      )}

      {playlist.songs.length > 0 && <PlaylistPlayerBar songs={playlist.songs} />}
    </div>
  );
}
