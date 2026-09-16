# ABCtross — Vision

## One-liner

A tablet-friendly web game that helps a 6-year-old English-as-a-second-
language learner recognize the alphabet and connect each letter to the
sound it makes at the start of a word — by *discovering* shapes for
sounds she already knows how to make, not by being taught something new.

## Who it's for

One named player, "Mia": 6 years old, learning English as a second
language, already has full spoken-language phonological awareness (she
can produce and hear all these sounds) but is at the very start of
mapping sounds to written letterforms. The onboarding screen captures
name, age, avatar, and a self-reported reading level (just starting out /
know some letters / already read fluently in another language) so the
game can pace itself — see [04-screens-spec.md](./04-screens-spec.md).

## The hook: discovery, not instruction

The design deliberately avoids "here is a new thing to learn" framing.
The premise: **Buddy the fox lost his Letter-Song**, and the player
already knows every sound in it from talking — what's missing is each
sound's secret written shape. Every letter-learning beat leads with
"listen — you already know this sound" *before* revealing the grapheme,
and mastering a letter is framed as Buddy getting a piece of his song
back, not as a task completed. See [03-design-system.md](./03-design-system.md)
for how this plays out visually and
[02-pedagogy.md](./02-pedagogy.md) for why leading with the known sound
is the pedagogically correct order, not just a nicer story.

## Explicit non-goals (for now)

- Not a full early-literacy curriculum (no sentence reading, no
  blending multi-letter words) — scope is letter recognition + initial
  phoneme + a starter vocabulary word per letter.
- Not multiplayer or social — single local player profile.
- Not cloud-backed — no accounts, no server, nothing leaves the device.
  See the privacy stance in [07-architecture.md](./07-architecture.md).
- Not testing typing/keyboard skills — input is tap/select (recognition)
  and, in Phase 2, finger/stylus tracing.

## Project layout

```
abc-letter-quest/
  design/   Design Components mockup canvas (the visual pitch)
  assets/   AI asset-generation pipeline (Gemini/Nano Banana) — not yet run
  docs/     this folder
  app/      the actual Vite + React + TypeScript implementation
```

Design canvas (source of visual truth):
https://claude.ai/code/artifact/d5c4e13c-fe51-4028-b2f2-98eb05fe23dc
