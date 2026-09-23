# Handwriting-check letter classifier (optional)

Drop a trained TensorFlow.js model here and it's picked up automatically
— no code changes. Until you do, the "write it on paper" webcam bonus
(`components/HandwritingCheck.tsx`) still works, on the shape-match
comparison alone (`engine/handwritingMatch.ts`); a model just makes it
smarter.

```
public/models/letters/model.json          (+ its weight shard .bin file(s), alongside it)
public/models/letters/labels.json         (or metadata.json — see below)
```

`engine/handwritingModel.ts` fetches these. If the model or its labels
are missing (404) or fail to load, the classifier is silently skipped —
same "missing file = silent fallback" shape as `public/audio/letters/`.

## Why nothing ships here by default

This needs a model trained on handwritten letters (EMNIST-letters is the
standard dataset for exactly this). Every ready-made TensorFlow.js
version of one that turned up while building this had no license
permitting reuse — default copyright, no permission granted — so
copying one in wasn't an option. Training your own sidesteps that
entirely: it's yours.

## The easiest way to get one: Google's Teachable Machine

No ML experience needed, and it's free.

1. Go to https://teachablemachine.withgoogle.com/ → **Image Project** →
   **Standard image model**.
2. Create one class per letter you want covered (doesn't have to be all
   26 at once — start with a handful and expand later). Photograph or
   upload a few handwritten examples of each letter for its class —
   several examples per class, varied lighting/angle/pencil, the same
   kind of photo the webcam check itself will capture.
3. Train (a button click, runs in your browser).
4. **Export Model → TensorFlow.js → Download.**
5. The download gives you 3 files: `model.json`, a weight shard, and
   `metadata.json`. Drop **all three, unmodified**, directly in this
   folder. `metadata.json` already contains the class-name list in the
   right order — no manual editing or extraction needed; the app reads
   it directly if a plain `labels.json` isn't present.

## What the app expects from the model itself

- A Keras/`LayersModel`-format TensorFlow.js export (what Teachable
  Machine and `tf.js`'s own training APIs both produce) —
  `tf.loadLayersModel` is what loads it.
- Input size and color (grayscale vs RGB) don't need to match any
  particular convention — `handwritingModel.ts` reads the model's own
  declared input shape and resizes/converts the captured photo to match
  it automatically. (Worth knowing: Teachable Machine's image models are
  MobileNet-based and expect 224x224 RGB, quite different from the
  28x28-grayscale convention an EMNIST-trained model would use — this
  app handles either without any configuration.)
- Output: one probability per class (a softmax layer), index-matched to
  the labels.

## How it's used

A photo alone (no model) is scored purely by comparing its ink shape
against the target letter's own outline — generous on purpose, since
it's a "did they make a real attempt" check, not OCR. With a model
present, its prediction is a second, independent signal: either the
shape-match passing OR the model confidently naming the right letter is
enough to count it — the model makes genuine handwriting recognized more
often, it never makes an already-passing photo fail.
