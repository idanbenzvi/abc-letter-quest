# Flight-mission music (optional)

Drop your track in as:

```
public/audio/flight-theme.mp3
```

and it's picked up automatically — no code changes. `engine/flightMusic.ts`
plays it, looping, at 50% volume, only while actively flying (from
"Take Off!" until the mission ends) — it fades out for the intro screen,
mission summary, and pause menu the same way the starting-menu theme
(`theme.mp3`, `engine/music.ts`) fades out the moment takeoff happens.

Until a file is dropped in here, the flight is simply silent apart from
the existing wind/sea ambient bed (`engine/sfx.ts`) — same "missing file
= silent fallback" shape as `public/audio/letters/` and
`public/models/letters/`.

Replacing `flight-theme.mp3` with a new file (same name) is all a
melody change ever needs.
