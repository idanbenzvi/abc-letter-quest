#!/usr/bin/env node
// Generates ABC Letter Quest art assets from manifest.json via the Gemini API
// (Nano Banana Pro / gemini-3-pro-image-preview for character-consistent mascot
// poses, gemini-3.1-flash-image for cheaper single-object word icons).
//
// Usage:
//   node generate.mjs --dry-run              # print composed prompts, no API calls, no key needed
//   node generate.mjs                        # generate everything in manifest.json
//   node generate.mjs --only=buddy-cheering   # generate one asset by id
//   node generate.mjs --only=mascot           # generate everything in one category
//
// Requires (for a real run): `npm install` in this directory, and a
// GEMINI_API_KEY in assets/.env (copy .env.example). Get a key at
// https://aistudio.google.com/apikey — double check current model ids and
// pricing there before a large run; both model names below are current as
// of Sep 2026 but this space moves fast.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'generated');

const MODELS = {
  pro: 'gemini-3-pro-image-preview',   // Nano Banana Pro — best character consistency
  flash: 'gemini-3.1-flash-image',     // Nano Banana 2 — cheaper, good for simple icons
};

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

function extractSection(markdown, heading) {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) return '';
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith('## '));
  const body = endIdx === -1 ? rest : rest.slice(0, endIdx);
  return body
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
    .trim();
}

function composePrompt(styleGuide, asset) {
  const universal = extractSection(styleGuide, '## Universal style (goes into every prompt)');
  const negatives = extractSection(styleGuide, '## Negative / avoid list');
  return [universal, asset.prompt, negatives ? `Avoid: ${negatives.replace(/\n/g, ' ')}` : null]
    .filter(Boolean)
    .join('\n\n');
}

function parseArgs(argv) {
  const args = { dryRun: false, only: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--only=')) args.only = a.slice('--only='.length);
  }
  return args;
}

function matchesFilter(asset, only) {
  if (!only) return true;
  return asset.id === only || asset.category === only;
}

async function main() {
  loadEnvFile(join(HERE, '.env'));
  const { dryRun, only } = parseArgs(process.argv.slice(2));

  const styleGuide = readFileSync(join(HERE, 'STYLE_GUIDE.md'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
  const assets = manifest.assets.filter((a) => matchesFilter(a, only));

  if (assets.length === 0) {
    console.error(`No assets matched --only=${only}`);
    process.exit(1);
  }

  if (!dryRun) {
    if (!process.env.GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in, or run with --dry-run to preview prompts without a key.');
      process.exit(1);
    }
    mkdirSync(OUT_DIR, { recursive: true });
  }

  let GoogleGenAI, ai;
  if (!dryRun) {
    ({ GoogleGenAI } = await import('@google/genai'));
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  const results = { ok: [], failed: [] };

  for (const asset of assets) {
    const prompt = composePrompt(styleGuide, asset);

    if (dryRun) {
      console.log(`\n=== ${asset.id} (${asset.category}, tier: ${asset.tier}) ===`);
      console.log(`model: ${MODELS[asset.tier] ?? asset.tier}`);
      console.log(`aspectRatio: ${asset.aspectRatio ?? '1:1'}`);
      console.log(`reference: ${asset.usesReference ?? 'none'}`);
      console.log(prompt);
      continue;
    }

    try {
      const parts = [];
      if (asset.usesReference) {
        const refPath = manifest.referenceImages?.[asset.usesReference];
        const fullRefPath = refPath ? join(HERE, refPath) : null;
        if (fullRefPath && existsSync(fullRefPath)) {
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: readFileSync(fullRefPath).toString('base64'),
            },
          });
        } else {
          console.warn(`[${asset.id}] reference "${asset.usesReference}" not found on disk yet — generating without it. See README for the bootstrap step.`);
        }
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: MODELS[asset.tier] ?? asset.tier,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: asset.aspectRatio ?? '1:1', imageSize: '2K' },
        },
      });

      const responseParts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = responseParts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) {
        throw new Error('No image returned in response');
      }

      const ext = imagePart.inlineData.mimeType.split('/')[1] || 'png';
      const outPath = join(OUT_DIR, `${asset.id}.${ext}`);
      writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
      console.log(`[ok] ${asset.id} -> ${outPath}`);
      results.ok.push(asset.id);

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[fail] ${asset.id}: ${err.message}`);
      results.failed.push(asset.id);
    }
  }

  if (!dryRun) {
    console.log(`\nDone. ${results.ok.length} generated, ${results.failed.length} failed.`);
    if (results.failed.length) console.log('Failed:', results.failed.join(', '));
    if (results.ok.includes('buddy-standing-wave')) {
      console.log(`\nReminder: review generated/buddy-standing-wave.png — if it's good, copy it to reference/buddy-model-sheet.png so the rest of the mascot poses stay consistent, then re-run with --only=mascot.`);
    }
  }
}

main();
