# Recorded letter audio

Drop one MP3 per letter here, named by its **uppercase canonical
letter**, e.g.:

```
public/audio/letters/A.mp3
public/audio/letters/B.mp3
...
public/audio/letters/Z.mp3
```

That's it — no code changes, no manifest to update. `engine/audio.ts`
tries `/audio/letters/<LETTER>.mp3` first for every letter it speaks;
if the file exists, it plays that. If it 404s, it silently falls back
to the browser's built-in speech synthesis, same as today. You can add
letters incrementally, in any order — a half-finished set works fine,
every letter just independently uses whichever source is available for
it.

## What to record

Just the **letter name** spoken clearly and warmly, e.g. "Ay" for A,
"Bee" for B — the same thing `speak()` is currently asked to say. No
need to record the lowercase/uppercase distinction separately; the
audio is about the letter's *name*, not its visual case, so `A.mp3`
covers both "A" and "a" prompts.

## Recording with ElevenLabs (or any TTS tool)

1. Pick a warm, clear voice from ElevenLabs' voice library (their free
   tier has a monthly character quota, which comfortably covers 26
   short clips).
2. Generate one clip per letter with that same voice, so the whole
   alphabet sounds consistent.
3. Export/download each as MP3, rename to the letter (`A.mp3`, `B.mp3`,
   ...), and drop them in this folder.
4. Reload the app — no build step needed, these are static files.

## Format notes

- MP3 is the safest cross-browser format; that's what `engine/audio.ts`
  requests. If you'd rather use `.ogg` or `.wav`, tell me and I'll
  adjust the extension it looks for (or make it try multiple).
- Keep clips short and normalized in volume relative to each other —
  a loud "A" next to a quiet "B" will be jarring letter-to-letter.
