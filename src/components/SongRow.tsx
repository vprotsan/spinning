"use client";

import { CueBadge } from "@/components/CueSelector";
import { formatDuration } from "@/lib/types";
import type { Cue } from "@/lib/cues";

export default function SongRow({
  title,
  artist,
  durationMs,
  cue,
  noteCount,
  onClick,
  trailing,
  albumImageUrl,
  isPlaying,
  onTogglePreview,
}: {
  title: string;
  artist: string;
  durationMs: number;
  cue?: Cue | null;
  noteCount?: number;
  onClick?: () => void;
  trailing?: React.ReactNode;
  albumImageUrl?: string | null;
  isPlaying?: boolean;
  onTogglePreview?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 ${
        onClick ? "active:bg-neutral-800 cursor-pointer" : ""
      }`}
    >
      {albumImageUrl !== undefined && (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
          {albumImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={albumImageUrl} alt="" className="h-full w-full object-cover" />
          )}
          {onTogglePreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview();
              }}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-neutral-400">{artist}</p>
        <div className="mt-1 flex items-center gap-2">
          {cue !== undefined && <CueBadge cue={cue} />}
          {!!noteCount && (
            <span className="text-[11px] text-neutral-500">
              {noteCount} note{noteCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 font-mono text-xs text-neutral-500">{formatDuration(durationMs)}</span>
      {trailing}
    </div>
  );
}
