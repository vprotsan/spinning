import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { refreshSpotifyToken } from "./auth";

const API_BASE = "https://api.spotify.com/v1";

/** Returns a valid access token for the user, refreshing it first if expired. */
export async function getValidAccessToken(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const expiresInMs = user.tokenExpiresAt.getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return user.accessToken;
  }

  const refreshed = await refreshSpotifyToken(user.refreshToken);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await db
    .update(users)
    .set({
      accessToken: refreshed.access_token,
      // Spotify doesn't always return a new refresh token — keep the old one if absent.
      refreshToken: refreshed.refresh_token ?? user.refreshToken,
      tokenExpiresAt,
    })
    .where(eq(users.id, userId));

  return refreshed.access_token;
}

async function spotifyFetch(userId: string, path: string, init?: RequestInit) {
  const accessToken = await getValidAccessToken(userId);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return res;
}

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album?: { name: string; images: { url: string }[] };
};

export type NormalizedTrack = {
  spotifyTrackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  durationMs: number;
  albumImageUrl: string | null;
};

function normalizeTrack(t: SpotifyTrack): NormalizedTrack {
  return {
    spotifyTrackId: t.id,
    spotifyUri: t.uri,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    durationMs: t.duration_ms,
    albumImageUrl: t.album?.images?.[t.album.images.length - 1]?.url ?? null,
  };
}

export async function searchTracks(userId: string, query: string) {
  // Strip characters that trigger Spotify's 400 "Invalid html" validation (can happen
  // with iOS autocomplete or smart-quote substitution).
  const q = query.replace(/[<>&"']/g, " ").replace(/\s+/g, " ").trim();
  // Omit `limit` — an explicit value (even a modest one) can trigger Spotify's
  // "Invalid limit" validation depending on the app/account; let Spotify use its own default.
  const params = new URLSearchParams({ q, type: "track" });
  const res = await spotifyFetch(userId, `/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.tracks?.items ?? []).map(normalizeTrack) as NormalizedTrack[];
}

export async function getSavedTracks(userId: string, offset = 0, limit = 30) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await spotifyFetch(userId, `/me/tracks?${params.toString()}`);
  if (!res.ok) throw new Error(`Spotify saved tracks failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    items: (data.items ?? []).map((i: { track: SpotifyTrack }) => normalizeTrack(i.track)) as NormalizedTrack[],
    total: data.total as number,
    next: data.next as string | null,
  };
}

/** Creates the Spotify playlist on first save, or replaces its tracks on re-save. */
export async function saveSpotifyPlaylist(
  userId: string,
  opts: { spotifyPlaylistId: string | null; name: string; trackUris: string[] }
): Promise<{ spotifyPlaylistId: string }> {
  let playlistId = opts.spotifyPlaylistId;

  if (!playlistId) {
    const createRes = await spotifyFetch(userId, `/users/${userId}/playlists`, {
      method: "POST",
      body: JSON.stringify({ name: opts.name, public: false }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create Spotify playlist: ${createRes.status} ${await createRes.text()}`);
    }
    const created = await createRes.json();
    playlistId = created.id;
  } else {
    const renameRes = await spotifyFetch(userId, `/playlists/${playlistId}`, {
      method: "PUT",
      body: JSON.stringify({ name: opts.name }),
    });
    if (!renameRes.ok) {
      throw new Error(`Failed to rename Spotify playlist: ${renameRes.status} ${await renameRes.text()}`);
    }
  }

  // Replace the full track list (handles reorders/removals cleanly). Spotify caps
  // this endpoint at 100 URIs per request, so chunk larger playlists.
  const chunks: string[][] = [];
  for (let i = 0; i < opts.trackUris.length; i += 100) {
    chunks.push(opts.trackUris.slice(i, i + 100));
  }

  const firstChunk = chunks.shift() ?? [];
  const replaceRes = await spotifyFetch(userId, `/playlists/${playlistId}/tracks`, {
    method: "PUT",
    body: JSON.stringify({ uris: firstChunk }),
  });
  if (!replaceRes.ok) {
    throw new Error(`Failed to save tracks to Spotify playlist: ${replaceRes.status} ${await replaceRes.text()}`);
  }

  for (const chunk of chunks) {
    const addRes = await spotifyFetch(userId, `/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
    if (!addRes.ok) {
      throw new Error(`Failed to append tracks to Spotify playlist: ${addRes.status} ${await addRes.text()}`);
    }
  }

  return { spotifyPlaylistId: playlistId! };
}
