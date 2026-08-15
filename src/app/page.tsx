import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/my-songs");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Cycling Playlist Designer</h1>
        <p className="max-w-sm text-neutral-400">
          Tag songs, mark the exact moments the action happens, and build your
          class playlists — synced with Spotify.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          Sign-in failed ({error}). Please try again.
        </p>
      )}

      <a
        href="/api/auth/login"
        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-black shadow-lg active:scale-95 transition"
      >
        Log in with Spotify
      </a>
      <p className="max-w-xs text-xs text-neutral-500">
        Requires a Spotify Premium account (needed for in-app playback and
        marking timestamps).
      </p>
    </div>
  );
}
