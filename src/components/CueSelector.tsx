"use client";

import { CUES, type Cue } from "@/lib/cues";

const CUE_COLORS: Record<Cue, string> = {
  Jumps: "bg-orange-500 border-orange-500",
  Climbs: "bg-rose-500 border-rose-500",
  Sprints: "bg-red-600 border-red-600",
  Choreo: "bg-purple-500 border-purple-500",
  Flat: "bg-sky-500 border-sky-500",
};

export function CueBadge({ cue }: { cue: Cue | null }) {
  if (!cue) {
    return (
      <span className="inline-block rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-500">
        Untagged
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium text-white ${CUE_COLORS[cue]}`}
    >
      {cue}
    </span>
  );
}

/**
 * Large tappable cue cards (Section 8) rather than a dropdown. Category is
 * optional (Section 5) — includes a "None" option to clear the tag.
 */
export default function CueSelector({
  value,
  onChange,
  disabled,
}: {
  value: Cue | null;
  onChange: (cue: Cue | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={`rounded-xl border py-3 text-sm font-medium transition ${
          value === null
            ? "border-neutral-400 bg-neutral-700 text-white"
            : "border-neutral-800 bg-neutral-900 text-neutral-400"
        }`}
      >
        None
      </button>
      {CUES.map((cue) => (
        <button
          key={cue}
          type="button"
          disabled={disabled}
          onClick={() => onChange(cue)}
          className={`rounded-xl border py-3 text-sm font-medium transition ${
            value === cue
              ? `${CUE_COLORS[cue]} text-white`
              : "border-neutral-800 bg-neutral-900 text-neutral-300"
          }`}
        >
          {cue}
        </button>
      ))}
    </div>
  );
}
