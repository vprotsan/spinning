"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Minimal shape of the bits of the Spotify Web Playback SDK we use.
type SpotifyPlayerState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      uri: string;
      name: string;
      // Set when Spotify relinked the requested track to a market-playable
      // equivalent with a different URI (uri/id are null otherwise).
      linked_from?: { uri: string | null; id: string | null };
    };
  };
};

/**
 * The URI the app asked to play. With track relinking, `current_track.uri` is
 * the substitute Spotify actually plays, so comparing it against the song's
 * stored URI fails for relinked tracks — the original lives in `linked_from`.
 */
function requestedTrackUri(state: SpotifyPlayerState): string {
  const track = state.track_window.current_track;
  return track.linked_from?.uri ?? track.uri;
}

type SpotifyPlayerInstance = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (arg: unknown) => void) => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  activateElement: () => Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadSdkScript(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  });
  return sdkLoadPromise;
}

async function fetchPlayerToken(): Promise<string> {
  const res = await fetch("/api/spotify/player-token");
  if (!res.ok) throw new Error("Could not get a Spotify playback token — Premium is required.");
  const data = await res.json();
  return data.accessToken;
}

/** "Could not start playback" plus Spotify's own reason, when it gives one. */
async function playbackError(res: Response): Promise<string> {
  let reason = "";
  try {
    const body = await res.json();
    reason = body?.error?.message ?? body?.error?.reason ?? "";
  } catch {}
  return `Could not start playback (Spotify ${res.status}${reason ? `: ${reason}` : ""})`;
}

async function transferPlayback(deviceId: string, token: string): Promise<void> {
  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

/**
 * Poll /me/player/devices until our device ID appears (max ~5s). Spotify's
 * REST API lags behind the SDK's own "ready" event by a few seconds, which
 * otherwise shows up as a spurious 404 on the first play call.
 */
async function waitForDevice(deviceId: string, token: string): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const { devices } = (await res.json()) as { devices: { id: string }[] };
    if (devices.some((d) => d.id === deviceId)) return true;
  }
  return false;
}

type PlaybackSdk = {
  ready: boolean;
  deviceId: string | null;
  error: string | null;
  position: number;
  duration: number;
  paused: boolean;
  currentTrackUri: string | null;
  playUri: (uri: string) => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
};

const PlaybackSdkContext = createContext<PlaybackSdk | null>(null);

/**
 * Connects a single, shared Spotify Web Playback SDK player (Premium
 * required — Section 3.2 / 5.2) for the whole app and exposes it via
 * context. Every consumer (playlist bar, search preview, note editor, …)
 * must share this one instance — Spotify only grants one device slot per
 * SDK connection, and two independent `Spotify.Player`s racing to connect()
 * in the same tab (e.g. the note editor opened on top of a page that's
 * already running the playlist player) fight over that slot and neither
 * reliably reaches "ready" with a device_id.
 */
