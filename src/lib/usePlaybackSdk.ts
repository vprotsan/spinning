"use client";

import { useEffect, useRef, useState } from "react";

// Minimal shape of the bits of the Spotify Web Playback SDK we use.
type SpotifyPlayerState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: { uri: string; name: string } };
};

type SpotifyPlayerInstance = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (arg: unknown) => void) => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
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

/**
 * Connects to the Spotify Web Playback SDK (Premium required — Section 3.2 /
 * 5.2) and exposes enough control to play a track and read the live playhead
 * for Mark Start / Mark End.
 */
export function usePlaybackSdk() {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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
          if (!cancelled) setDeviceId(device_id);
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
          setCurrentTrackUri(state.track_window.current_track.uri);
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

  // Poll position while playing so Mark Start/End reads a live-ish value
  // (player_state_changed only fires on transitions, not every tick).
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      playerRef.current?.getCurrentState().then((state) => {
        if (state) setPosition(state.position);
      });
    }, 250);
    return () => clearInterval(interval);
  }, [paused]);

  async function playUri(uri: string) {
    if (!deviceId) return;
    setError(null);
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${await fetchPlayerToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (!res.ok && res.status !== 204) setError("Could not start playback");
  }

  async function togglePlay() {
    await playerRef.current?.togglePlay();
  }

  async function seek(positionMs: number) {
    await playerRef.current?.seek(positionMs);
    // Reflect immediately — player_state_changed can lag a moment behind a seek.
    setPosition(positionMs);
  }

  return { ready, deviceId, error, position, duration, paused, currentTrackUri, playUri, togglePlay, seek };
}
