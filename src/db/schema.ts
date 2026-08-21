import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

// The five fixed cue categories (v2 requirements Section 5). Optional on Song.
export const cueEnum = pgEnum("cue", [
  "Jumps",
  "Climbs",
  "Sprints",
  "Standing Choreo",
  "Flat",
  "Jog",
]);

// One row per Spotify account. Access/refresh tokens live server-side only.
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Spotify user id
  displayName: text("display_name"),
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A song enters My Songs (inMySongs = true) once it has a cue, a note, or is
// added to any playlist. Membership persists until explicit removal (Section 4).
export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spotifyTrackId: text("spotify_track_id").notNull(),
    spotifyUri: text("spotify_uri").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    durationMs: integer("duration_ms").notNull(),
    cue: cueEnum("cue"), // nullable — optional in v2
    bpm: integer("bpm"), // reserved, always null (v1 Section 6 / v2 Section 9.1)
    inMySongs: boolean("in_my_songs").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("songs_user_track_unique").on(t.userId, t.spotifyTrackId)]
);

// Time-stamped notes: a start/end span within a song, non-overlapping (Section 6).
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  songId: uuid("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  spotifyPlaylistId: text("spotify_playlist_id"), // set after first save
  smoothTransitions: boolean("smooth_transitions").notNull().default(false), // Section 10, off by default
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Ordered join table — a flat, user-ordered list of songs (Section 7). A song
// can be referenced by many playlists; position is independent per playlist.
export const playlistSongs = pgTable(
  "playlist_songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("playlist_songs_unique").on(t.playlistId, t.songId)]
);
