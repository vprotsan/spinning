"use client";

import { useEffect, useState } from "react";
import SongRow from "@/components/SongRow";
import { apiFetch } from "@/lib/api-client";
import type { ApiSong, SpotifyTrackResult } from "@/lib/types";

type Tab = "mysongs" | "search";

/** Add songs to a playlist directly from Spotify search or from My Songs (Section 2/3). */
export default function AddSongsToPlaylistSheet({
  playlistId,
  existingSongIds,
  onClose,
  onAdded,
}: {
  playlistId: string;
  existingSongIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("mysongs");
  const [mySongs, setMySongs] = useState<ApiSong[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ songs: ApiSong[] }>("/api/songs")
      .then((d) => setMySongs(d.songs))
      .catch(() => setMySongs([]));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const { tracks } = await apiFetch<{ tracks: SpotifyTrackResult[] }>(
      `/api/songs/search?q=${encodeURIComponent(query.trim())}`
    );
    setResults(tracks);
  }

  async function addExisting(songId: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        body: JSON.stringify({ songId }),
      });
      setAddedIds((prev) => new Set(prev).add(songId));
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  async function addTrack(track: SpotifyTrackResult) {
    setBusy(true);
    try {
      await apiFetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        body: JSON.stringify(track),
      });
      setAddedIds((prev) => new Set(prev).add(track.spotifyTrackId));
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="text-lg font-semibold">Add songs</h2>
        <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm">
          Done
        </button>
      </div>

      <div className="flex gap-2 px-4 pt-3">
        <button
          onClick={() => setTab("mysongs")}
          className={`flex-1 rounded-full border py-2 text-sm font-medium ${
            tab === "mysongs" ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
          }`}
        >
          My Songs
        </button>
        <button
          onClick={() => setTab("search")}
          className={`flex-1 rounded-full border py-2 text-sm font-medium ${
            tab === "search" ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Search Spotify
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {tab === "search" && (
          <form onSubmit={handleSearch} className="flex gap-2 pb-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs or artists"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-black">
              Go
            </button>
          </form>
        )}

        {tab === "mysongs" &&
          (mySongs ?? []).map((s) => {
            const already = existingSongIds.has(s.id) || addedIds.has(s.id);
            return (
              <SongRow
                key={s.id}
                title={s.title}
                artist={s.artist}
                durationMs={s.durationMs}
                cue={s.cue}
                noteCount={s.notes.length}
                trailing={
                  <button
                    disabled={already || busy}
                    onClick={() => addExisting(s.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      already ? "bg-emerald-950 text-emerald-500" : "bg-emerald-600 text-black"
                    }`}
                  >
                    {already ? "Added" : "Add"}
                  </button>
                }
              />
            );
          })}

        {tab === "search" &&
          results.map((track) => {
            const already = addedIds.has(track.spotifyTrackId);
            return (
              <SongRow
                key={track.spotifyTrackId}
                title={track.title}
                artist={track.artist}
                durationMs={track.durationMs}
                trailing={
                  <button
                    disabled={already || busy}
                    onClick={() => addTrack(track)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      already ? "bg-emerald-950 text-emerald-500" : "bg-emerald-600 text-black"
                    }`}
                  >
                    {already ? "Added" : "Add"}
                  </button>
                }
              />
            );
          })}
      </div>
    </div>
  );
}
