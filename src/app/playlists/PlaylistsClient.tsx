"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { formatPlaylistDuration } from "@/lib/types";
import type { ApiPlaylistSummary } from "@/lib/types";

export default function PlaylistsClient() {
  const [playlists, setPlaylists] = useState<ApiPlaylistSummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ playlists: ApiPlaylistSummary[] }>("/api/playlists")
      .then((d) => setPlaylists(d.playlists))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load playlists"));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const { playlist } = await apiFetch<{ playlist: ApiPlaylistSummary }>("/api/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setPlaylists((prev) => [...(prev ?? []), { ...playlist, songCount: 0, totalDurationMs: 0 }]);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create playlist");
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Playlists</h1>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist name"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-black">
          Create
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {playlists === null && !error && <p className="text-sm text-neutral-500">Loading…</p>}
      {playlists?.length === 0 && (
        <p className="text-sm text-neutral-500">No playlists yet — create your first one above.</p>
      )}

      <div className="space-y-2">
        {playlists?.map((p) => (
          <Link
            key={p.id}
            href={`/playlists/${p.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 active:bg-neutral-800"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-neutral-400">
                {p.songCount} song{p.songCount === 1 ? "" : "s"} · {formatPlaylistDuration(p.totalDurationMs)}
                {p.spotifyPlaylistId && " · Saved to Spotify"}
              </p>
            </div>
            <span className="text-neutral-500">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
