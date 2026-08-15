"use client";

import { useEffect, useState } from "react";
import SongRow from "@/components/SongRow";
import SongDetailSheet from "@/components/SongDetailSheet";
import { apiFetch } from "@/lib/api-client";
import { usePlaybackSdk } from "@/lib/usePlaybackSdk";
import type { ApiSong, SpotifyPlaylistResult, SpotifyTrackResult } from "@/lib/types";

type Tab = "search" | "library" | "playlists";

export default function SearchClient() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<SpotifyTrackResult[]>([]);
  const [libraryOffset, setLibraryOffset] = useState(0);
  const [libraryHasMore, setLibraryHasMore] = useState(true);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistResult[] | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<SpotifyPlaylistResult | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrackResult[]>([]);
  const [playlistOffset, setPlaylistOffset] = useState(0);
  const [playlistHasMore, setPlaylistHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiSong | null>(null);
  const { deviceId, paused, currentTrackUri, playUri, togglePlay } = usePlaybackSdk();

  function togglePreview(track: SpotifyTrackResult) {
    if (currentTrackUri === track.spotifyUri) {
      togglePlay();
    } else {
      playUri(track.spotifyUri);
    }
  }

  useEffect(() => {
    if (tab === "library" && libraryTracks.length === 0) {
      void loadLibrary(0);
    }
    if (tab === "playlists" && spotifyPlaylists === null) {
      void loadPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    await runSearch(query.trim(), 0);
  }

  async function runSearch(q: string, offset: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ tracks: SpotifyTrackResult[]; hasMore: boolean }>(
        `/api/songs/search?q=${encodeURIComponent(q)}&offset=${offset}`
      );
      setResults((prev) => (offset === 0 ? data.tracks : [...prev, ...data.tracks]));
      setSearchOffset(offset + data.tracks.length);
      setSearchHasMore(data.hasMore);
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

  async function loadPlaylists() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ playlists: SpotifyPlaylistResult[] }>("/api/spotify/playlists");
      setSpotifyPlaylists(data.playlists);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your Spotify playlists");
      setSpotifyPlaylists([]);
    } finally {
      setLoading(false);
    }
  }

  function openPlaylist(playlist: SpotifyPlaylistResult) {
    setActivePlaylist(playlist);
    setPlaylistTracks([]);
    void loadPlaylistTracks(playlist.id, 0);
  }

  async function loadPlaylistTracks(playlistId: string, offset: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ tracks: SpotifyTrackResult[]; hasMore: boolean }>(
        `/api/spotify/playlists/${playlistId}/items?offset=${offset}`
      );
      setPlaylistTracks((prev) => (offset === 0 ? data.tracks : [...prev, ...data.tracks]));
      setPlaylistOffset(offset + data.tracks.length);
      setPlaylistHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load playlist tracks");
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

  const list = tab === "search" ? results : tab === "library" ? libraryTracks : playlistTracks;

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
        <button
          onClick={() => setTab("playlists")}
          className={`flex-1 rounded-full border py-2 text-sm font-medium ${
            tab === "playlists" ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Your Playlists
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

      {tab === "playlists" && activePlaylist && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setActivePlaylist(null)}
            className="text-sm text-neutral-400"
          >
            ← Back to playlists
          </button>
          {activePlaylist.externalUrl && (
            <a
              href={activePlaylist.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300"
            >
              Open in Spotify ↗
            </a>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {tab === "playlists" && !activePlaylist ? (
        <div className="space-y-2">
          {loading && spotifyPlaylists?.length === 0 && (
            <p className="text-sm text-neutral-500">Loading…</p>
          )}
          {spotifyPlaylists?.length === 0 && !loading && (
            <p className="text-sm text-neutral-500">No playlists found.</p>
          )}
          {spotifyPlaylists?.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => openPlaylist(playlist)}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 active:bg-neutral-800 cursor-pointer"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                {playlist.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playlist.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{playlist.name}</p>
                <p className="truncate text-sm text-neutral-400">
                  {playlist.ownerName} · {playlist.trackCount} tracks
                </p>
              </div>
              <span className="shrink-0 text-neutral-500">→</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {loading && list.length === 0 && <p className="text-sm text-neutral-500">Loading…</p>}

          <div className="space-y-2">
            {list.map((track) => (
              <SongRow
                key={track.spotifyTrackId}
                title={track.title}
                artist={track.artist}
                durationMs={track.durationMs}
                onClick={() => openTrack(track)}
                albumImageUrl={track.albumImageUrl}
                isPlaying={!paused && currentTrackUri === track.spotifyUri}
                onTogglePreview={deviceId ? () => togglePreview(track) : undefined}
              />
            ))}
          </div>
        </>
      )}

      {tab === "search" && searchHasMore && results.length > 0 && (
        <button
          onClick={() => runSearch(query.trim(), searchOffset)}
          disabled={loading}
          className="w-full rounded-lg border border-neutral-800 py-2 text-sm text-neutral-400"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {tab === "playlists" && activePlaylist && playlistHasMore && playlistTracks.length > 0 && (
        <button
          onClick={() => loadPlaylistTracks(activePlaylist.id, playlistOffset)}
          disabled={loading}
          className="w-full rounded-lg border border-neutral-800 py-2 text-sm text-neutral-400"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

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
