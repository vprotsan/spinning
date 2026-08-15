"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/types";

export type ScrubberSegment = { startMs: number; endMs: number };

/** Draggable playback timeline — press and drag the handle to seek within the track. */
export default function Scrubber({
  position,
  duration,
  disabled,
  onSeek,
  onDrag,
  segments,
}: {
  position: number;
  duration: number;
  disabled?: boolean;
  onSeek: (positionMs: number) => void;
  /** Fires continuously while dragging, before the seek is committed on release. */
  onDrag?: (positionMs: number) => void;
  /** Optional note spans to highlight on the track (e.g. a playlist track's notes). */
  segments?: ScrubberSegment[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);

  const shownPosition = dragPosition ?? position;
  const pct = duration > 0 ? Math.min(1, Math.max(0, shownPosition / duration)) : 0;

  function positionFromEvent(e: React.PointerEvent): number {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.round(ratio * duration);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled || duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = positionFromEvent(e);
    setDragPosition(pos);
    onDrag?.(pos);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragPosition === null) return;
    const pos = positionFromEvent(e);
    setDragPosition(pos);
    onDrag?.(pos);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragPosition === null) return;
    onSeek(positionFromEvent(e));
    setDragPosition(null);
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragPosition(null)}
      className={`relative h-8 touch-none ${disabled ? "opacity-40" : "cursor-pointer"}`}
    >
      <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-neutral-800">
        {segments ? (
          <>
            {segments.map((seg, i) => (
              <div
                key={i}
                className="absolute h-full bg-amber-500"
                style={{
                  left: `${(seg.startMs / duration) * 100}%`,
                  width: `${((seg.endMs - seg.startMs) / duration) * 100}%`,
                }}
              />
            ))}
            {/* Dim everything right of the playhead so upcoming notes are still visible but muted. */}
            <div className="absolute right-0 top-0 h-full bg-black/55" style={{ left: `${pct * 100}%` }} />
          </>
        ) : (
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct * 100}%` }} />
        )}
      </div>
      <div
        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow"
        style={{ left: `${pct * 100}%` }}
      />
      {dragPosition !== null && (
        <span
          className="pointer-events-none absolute -top-8 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 font-mono text-xs text-white shadow"
          style={{ left: `${pct * 100}%` }}
        >
          {formatDuration(dragPosition)}
        </span>
      )}
    </div>
  );
}
