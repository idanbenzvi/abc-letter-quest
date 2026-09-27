<p align="center">
  <img src="app/public/art/abctross-key-art.jpg" alt="ABCtross: learning adventure" width="640" />
</p>

# ABCtross

An alphabet and early-reading game for young children, built around a
wandering albatross. The child flies over an open sea from morning into night, letters drift
by as clouds, and catching them (by tapping, tracing, typing, saying, or
spotting a picture) teaches each letter's shape, name and sound. Designed
for a 4–6 year old learning English as a second language, grounded in
early-literacy research (see [`docs/02-pedagogy.md`](docs/02-pedagogy.md)).

<table>
  <tr>
    <td width="50%"><img src="docs/images/flight.jpg" alt="The albatross flying toward a letter C cloud with three picture cards around it" /></td>
    <td width="50%"><img src="docs/images/rainbow.jpg" alt="A rainbow over the sea while the albatross skims the water throwing up spray" /></td>
  </tr>
  <tr>
    <td><b>Catch the letter.</b> Tap, trace, type or say it, or spot the picture that starts with it.</td>
    <td><b>Rainbow bonus.</b> Which colour is glowing? Get it right and the albatross dashes through the arch.</td>
  </tr>
  <tr>
    <td><img src="docs/images/storm.jpg" alt="Three picture cards in a rain storm: octopus, orange and mouse" /></td>
    <td><img src="docs/images/nest.jpg" alt="The My Nest screen: letter eggs in a woven nest, some hatched into chicks" /></td>
  </tr>
  <tr>
    <td><b>Storm round.</b> Which one starts with a different sound? Pick it and the rain stops.</td>
    <td><b>My Nest.</b> Every letter is an egg that hatches once it's learned.</td>
  </tr>
</table>

## How a letter is learned

```mermaid
flowchart LR
    A["☁️ Meet it<br/>a letter drifts by as a cloud"] --> B["👂 Hear it<br/>its name and its sound"]
    B --> C["✋ Catch it<br/>tap, trace, type, say or spot"]
    C --> D["🥚 Warm it<br/>met again, spaced out over days"]
    D --> E["🐣 Hatch it<br/>learned, and a chick in My Nest"]
    D -. "missed? it comes back sooner" .-> A
```

Letters come back on a spaced-repetition schedule: often while they're
new or shaky, less and less once they're known. The order and the teaching
choices follow early-literacy research: letter sounds before names,
pictures paired with words, and tracing to build letter shapes.

## What's in the game

- **Four ways to fly.** Classic, Endless, Sprint, and **My Name**, where
  the child flies the letters of their own name and hears it spelled at
  the end.
- **Letter sounds and names.** Every letter can be heard by its name
  ("bee"), its sound ("buh"), or both. Word rounds blend sounds into words.
- **Bonus rounds that teach reading:**
  - hear-the-letter plane choice,
  - look-alike letters (b/d),
  - catch-the-letters word spelling,
  - the rainbow,
  - the storm's odd-one-out sounds,
  - **Storm Vowels** (C _ T: find the missing vowel).
- **Tracing and writing.** Stroke-by-stroke tracing on the letter clouds, a
  lined writing page, and an optional webcam check of letters written on
  real paper.
- **Grown-ups dashboard.** Progress per letter, flight length, letter-voice
  setting, focus letters to practise, and more, behind a press-and-hold
  button.

### My Nest

<p align="center">
  <img src="docs/images/nest-hatching.gif" alt="New letters hatching into chicks in the nest" width="640" />
</p>

The child's own progress report. Letters learned since the last visit hatch
in front of them, and the nest says what's new out loud. There's a star
jar, a flock of companions that grows as letters are learned, and a week
of suns. It only ever shows growth.

Everything runs locally in the browser. There's no account or server, and
progress is saved on the device.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/game-engine-dark.png" />
  <img src="docs/images/game-engine-light.png" alt="Diagram of the flight game engine: take off builds a letter queue; each letter goes through presentItem, which may first run a bonus round, then becomes a letter cloud; the answer is scored, fed to the Leitner scheduler and saved, and the flight advances to the next letter or lands." />
</picture>

- **One letter at a time.** Take off builds a short queue of letters from
  the child's current pool. Each letter goes through a single function,
  `presentItem`, which decides whether a bonus round plays first. The
  letter's own cloud always follows, so no letter is ever skipped.
- **Catching and scoring.** A cloud can be caught five ways (tap, trace,
  type, say, or spot the picture). The answer earns stars and streaks, and
  every third traced letter opens a lined writing page.
- **Remembering.** Every right or wrong answer moves the letter between
  Leitner boxes 0 to 4, saved in the browser. That decides how soon each
  letter comes back, and which letters the next flight is built from.
- **The world.** The sea and sky are a single raymarched shader, and the
  albatross, clouds and cards are three.js objects (via React Three Fiber)
  drawn over it. The rainbow and the storm are drawn inside the shader, so
  they reflect in the water.

For an interactive version with guided walkthroughs, download
[`docs/diagrams/game-engine.html`](docs/diagrams/game-engine.html) and open
it in a browser. The full design notes are in [`docs/`](docs/README.md).

## Running it

```bash
cd app
npm install
npm run dev      # HTTPS dev server (camera and microphone features need HTTPS)
npm run build    # type-check and production build
npm run lint
```

[`docs/10-flight-game.md`](docs/10-flight-game.md) is the detailed log of
how the flight game works and why.

## License

**Copyright © 2026 Idan Ben-Zvi. All rights reserved.**

This is proprietary software. No one may use, copy, modify, distribute, or
create derivative works of this game or any part of it without my prior
written permission. The code being publicly visible does not grant any
rights to it. See [`LICENSE`](LICENSE) for the full terms. To ask for
permission, contact me through [my GitHub profile](https://github.com/idanbenzvi).

## Third-party notices

These parts belong to others and remain under their own licenses. The
proprietary license above does not apply to them:

- **Albatross photograph** (`app/public/art/albatross-photo.jpg`):
  [JJ Harrison](https://commons.wikimedia.org/wiki/File:Diomedea_exulans_-_SE_Tasmania.jpg),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Fonts:** Baloo 2 and Nunito, loaded from Google Fonts under the
  [SIL Open Font License](https://openfontlicense.org).
- **Open-source libraries** installed through npm (React, three.js, React
  Three Fiber, drei, TensorFlow.js and others), each under its own license
  as listed in its package.
