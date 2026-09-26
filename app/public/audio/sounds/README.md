# Recorded letter-sound audio

One WAV per letter, named by its **uppercase letter**, holding the letter's
most common **sound** (/b/ as in *ball*), not its name ("bee"):

```
public/audio/sounds/A.wav   # short a, as in "apple"
public/audio/sounds/B.wav   # /b/
...
```

`engine/audio.ts`'s `speakLetterSound` tries `/audio/sounds/<LETTER>.wav`
first. If it's missing, it falls back to the browser's speech synthesis
reading the spelled approximation in `app/src/data/letterSounds.ts`
("buh", "mmmm"). Add clips one at a time; each letter independently uses
whichever source it has.

To generate them: `cd assets && node generate-audio.mjs --only=sounds`.
The free Gemini tier allows about 10 clips a day, and a rerun skips
clips that already exist.

**Listen to every generated clip.** The TTS model reads its input
verbatim, so an isolated sound is only ever an approximation. A clip
that comes out as a letter name, or with a heavy vowel ("fuh" for /f/),
should be deleted and regenerated or recorded by hand. A grown-up's own
voice saying the sounds works perfectly well.
