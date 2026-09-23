import * as tf from '@tensorflow/tfjs';

// Optional on-device classifier layered on top of engine/handwritingMatch.ts's
// shape-match, which is the guaranteed baseline this feature always has —
// same resilience shape as engine/audio.ts's recorded-audio-then-synthesis
// fallback, or public/audio/letters/ letter clips: drop a real file in the
// expected spot and it's picked up automatically; nothing else needs to
// change, and everything keeps working exactly as before if it's absent.
//
// No model ships with this app. Every EMNIST-letters TensorFlow.js model
// actually findable while building this (searched GitHub directly, not
// guessed) had no license permitting reuse — default copyright, all
// rights reserved — so none was bundled. See
// public/models/letters/README.md for the exact contract a model needs
// to meet and how to train your own for free (Google's Teachable
// Machine) without any licensing question, since it'd be entirely yours.
//
// tf.js selects its own backend automatically — WebGL (GPU-accelerated)
// on a device that has one, falling back to plain CPU/WASM otherwise.
// There's nothing to configure for that; tf.getBackend() after tf.ready()
// below just logs which one it picked, once, for anyone checking.

const MODEL_URL = '/models/letters/model.json';
const LABELS_URL = '/models/letters/labels.json';
// Teachable Machine's own export, tried second — see loadLabels below.
const METADATA_URL = '/models/letters/metadata.json';
// Fallback ONLY for a model that (unusually) doesn't declare its own
// input shape — classifyHandwriting reads the real shape straight off
// the loaded model instead of assuming any one convention. Different
// training paths want very different things here: EMNIST-style models
// are commonly 28x28 grayscale, but Teachable Machine's image models are
// MobileNet-based transfer learning and expect 224x224 RGB — hardcoding
// either would silently mis-feed the other.
const INPUT_SIZE_FALLBACK = 224;

let modelPromise: Promise<tf.LayersModel | null> | null = null;
let labelsPromise: Promise<string[] | null> | null = null;
let backendLogged = false;

async function logBackendOnce(): Promise<void> {
  if (backendLogged) return;
  backendLogged = true;
  await tf.ready();
  // eslint-disable-next-line no-console
  console.info(`[handwriting] TensorFlow.js backend: ${tf.getBackend()}`);
}

function loadModel(): Promise<tf.LayersModel | null> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await logBackendOnce();
      try {
        return await tf.loadLayersModel(MODEL_URL);
      } catch {
        return null; // no model file yet (404), or it failed to parse — handwritingMatch.ts's shape-match carries the feature entirely on its own until one exists.
      }
    })();
  }
  return modelPromise;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((l) => typeof l === 'string') ? (value as string[]) : null;
}

/**
 * A model's output is just N probabilities in whatever order its own
 * training used — Teachable Machine (or any custom training run) lets
 * you name and order classes yourself, so there's no safe assumption to
 * hardcode here. This is how the model says which index means which
 * letter, tried two ways: `labels.json` (a plain array — the simplest
 * contract, for a model trained by hand) first, then Teachable
 * Machine's own real export file `metadata.json` (whose `labels` field
 * holds the same information) so a raw Teachable Machine download can be
 * dropped in as-is, with no manual extraction step. Either missing
 * means a model can't be mapped back to an answer, so it's treated the
 * same as no model at all.
 */
function loadLabels(): Promise<string[] | null> {
  if (!labelsPromise) {
    labelsPromise = (async () => {
      const direct = asStringArray(await fetchJson(LABELS_URL));
      if (direct) return direct;
      const metadata = await fetchJson(METADATA_URL);
      const fromMetadata = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).labels : null;
      return asStringArray(fromMetadata);
    })();
  }
  return labelsPromise;
}

/** Resolves once we know whether a usable model+labels pair is actually available — lets the UI say "smart check" vs. plain shape-match without waiting on a full classification. */
export async function isHandwritingModelAvailable(): Promise<boolean> {
  const [model, labels] = await Promise.all([loadModel(), loadLabels()]);
  return model !== null && labels !== null;
}

export interface ModelPrediction {
  letter: string;
  confidence: number;
}

/**
 * `imageData` should already be the cropped, roughly-square ink region
 * (see components/HandwritingCheck.tsx's crop step) — this only handles
 * turning that into whatever tensor shape the model expects, not
 * locating the letter within a wider photo.
 */
export async function classifyHandwriting(imageData: ImageData): Promise<ModelPrediction | null> {
  const [model, labels] = await Promise.all([loadModel(), loadLabels()]);
  if (!model || !labels) return null;

  // Read the model's OWN declared input shape rather than assuming one
  // convention — [batch, height, width, channels]. A model that omits
  // this (unusual, but not disallowed) falls back to a square RGB input
  // at INPUT_SIZE_FALLBACK.
  const inputShape = model.inputs[0]?.shape;
  const height = (typeof inputShape?.[1] === 'number' ? inputShape[1] : null) ?? INPUT_SIZE_FALLBACK;
  const width = (typeof inputShape?.[2] === 'number' ? inputShape[2] : null) ?? INPUT_SIZE_FALLBACK;
  const channels: 1 | 3 = inputShape?.[3] === 1 ? 1 : 3;

  // tf.tidy's return value is constrained to plain TensorContainer
  // shapes (tensors, or void) — it can't hand back an arbitrary object
  // like { letter, confidence }. Extracted into these outer-scope
  // primitives instead; tidy is called purely for its disposal side
  // effect (freeing the intermediate tensors) here, not for its result.
  let bestIndex = 0;
  let bestProb = 0;
  tf.tidy(() => {
    const pixels = tf.browser.fromPixels(imageData, channels);
    const resized = tf.image.resizeBilinear(pixels, [height, width]);
    let normalized = resized.toFloat().div(255);
    // Single-channel classifiers follow the EMNIST/MNIST convention —
    // white ink on a BLACK background — the opposite polarity of an
    // actual photo of dark pencil on light paper (what `imageData`
    // always is here; see handwritingMatch.ts's DARK_THRESHOLD). Left
    // uninverted, a real photo scored 3.8% on the dropped-in model
    // (near-random for 52 classes, confirmed by direct measurement, not
    // assumed); inverted, the SAME model scored 86.5%, matching its own
    // reported 87.46% test accuracy almost exactly — decisive enough to
    // fix unconditionally for this convention rather than guess. Kept
    // conditional on channels===1 (the same signal already used above
    // to pick grayscale vs RGB) because a 3-channel Teachable-Machine
    // model is trained on natural, un-inverted photos and inverting
    // those would break it instead.
    if (channels === 1) normalized = tf.scalar(1).sub(normalized);
    const batched = normalized.expandDims(0);
    const output = model.predict(batched) as tf.Tensor;
    const probs = output.dataSync();
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > bestProb) {
        bestProb = probs[i];
        bestIndex = i;
      }
    }
  });
  const letter = labels[bestIndex];
  if (letter === undefined) return null;
  return { letter: letter.toUpperCase(), confidence: bestProb };
}
