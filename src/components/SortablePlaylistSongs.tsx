"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CueBadge } from "@/components/CueSelector";
import { formatDuration } from "@/lib/types";
import type { ApiPlaylistSong } from "@/lib/types";

/**
 * Flat, user-ordered playlist song list (Section 7). Reorder works two ways
 * per Section 8: a drag handle, or the Up/Down buttons — either is
 * touch-reliable without fiddly desktop-style dragging.
 */
export default function SortablePlaylistSongs({
  songs,
  onReorder,
  onOpenSong,
  onRemove,
}: {
  songs: ApiPlaylistSong[];
  onReorder: (orderedSongIds: string[]) => void;
  onOpenSong: (song: ApiPlaylistSong) => void;
  onRemove: (songId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(songs, oldIndex, newIndex).map((s) => s.id));
  }

  function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= songs.length) return;
    onReorder(arrayMove(songs, index, newIndex).map((s) => s.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {songs.map((song, index) => (
            <SortableRow
              key={song.id}
              song={song}
              index={index}
              total={songs.length}
              onMove={move}
              onOpen={() => onOpenSong(song)}
              onRemove={() => onRemove(song.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  song,
  index,
  total,
  onMove,
  onOpen,
  onRemove,
}: {
  song: ApiPlaylistSong;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-2 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 touch-none px-2 py-4 text-neutral-500"
      >
        ⠿
      </button>

      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-neutral-400">{song.artist}</p>
        <div className="mt-1 flex items-center gap-2">
          <CueBadge cue={song.cue} />
          {song.notes.length > 0 && (
            <span className="text-[11px] text-neutral-500">
              {song.notes.length} note{song.notes.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <span className="shrink-0 font-mono text-xs text-neutral-500">{formatDuration(song.durationMs)}</span>

      <div className="flex shrink-0 flex-col">
        <button
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label="Move up"
          className="px-2 py-1 text-neutral-400 disabled:opacity-20"
        >
          ▲
        </button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label="Move down"
          className="px-2 py-1 text-neutral-400 disabled:opacity-20"
        >
          ▼
        </button>
      </div>

      <button onClick={onRemove} aria-label="Remove from playlist" className="shrink-0 px-2 py-4 text-neutral-500">
        ✕
      </button>
    </li>
  );
}
