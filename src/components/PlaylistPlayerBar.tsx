"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaybackSdk } from "@/lib/usePlaybackSdk";
import Scrubber from "@/components/Scrubber";
import { formatDuration } from "@/lib/types";
import type { ApiPlaylistSong } from "@/lib/types";

/**
 * Sticky bottom playback bar for playing a saved playlist's songs in order.
 * Shows the currently playing song and, when the playhead is inside one, its
 * time-stamped note — and auto-advances to the next song when one ends.
 * Uses the Spotify Web Playback SDK (Premium required).
 */
export default function PlaylistPlayerBar({ songs }: { songs: ApiPlaylistSong[] }) {
  const { ready, deviceId, error, position, duration, paused, playUri, togglePlay, seek } = usePlaybackSdk();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  const wasPausedRef = useRef(true);
  const lastPlayStartedAtRef = useRef(0);
  const songsRef = useRef(songs);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  async function playAtIndex(idx: number) {
    const list = songsRef.current;
    if (idx < 0 || idx >= list.length || !deviceId) return;
    await playUri(list[idx].spotifyUri);
    setCurrentIndex(idx);
    hasStartedRef.current = true;
    setHasStarted(true);
    lastPlayStartedAtRef.current = Date.now();
  }

  // Auto-advance: was playing → now paused at position 0 = track ended. The 3s
  // guard avoids false-positives when a play call fails to actually start
  // (device errors etc.), which otherwise fires an instant paused-at-0 event.
  useEffect(() => {
    const wasPaused = wasPausedRef.current;
    wasPausedRef.current = paused;
    const playedLongEnough = Date.now() - lastPlayStartedAtRef.current > 3000;
    if (paused && position === 0 && !wasPaused && hasStartedRef.current && playedLongEnough) {
      const next = currentIndexRef.current + 1;
      if (next < songsRef.current.length) {
        playAtIndex(next);
      } else {
        hasStartedRef.current = false;
        setHasStarted(false);
        setCurrentIndex(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, position]);

  async function handlePlayPause() {
    if (!hasStartedRef.current) await playAtIndex(currentIndex);
    else await togglePlay();
  }

  async function handleNext() {
    await playAtIndex(currentIndex + 1);
  }

  async function handlePrev() {
    if (position > 3000) {
      seek(0);
      return;
    }
    const prev = currentIndex - 1;
    if (prev >= 0) await playAtIndex(prev);
    else seek(0);
  }

  if (songs.length === 0) return null;

  const currentSong = songs[currentIndex];
  const notes = currentSong.notes;
  const effectiveDuration = duration || currentSong.durationMs;
  const activeNote = notes.find((n) => position >= n.startMs && position < n.endMs) ?? null;
  const nextNote = notes.find((n) => n.startMs > position) ?? null;
  const countdownMs = activeNote
    ? activeNote.endMs - position
    : nextNote
      ? nextNote.startMs - position
      : effectiveDuration - position;
  const countdownLabel = activeNote ? "" : nextNote ? "next note" : "song ends";

  const remainingInPlaylistMs =
    Math.max(0, effectiveDuration - position) +
    songs.slice(currentIndex + 1).reduce((sum, s) => sum + s.durationMs, 0);

  const isPaused = !hasStarted || paused;
  const isAtStart = currentIndex === 0 && !hasStarted;
  const isAtEnd = currentIndex >= songs.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-lg px-4 pb-3 pt-3">
        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}
        {!error && !ready && (
          <p className="mb-2 text-center text-xs text-neutral-500">Connecting to Spotify playback…</p>
        )}
        {!error && ready && !deviceId && (
          <p className="mb-2 text-center text-xs text-neutral-500">Waiting for the player to become ready…</p>
        )}

        <div className="mb-1">
          <p className="truncate font-medium">{currentSong.title}</p>
          <p className="truncate text-sm text-neutral-400">{currentSong.artist}</p>
        </div>

        <Scrubber
          position={position}
          duration={effectiveDuration}
          disabled={!deviceId}
          onSeek={seek}
          segments={notes}
        />

        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
          <span className="font-mono text-xl">
            {formatDuration(position)} / {formatDuration(effectiveDuration)}
          </span>
          <span className="font-mono text-xl">-{formatDuration(remainingInPlaylistMs)}
          </span>
        </div>

        {activeNote ? (
          <div className="flex items-center justify-between mb-3 rounded-lg border border-amber-600/50 bg-amber-950/30 px-4 py-3">
            <span className="truncate text-3xl font-bold text-amber-300">{activeNote.note || "Note"}</span>
            
            <span className="text-lg text-amber-500/80">
              {formatDuration(Math.max(0, countdownMs))} left · {countdownLabel}
            </span>
          </div>
        ) : (
          <p className="mb-3 text-center text-3xl text-neutral-500">
            {formatDuration(Math.max(0, countdownMs))} · {countdownLabel}
          </p>
        )}

        <div className="grid grid-cols-3 items-center">
          <div className="flex justify-center">
            <button
              onClick={handlePrev}
              disabled={isAtStart || !deviceId}
              aria-label="Previous"
              className="rounded-full px-4 py-2 text-2xl text-neutral-300 disabled:opacity-30"
            >
              ⏮
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handlePlayPause}
              disabled={!deviceId}
              aria-label={isPaused ? "Play playlist" : "Pause"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-black disabled:opacity-40"
            >
              {isPaused ? "▶" : "⏸"}
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleNext}
              disabled={isAtEnd || !deviceId}
              aria-label="Next"
              className="rounded-full px-4 py-2 text-2xl text-neutral-300 disabled:opacity-30"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
