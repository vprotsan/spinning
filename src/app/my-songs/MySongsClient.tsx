"use client";

import { useEffect, useState } from "react";
import SongRow from "@/components/SongRow";
import SongDetailSheet from "@/components/SongDetailSheet";
import { apiFetch } from "@/lib/api-client";
import type { ApiSong } from "@/lib/types";
import { CUES } from "@/lib/cues";

type Filter = "all" | "untagged" | (typeof CUES)[number];

export default function MySongsClient() {
  const [songs, setSongs] = useState<ApiSong[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<ApiSong | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(f: Filter) {
    const qs = f === "all" ? "" : `?cue=${f}`;
    apiFetch<{ songs: ApiSong[] }>(`/api/songs${qs}`)
      .then((d) => setSongs(d.songs))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load My Songs"));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  function handleSongUpdated(updated: ApiSong) {
    setSongs((prev) => (prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev));
    setSelected(updated);
  }

  function handleRemoved(songId: string) {
    setSongs((prev) => (prev ? prev.filter((s) => s.id !== songId) : prev));
    setSelected(null);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">My Songs</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", ...CUES, "untagged"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              filter === f
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-neutral-800 text-neutral-400"
            }`}
          >
            {f === "all" ? "All" : f === "untagged" ? "Untagged" : f}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {songs === null && !error && <p className="text-sm text-neutral-500">Loading…</p>}
      {songs?.length === 0 && (
        <p className="text-sm text-neutral-500">
          No songs here yet. Tag a song or add one to a playlist from the Search tab to get
          started.
        </p>
      )}

      <div className="space-y-2">
        {songs?.map((song) => (
          <SongRow
            key={song.id}
            title={song.title}
            artist={song.artist}
            durationMs={song.durationMs}
            cue={song.cue}
            noteCount={song.notes.length}
            onClick={() => setSelected(song)}
          />
        ))}
      </div>

      {selected && (
        <SongDetailSheet
          song={selected}
          onClose={() => setSelected(null)}
          onSongUpdated={handleSongUpdated}
          onRemovedFromMySongs={handleRemoved}
        />
      )}
    </div>
  );
}
