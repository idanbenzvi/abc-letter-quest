# ABC Letter Quest — Art Direction

Shared style brief for every AI-generated asset. `generate.mjs` prepends the
"Universal style" block to every prompt automatically — keep it in sync with
the design canvas (https://claude.ai/code/artifact/d5c4e13c-fe51-4028-b2f2-98eb05fe23dc)
if the palette or mascot ever changes there.

## Universal style (goes into every prompt)

> Flat-vector children's-app illustration style, similar to modern kids'
> educational apps. Bold clean shapes, soft rounded corners, minimal flat
> shading with one soft highlight, no painterly brushwork, no photorealism,
> no gradients except very subtle ones, no visible outline unless noted.
> Warm, joyful, high-contrast, uncluttered. Flat solid or very light
> background — no busy scenery unless the prompt says so. No text, letters,
> numbers, watermarks, or logos baked into the image. No scary or uncanny
> faces. Square 1:1 composition, subject centered with generous padding.

## Palette

Hex approximations of the design canvas's oklch tokens — close enough for
prompting; eyeball the actual generated output against the canvas rather
than treating these as exact.

| Role | Hex | Use |
|---|---|---|
| Coral (primary / Buddy's fur) | `#F26B4D` | Buddy, primary accents |
| Coral dark | `#D94E2F` | shadows/outlines on coral |
| Leaf green | `#45A578` | mastery, growth, meadow |
| Leaf dark | `#2E7D57` | — |
| Sky blue | `#6FB8DE` | calm UI, water, sky |
| Sky dark | `#2E7FA8` | — |
| Sun gold | `#F5C453` | stars, badges, highlights |
| Sun dark | `#C98A2E` | — |
| Cream background | `#FCF6EE` | page/scene background |
| Warm ink (near-black) | `#4A382D` | eyes, linework, text-in-mockups |

## Buddy the fox — character model sheet

**Species / build:** young red fox, upright "kawaii" proportions — big
round head (~55% of total height), small rounded body, short stubby limbs,
simple mitten-like paws (no individual fingers), bushy tail with a
cream-colored tip, two rounded-triangle ears with cream inner-ear patches.

**Coloring:** coral-orange fur (`#F26B4D`), cream/ivory muzzle, belly,
inner ears, and tail tip (`#FCF6EE`), warm dark-brown eyes and nose
(`#4A382D`), soft pink cheek blush.

**Face:** two simple round dot eyes with a small white catchlight, small
oval nose, no visible teeth in a smile, expressive eyebrows/eye-shape do
the emoting rather than mouth detail.

**Personality:** warm, encouraging, a little mischievous, never mocking.
He is looking for his lost "Letter-Song" and lights up a little more with
every letter the player discovers — poses should read as genuinely curious
and delighted, not generic mascot-cheerful.

**Poses needed (see manifest):** standing/waving, cheering with both arms
up, mid-air jump, curious head-tilt, sleepy/yawning, pointing at something
off to one side.

**Consistency method:** generate `buddy-standing-wave` first with no
reference image. Once you approve it, save it as
`reference/buddy-model-sheet.png` — every other mascot prompt in the
manifest passes it back in as a reference image so the fox stays the same
character across poses.

## Word illustrations

One clear, iconic, instantly-recognizable object or animal per word —
this is a phonics aid for a 6-year-old, not decorative art. Favor the
single most stereotypical rendering of the word (a red apple, not an
unusual variety; a friendly cartoon dog, not a specific breed study).
Same flat-vector style and palette family as Buddy, but these do **not**
need to look like Buddy or share his species — only the illustration
style should match. Plain cream (`#FCF6EE`) or single flat color
background, no scene/environment unless the word requires one.

## Negative / avoid list

No photorealism, no 3D-render look, no painterly/watercolor texture, no
muted or dark palettes, no clutter or busy backgrounds, no extra
characters unless the prompt asks for one, no text or letterforms baked
into the pixels (the app overlays real text separately), no violence or
scary imagery, no brand logos.