export function PlaybackSdkProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    typeof window !== "undefined" && !window.isSecureContext
      ? "This page isn't loaded over HTTPS, so Spotify can't start playback here (this is required by every browser, iOS included — not something the app can override). If you're testing on your phone against a local dev server via its LAN IP, that's why nothing happens: deploy the app (e.g. to Vercel) or use an HTTPS tunnel and open that URL on your phone instead."
      : null
  );
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);

  // The URI we last asked to play, and the URI Spotify actually reported for
  // it. These can differ even without `linked_from` — e.g. Moby "Honey" exists
  // twice on the same album, and playing one ID reports the other. Without
  // this alias the requested song never looks loaded, so Pause re-plays it and
  // Mark Start/End stay disabled.
  const playRequestRef = useRef<{ requested: string; before: string | null; actual: string | null } | null>(null);
  const lastActualUriRef = useRef<string | null>(null);

  function resolveTrackUri(state: SpotifyPlayerState): string {
    const actual = requestedTrackUri(state);
    lastActualUriRef.current = actual;
    const req = playRequestRef.current;
    if (!req) return actual;
    // The first track that differs from what was playing before the request
    // is the one Spotify started for it (stale states may still report the
    // previous track for a moment right after the play call).
    if (req.actual === null && (actual === req.requested || actual !== req.before)) {
      req.actual = actual;
    }
    return actual === req.actual ? req.requested : actual;
  }

  useEffect(() => {
    let cancelled = false;

    // The SDK's DRM/EME handshake silently refuses to initialize outside a
    // secure context — it never fires "ready" and never surfaces an error, it
    // just hangs forever. Only literal https:// or http://localhost/127.0.0.1
    // count; a LAN IP like http://192.168.x.x:3000 (typical for testing a dev
    // server from a phone) does not, on any browser, iOS included. (Handled
    // via the error state's lazy initializer, above, to avoid a setState call
    // directly in the effect body.)
    if (!window.isSecureContext) return;

    loadSdkScript()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: "Cycling Playlist Designer",
          getOAuthToken: (cb) => fetchPlayerToken().then(cb).catch(() => setError("Failed to authorize playback")),
          volume: 1,
        });

        player.addListener("ready", (arg) => {
          const { device_id } = arg as { device_id: string };
          if (cancelled) return;
          setDeviceId(device_id);
          // Best-effort — proactively transferring reduces "device not found" 404s
          // on the first play call. playUri retries via transfer+wait anyway if this
          // hasn't landed on Spotify's backend yet.
          fetchPlayerToken()
            .then((token) => transferPlayback(device_id, token))
            .catch(() => {});
        });
        player.addListener("not_ready", () => {
          if (!cancelled) setDeviceId(null);
        });
        player.addListener("initialization_error", () => setError("Playback failed to initialize"));
        player.addListener("authentication_error", () => setError("Spotify authentication failed"));
        player.addListener("account_error", () => setError("A Spotify Premium account is required for playback"));
        player.addListener("player_state_changed", (arg) => {
          const state = arg as SpotifyPlayerState | null;
          if (!state || cancelled) return;
          setPosition(state.position);
          setDuration(state.duration);
          setPaused(state.paused);
          setCurrentTrackUri(resolveTrackUri(state));
        });

        player.connect().then((success: boolean) => {
          if (!cancelled) setReady(success);
        });
        playerRef.current = player;
      })
      .catch(() => setError("Failed to load the Spotify player"));

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
    };
  }, []);

  // If we connect but never get a device_id, the "Waiting for the player to
  // become ready…" message would otherwise hang forever with no explanation.
  useEffect(() => {
    if (!ready || deviceId || error) return;
    const timeout = setTimeout(() => {
      setError(
        "Spotify connected but never registered a playback device on this browser. Try reloading the page."
      );
    }, 12000);
    return () => clearTimeout(timeout);
  }, [ready, deviceId, error]);

  // Poll live state whenever we have a device — this both gives Mark
  // Start/End a live-ish position while playing (player_state_changed only
  // fires on transitions, not every tick) and, importantly, is the fallback
  // for when the SDK misses that first transition event entirely. That drop
  // happens often enough right after transferPlayback (called just before
  // every playUri) that relying on the event alone leaves currentTrackUri
  // stuck at null — and audibly-playing music with Mark Start/End stuck
  // disabled forever, since nothing would otherwise ever correct it.
  useEffect(() => {
    if (!deviceId) return;
    const interval = setInterval(() => {
      playerRef.current?.getCurrentState().then((state) => {
        if (!state) return;
        setPosition(state.position);
        setDuration(state.duration);
        setPaused(state.paused);
        setCurrentTrackUri(resolveTrackUri(state));
      });
    }, 250);
    return () => clearInterval(interval);
  }, [deviceId]);

  async function playUri(uri: string) {
    if (!deviceId) return;
    setError(null);
    const prev = playRequestRef.current;
    // Re-playing the same song keeps the alias we already learned for it.
    playRequestRef.current =
      prev?.requested === uri && prev.actual
        ? prev
        : { requested: uri, before: lastActualUriRef.current, actual: null };
    // Mobile Safari only allows the SDK to keep playing audio transferred from
    // Spotify's servers (i.e. our REST play call below) if activateElement()
    // was called synchronously within this same user-gesture call chain first.
    await playerRef.current?.activateElement().catch(() => {});
    const token = await fetchPlayerToken();
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (res.ok || res.status === 204) return;

    if (res.status === 404) {
      // Device not yet registered on Spotify's backend — re-transfer and retry once.
      await transferPlayback(deviceId, token);
      const found = await waitForDevice(deviceId, token);
      if (!found) {
        setError("Could not start playback (this browser's player never showed up in your Spotify devices)");
        return;
      }
      const retryRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri] }),
      });
      if (!retryRes.ok && retryRes.status !== 204) setError(await playbackError(retryRes));
      return;
    }

    setError(await playbackError(res));
  }

  async function togglePlay() {
    await playerRef.current?.togglePlay();
  }

  async function seek(positionMs: number) {
    await playerRef.current?.seek(positionMs);
    // Reflect immediately — player_state_changed can lag a moment behind a seek.
    setPosition(positionMs);
  }

  const value: PlaybackSdk = {
    ready,
    deviceId,
    error,
    position,
    duration,
    paused,
    currentTrackUri,
    playUri,
    togglePlay,
    seek,
  };

  return <PlaybackSdkContext.Provider value={value}>{children}</PlaybackSdkContext.Provider>;
}

export function usePlaybackSdk(): PlaybackSdk {
  const ctx = useContext(PlaybackSdkContext);
  if (!ctx) {
    throw new Error("usePlaybackSdk() must be used within a <PlaybackSdkProvider>");
  }
  return ctx;
}
