"use client";

import { useEffect, useState } from "react";
import SongRow from "@/components/SongRow";
import SongDetailSheet from "@/components/SongDetailSheet";
import { apiFetch } from "@/lib/api-client";
import type { ApiSong, SpotifyTrackResult } from "@/lib/types";

type Tab = "search" | "library";

export default function SearchClient() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<SpotifyTrackResult[]>([]);
  const [libraryOffset, setLibraryOffset] = useState(0);
  const [libraryHasMore, setLibraryHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiSong | null>(null);

  useEffect(() => {
    if (tab === "library" && libraryTracks.length === 0) {
      void loadLibrary(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { tracks } = await apiFetch<{ tracks: SpotifyTrackResult[] }>(
        `/api/songs/search?q=${encodeURIComponent(query.trim())}`
      );
      setResults(tracks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary(offset: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: SpotifyTrackResult[]; total: number; next: string | null }>(
        `/api/songs/library?offset=${offset}`
      );
      setLibraryTracks((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      setLibraryOffset(offset + data.items.length);
      setLibraryHasMore(Boolean(data.next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your library");
    } finally {
      setLoading(false);
    }
  }

  async function openTrack(track: SpotifyTrackResult) {
    const { song } = await apiFetch<{ song: ApiSong }>("/api/songs", {
      method: "POST",
      body: JSON.stringify(track),
    });
    setSelected({ ...song, notes: [] });
  }

  const list = tab === "search" ? results : libraryTracks;

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 rounded-full border py-2 text-sm font-medium ${
            tab === "search" ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Search Spotify
        </button>
        <button
          onClick={() => setTab("library")}
          className={`flex-1 rounded-full border py-2 text-sm font-medium ${
            tab === "library" ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Your Library
        </button>
      </div>

      {tab === "search" && (
        <form onSubmit={handleSearch} className="flex gap-2">
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

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && list.length === 0 && <p className="text-sm text-neutral-500">Loading…</p>}

      <div className="space-y-2">
        {list.map((track) => (
          <SongRow
            key={track.spotifyTrackId}
            title={track.title}
            artist={track.artist}
            durationMs={track.durationMs}
            onClick={() => openTrack(track)}
          />
        ))}
      </div>

      {tab === "library" && libraryHasMore && libraryTracks.length > 0 && (
        <button
          onClick={() => loadLibrary(libraryOffset)}
          disabled={loading}
          className="w-full rounded-lg border border-neutral-800 py-2 text-sm text-neutral-400"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {selected && (
        <SongDetailSheet
          song={selected}
          onClose={() => setSelected(null)}
          onSongUpdated={(s) => setSelected(s)}
        />
      )}
    </div>
  );
}
