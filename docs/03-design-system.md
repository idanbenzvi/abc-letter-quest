# Design system

Source of truth is the design canvas
(https://claude.ai/code/artifact/d5c4e13c-fe51-4028-b2f2-98eb05fe23dc);
this doc is the written-down version of the same tokens so the
implementation doesn't drift, plus the rules that weren't obvious just
from looking at the mockups.

## Palette

Same tokens used in both the canvas and `app/src/theme.css` (as CSS
`oklch()` values — modern evergreen browsers support this natively;
there is a hex fallback table in `assets/STYLE_GUIDE.md` for anywhere
that needs a flat hex, e.g. AI art prompts).

| Token | oklch | Role |
|---|---|---|
| `--bg` | `oklch(96% 0.025 75)` | page background, warm cream |
| `--surface` | `oklch(99% 0.008 75)` | cards |
| `--surface-2` | `oklch(94% 0.02 80)` | inputs, inactive chips |
| `--ink` | `oklch(32% 0.045 50)` | primary text (warm charcoal, never pure black) |
| `--ink-soft` | `oklch(52% 0.035 55)` | secondary text |
| `--coral` / `--coral-dark` | `oklch(70% 0.19 35)` / `oklch(58% 0.18 32)` | primary accent, Buddy, CTAs |
| `--leaf` / `--leaf-dark` | `oklch(66% 0.15 148)` / `oklch(50% 0.13 148)` | mastery / success / growth |
| `--sky` / `--sky-dark` | `oklch(75% 0.1 232)` / `oklch(56% 0.1 232)` | calm UI, audio affordances |
| `--sun` / `--sun-dark` | `oklch(83% 0.15 88)` / `oklch(64% 0.14 75)` | stars, badges, highlights |
| `--berry` | `oklch(64% 0.17 350)` | occasional 4th accent (avatar options etc.) |

All accents share roughly the same chroma/lightness band and only vary
hue — that's deliberate, keeps the palette feeling like one family
instead of clashing brights.

## Typography

- **Display / headers:** "Baloo 2" (rounded, friendly, bold) — used for
  screen titles, the giant instructional letter's *label*, big
  celebratory text.
- **Body / UI:** "Nunito" — everything else: labels, buttons, lists.
- **The giant instructional letter itself is NOT set in Baloo 2.** It
  uses a plain bold rounded sans (Nunito ExtraBold) because Baloo 2's
  playful terminals distort the actual letterform a child is learning
  to recognize — legibility of the target letterform outranks brand
  personality there. This is a deliberate exception, don't "fix" it by
  making it consistent with headers.

## Iconography

Everything is inline SVG, flat/geometric, 2-4 shapes per icon. No emoji,
no icon fonts — established for consistency with the design skill's
content rules and because emoji render inconsistently across platforms
(a real risk for a cross-platform web app on assorted tablets).

## Name and title art: ABCtross

The game is **ABCtross** — ABC + albatross. Generated title art lives in
`app/public/art/`: `abctross-key-art.jpg` (the pilot albatross carrying
letters over a sunny beach, with the wordmark and "Learning adventure"
baked in — the intro screen's hero) and `abctross-wordmark.png` (the
wordmark alone with real alpha, cut out of the generated "transparent"
JPEG in the polish pass — used on onboarding, the player picker and the
loading veil via `components/Brand.tsx`). The app icons are a crop of
the bird's head from the key art. The palette of the art (sunny
yellows, coral red, sky blue, leaf green, sand) is a close match to the
design tokens, which is why it sits comfortably next to the UI.

## Hero: the albatross (Buddy the fox retired from the app)

The flight game's albatross is the character a child actually meets
now — the generated key art on the intro, the app icon, the loading veil. The
five pickable avatars (`components/icons/AvatarIcon.tsx`) are simple
animal faces, each in its own palette accent. Buddy's model sheet below
is kept for the AI-art pipeline and the retired World Map screens; he
no longer appears in the shipped flow, so a child isn't introduced to
one mascot and then handed a different one.

## Mascot: Buddy the fox (legacy)

Full character model sheet lives in `assets/STYLE_GUIDE.md` (needed
there for AI-art prompting). Summary: coral-orange "kawaii"-proportioned
fox, cream muzzle/belly/tail-tip, warm dark eyes, no visible teeth. He is
not generically cheerful — he's specifically delighted/curious because
he's recovering something he lost (see [01-vision.md](./01-vision.md)).

## Zones & companions

Each of the four story zones (`app/src/data/zones.ts`,
[04-screens-spec.md](./04-screens-spec.md#2-world-map)) claims one of
the palette's accent hues as its identity — leaf/Whisper Woods,
sun/Sunny Meadow, sky/Sparkle Shore, berry/Starlight Peak — used as
that zone's map-band background (`accentWash`) and its companion's
"unlocked" ring color. This is why there are exactly four zones and not
five or six: it maps onto the accent palette that already existed
rather than inventing new colors for it.

Companions are simpler than Buddy (`components/icons/CompanionIcon.tsx`)
— same flat-vector kawaii construction, but each reads as one clear
silhouette at a glance (a bunny's ears, a bee's stripes, an otter's
tail, a firefly's glow) since they're shown small in the crew row most
of the time, only going big in the Chapter Complete reveal. A locked
companion is a flat grey silhouette with two pale dot-eyes — deliberately
still shaped like *something*, not a blank circle, so "???" reads as
"a friend waiting to be found," consistent with the mystery-sparkle
treatment on locked letters, not as an empty/broken slot.

## Interaction/tone rules carried from the mockups

- **"Locked ahead" letters use a dashed mystery-sparkle icon, not a
  padlock.** A padlock reads as *forbidden*; the sparkle reads as *not
  yet discovered*. This is load-bearing for the whole "revelation" hook
  — don't reintroduce lock iconography.
- **No red/error states.** Wrong answers get corrective nudges styled
  the same warm palette as everything else, never a harsh red.
- Minimum tap target 44px (kid fingers on a tablet, not a mouse cursor).
- Session UI never shows raw numbers as the primary feedback (no
  "3/10 correct" during play) — mastery is shown as color/glow/stars,
  raw numbers are reserved for the parent-facing dashboard.

## Components carried into the real app

Pill buttons, big rounded cards (24-32px radius), warm-tinted soft
shadows (never pure grey/black shadows), circular "stepping stone"
letter tiles, circular progress rings for tracing-quality feedback. See
the individual `.dc.html` files under `design/` for exact markup/CSS if
a component needs to be reproduced pixel-for-pixel.
