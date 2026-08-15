import type { Cue } from "@/lib/cues";

export type ApiNote = {
  id: string;
  songId: string;
  startMs: number;
  endMs: number;
  note: string | null;
  createdAt: string;
};

export type ApiSong = {
  id: string;
  userId: string;
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  durationMs: number;
  cue: Cue | null;
  bpm: number | null;
  inMySongs: boolean;
  notes: ApiNote[];
};

export type ApiPlaylistSong = ApiSong & { playlistSongId: string; position: number };

export type ApiPlaylistSummary = {
  id: string;
  name: string;
  spotifyPlaylistId: string | null;
  smoothTransitions: boolean;
  songCount: number;
  totalDurationMs: number;
};

export type ApiPlaylistDetail = {
  id: string;
  name: string;
  spotifyPlaylistId: string | null;
  smoothTransitions: boolean;
  totalDurationMs: number;
  songs: ApiPlaylistSong[];
};

export type SpotifyTrackResult = {
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  durationMs: number;
  albumImageUrl: string | null;
};

export type SpotifyPlaylistResult = {
  id: string;
  name: string;
  ownerName: string;
  trackCount: number;
  imageUrl: string | null;
  externalUrl: string | null;
};

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPlaylistDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
}
