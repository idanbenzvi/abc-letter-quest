// English strokes are authored in app/scripts/generate-letter-strokes.mjs
// (which writes app/src/data/letterStrokes.ts). This adapter just reads
// that data so the English pack goes through the same pipeline as every
// other language. Don't author English strokes here.
export default async function englishStrokes(_kit, { loadTs }) {
  const { getLetterForm } = await loadTs('src/data/letterStrokes.ts');
  const forms = {};
  for (let i = 0; i < 26; i++) {
    const upper = String.fromCharCode(65 + i);
    forms[upper] = getLetterForm(upper, true).strokes;
    forms[upper.toLowerCase()] = getLetterForm(upper, false).strokes;
  }
  return forms;
}
