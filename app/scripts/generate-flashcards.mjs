// generate-flashcards.mjs
// Generates SVG flashcard image assets for each letter A-Z into public/art/flashcards/
// and outputs a data file with SVG markup for runtime use in React and Three.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public/art/flashcards');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 73 words spanning all 26 letters (at least 2-3 words per letter)
export const FLASHCARD_DEFS = [
  // A
  {
    id: 'apple',
    letter: 'A',
    word: 'Apple',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,32 C32,32 20,46 20,63 C20,80 34,90 50,90 C66,90 80,80 80,63 C80,46 68,32 50,32 Z" fill="#ff6f59"/>
      <ellipse cx="38" cy="54" rx="7" ry="10" fill="#ffffff" opacity="0.3"/>
      <rect x="47" y="16" width="6" height="18" rx="3" fill="#d49b20"/>
      <ellipse cx="62" cy="24" rx="11" ry="7" fill="#48b874" transform="rotate(-25 62 24)"/>
    </svg>`
  },
  {
    id: 'ant',
    letter: 'A',
    word: 'Ant',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="56" rx="9" ry="8" fill="#d94d38"/>
      <ellipse cx="48" cy="56" rx="7" ry="6" fill="#ff6f59"/>
      <ellipse cx="66" cy="54" rx="12" ry="10" fill="#d94d38"/>
      <circle cx="28" cy="54" r="2" fill="#332d29"/>
      <path d="M26,50 Q20,38 14,40 M29,49 Q27,36 24,35" stroke="#332d29" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M46,60 L40,78 M50,60 L52,78 M64,62 L74,78 M44,60 L36,76 M48,60 L48,78 M66,62 L78,76" stroke="#332d29" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'alligator',
    letter: 'A',
    word: 'Alligator',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,56 Q25,38 52,42 Q78,44 86,52 Q76,66 50,66 Q26,66 16,56 Z" fill="#48b874"/>
      <circle cx="34" cy="40" r="7" fill="#48b874"/>
      <circle cx="34" cy="40" r="4" fill="#ffffff"/>
      <circle cx="35" cy="40" r="2.5" fill="#332d29"/>
      <path d="M30,54 Q54,58 76,52" stroke="#2f8750" stroke-width="2.5" fill="none"/>
      <polygon points="40,54 44,59 48,54" fill="#ffffff"/>
      <polygon points="52,55 56,60 60,55" fill="#ffffff"/>
      <polygon points="64,54 68,58 72,53" fill="#ffffff"/>
      <circle cx="80" cy="50" r="2" fill="#2f8750"/>
    </svg>`
  },

  // B
  {
    id: 'ball',
    letter: 'B',
    word: 'Ball',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="35" fill="#ff6f59"/>
      <path d="M22,35 Q50,42 78,35 Q74,65 50,68 Q26,65 22,35 Z" fill="#68b5e8"/>
      <circle cx="50" cy="50" r="14" fill="#f7c948"/>
      <path d="M50,15 Q50,36 50,50 Q30,50 15,50" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.6"/>
    </svg>`
  },
  {
    id: 'banana',
    letter: 'B',
    word: 'Banana',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M24,70 Q42,84 68,68 Q84,52 82,24 Q72,44 56,58 Q38,70 24,70 Z" fill="#f7c948"/>
      <path d="M24,70 Q42,80 66,66 Q78,54 82,24" stroke="#d49b20" stroke-width="2" fill="none"/>
      <circle cx="82" cy="23" r="3.5" fill="#2f8750"/>
      <circle cx="23" cy="71" r="3" fill="#d49b20"/>
    </svg>`
  },
  {
    id: 'bear',
    letter: 'B',
    word: 'Bear',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="30" r="13" fill="#d49b20"/>
      <circle cx="28" cy="30" r="7" fill="#f7c948"/>
      <circle cx="72" cy="30" r="13" fill="#d49b20"/>
      <circle cx="72" cy="30" r="7" fill="#f7c948"/>
      <circle cx="50" cy="56" r="30" fill="#d49b20"/>
      <ellipse cx="50" cy="64" rx="16" ry="12" fill="#fffdfa"/>
      <ellipse cx="50" cy="59" rx="6" ry="4.5" fill="#332d29"/>
      <circle cx="39" cy="50" r="4" fill="#332d29"/>
      <circle cx="61" cy="50" r="4" fill="#332d29"/>
      <path d="M46,67 Q50,72 54,67" stroke="#332d29" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`
  },

  // C
  {
    id: 'cat',
    letter: 'C',
    word: 'Cat',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,38 16,14 38,30" fill="#c44569"/>
      <polygon points="76,38 84,14 62,30" fill="#c44569"/>
      <polygon points="24,36 19,19 35,30" fill="#f7c948"/>
      <polygon points="76,36 81,19 65,30" fill="#f7c948"/>
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#c44569"/>
      <ellipse cx="50" cy="66" rx="18" ry="14" fill="#fffdfa"/>
      <circle cx="41" cy="54" r="4.5" fill="#332d29"/>
      <circle cx="59" cy="54" r="4.5" fill="#332d29"/>
      <polygon points="47,63 53,63 50,67" fill="#ff6f59"/>
      <path d="M22,58 L34,60 M22,66 L34,64 M78,58 L66,60 M78,66 L66,64" stroke="#fffdfa" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'cake',
    letter: 'C',
    word: 'Cake',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="52" width="56" height="32" rx="4" fill="#f7c948"/>
      <rect x="20" y="48" width="60" height="12" rx="6" fill="#ff6f59"/>
      <path d="M20,54 Q28,64 35,54 Q43,64 50,54 Q57,64 65,54 Q72,64 80,54" fill="#ff6f59"/>
      <rect x="47" y="28" width="6" height="20" rx="2" fill="#68b5e8"/>
      <ellipse cx="50" cy="22" rx="4" ry="7" fill="#f7c948"/>
      <ellipse cx="50" cy="22" rx="2" ry="4" fill="#ff6f59"/>
    </svg>`
  },
  {
    id: 'car',
    letter: 'C',
    word: 'Car',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M18,64 Q18,52 28,52 L36,52 L44,34 Q48,30 56,30 L70,30 Q78,30 84,42 L88,52 Q92,54 92,64 L18,64 Z" fill="#ff6f59"/>
      <polygon points="46,36 68,36 68,48 40,48" fill="#68b5e8"/>
      <circle cx="34" cy="66" r="10" fill="#332d29"/>
      <circle cx="34" cy="66" r="4.5" fill="#f7c948"/>
      <circle cx="76" cy="66" r="10" fill="#332d29"/>
      <circle cx="76" cy="66" r="4.5" fill="#f7c948"/>
      <circle cx="90" cy="56" r="3.5" fill="#f7c948"/>
    </svg>`
  },

  // D
  {
    id: 'dog',
    letter: 'D',
    word: 'Dog',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="60" rx="34" ry="28" fill="#d49b20"/>
      <ellipse cx="22" cy="48" rx="8" ry="18" fill="#a47214" transform="rotate(-15 22 48)"/>
      <ellipse cx="78" cy="48" rx="8" ry="18" fill="#a47214" transform="rotate(15 78 48)"/>
      <ellipse cx="50" cy="68" rx="20" ry="15" fill="#fffdfa"/>
      <circle cx="40" cy="54" r="4.5" fill="#332d29"/>
      <circle cx="60" cy="54" r="4.5" fill="#332d29"/>
      <ellipse cx="50" cy="66" rx="7" ry="5" fill="#332d29"/>
      <path d="M44,73 Q50,78 56,73" stroke="#332d29" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'duck',
    letter: 'D',
    word: 'Duck',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="38" r="18" fill="#f7c948"/>
      <ellipse cx="52" cy="64" rx="28" ry="20" fill="#f7c948"/>
      <path d="M18,36 Q28,32 30,42 Q22,44 18,36 Z" fill="#ff6f59"/>
      <circle cx="36" cy="34" r="3.5" fill="#332d29"/>
      <circle cx="37" cy="33" r="1.2" fill="#ffffff"/>
      <path d="M46,60 Q58,54 64,68" stroke="#d49b20" stroke-width="3" fill="none"/>
    </svg>`
  },
  {
    id: 'drum',
    letter: 'D',
    word: 'Drum',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="36" rx="32" ry="12" fill="#fffdfa" stroke="#d49b20" stroke-width="3"/>
      <path d="M18,36 L18,66 Q50,78 82,66 L82,36 Z" fill="#ff6f59"/>
      <path d="M18,36 L40,68 L50,36 L62,68 L82,36" stroke="#f7c948" stroke-width="2.5" fill="none"/>
      <ellipse cx="50" cy="66" rx="32" ry="10" fill="none" stroke="#d94d38" stroke-width="3"/>
      <line x1="26" y1="20" x2="46" y2="34" stroke="#d49b20" stroke-width="3" stroke-linecap="round"/>
      <line x1="74" y1="20" x2="54" y2="34" stroke="#d49b20" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },

  // E
  {
    id: 'elephant',
    letter: 'E',
    word: 'Elephant',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="58" cy="62" rx="28" ry="20" fill="#68b5e8"/>
      <circle cx="34" cy="46" r="19" fill="#68b5e8"/>
      <ellipse cx="16" cy="43" rx="12" ry="16" fill="#3a8ec7"/>
      <path d="M25,52 Q14,70 22,80 Q26,82 30,78" stroke="#3a8ec7" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="31" cy="41" r="2.6" fill="#332d29"/>
      <rect x="42" y="76" width="7" height="11" rx="3" fill="#3a8ec7"/>
      <rect x="66" y="76" width="7" height="11" rx="3" fill="#3a8ec7"/>
    </svg>`
  },
  {
    id: 'egg',
    letter: 'E',
    word: 'Egg',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,18 C30,18 22,46 22,64 C22,80 34,88 50,88 C66,88 78,80 78,64 C78,46 70,18 50,18 Z" fill="#f4ede2" stroke="#d49b20" stroke-width="2"/>
      <circle cx="44" cy="42" r="3" fill="#ff6f59" opacity="0.6"/>
      <circle cx="58" cy="54" r="4" fill="#48b874" opacity="0.6"/>
      <circle cx="38" cy="68" r="3.5" fill="#68b5e8" opacity="0.6"/>
      <circle cx="62" cy="72" r="2.5" fill="#f7c948" opacity="0.7"/>
    </svg>`
  },

  // F
  {
    id: 'fish',
    letter: 'F',
    word: 'Fish',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="44" cy="52" rx="26" ry="18" fill="#ff6f59"/>
      <polygon points="68,52 90,36 90,68" fill="#d94d38"/>
      <circle cx="30" cy="48" r="4" fill="#332d29"/>
      <circle cx="31" cy="47" r="1.5" fill="#ffffff"/>
      <ellipse cx="42" cy="56" rx="9" ry="5" fill="#f7c948"/>
      <path d="M38,36 Q46,26 54,36" stroke="#d94d38" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'frog',
    letter: 'F',
    word: 'Frog',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="60" rx="34" ry="24" fill="#48b874"/>
      <circle cx="30" cy="38" r="12" fill="#48b874"/>
      <circle cx="70" cy="38" r="12" fill="#48b874"/>
      <circle cx="30" cy="38" r="7" fill="#ffffff"/>
      <circle cx="70" cy="38" r="7" fill="#ffffff"/>
      <circle cx="32" cy="38" r="4" fill="#332d29"/>
      <circle cx="68" cy="38" r="4" fill="#332d29"/>
      <ellipse cx="50" cy="68" rx="22" ry="12" fill="#a4e4be"/>
      <path d="M32,60 Q50,72 68,60" stroke="#2f8750" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'feather',
    letter: 'F',
    word: 'Feather',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M78,18 Q40,36 30,76 L26,84 L32,80 Q56,60 78,18 Z" fill="#68b5e8"/>
      <line x1="26" y1="84" x2="80" y2="16" stroke="#3a8ec7" stroke-width="2.5"/>
      <path d="M46,50 Q36,54 34,60 M56,40 Q46,44 42,50 M66,30 Q56,34 52,40" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.8"/>
    </svg>`
  },

  // G
  {
    id: 'goat',
    letter: 'G',
    word: 'Goat',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="56" rx="24" ry="26" fill="#fffdfa" stroke="#d49b20" stroke-width="2"/>
      <path d="M34,34 Q28,16 22,20 M66,34 Q72,16 78,20" stroke="#d49b20" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="26" cy="46" rx="10" ry="5" fill="#f4ede2" transform="rotate(-20 26 46)"/>
      <ellipse cx="74" cy="46" rx="10" ry="5" fill="#f4ede2" transform="rotate(20 74 46)"/>
      <circle cx="40" cy="52" r="3.5" fill="#332d29"/>
      <circle cx="60" cy="52" r="3.5" fill="#332d29"/>
      <ellipse cx="50" cy="62" rx="5" ry="3.5" fill="#ff6f59"/>
      <polygon points="46,80 54,80 50,90" fill="#fffdfa"/>
    </svg>`
  },
  {
    id: 'grapes',
    letter: 'G',
    word: 'Grapes',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="42" cy="44" r="10" fill="#c44569"/>
      <circle cx="58" cy="44" r="10" fill="#9e2d4e"/>
      <circle cx="34" cy="58" r="10" fill="#9e2d4e"/>
      <circle cx="50" cy="58" r="10" fill="#c44569"/>
      <circle cx="66" cy="58" r="10" fill="#9e2d4e"/>
      <circle cx="42" cy="72" r="10" fill="#c44569"/>
      <circle cx="58" cy="72" r="10" fill="#9e2d4e"/>
      <circle cx="50" cy="84" r="9" fill="#c44569"/>
      <path d="M50,34 Q50,18 40,16" stroke="#2f8750" stroke-width="3" fill="none"/>
      <path d="M50,34 Q65,22 72,30 Q60,38 50,34 Z" fill="#48b874"/>
    </svg>`
  },
  {
    id: 'guitar',
    letter: 'G',
    word: 'Guitar',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="44" cy="64" rx="20" ry="18" fill="#d49b20"/>
      <ellipse cx="52" cy="44" rx="14" ry="12" fill="#d49b20"/>
      <circle cx="48" cy="54" r="6" fill="#332d29"/>
      <rect x="52" y="16" width="6" height="30" fill="#a47214" transform="rotate(30 52 16)"/>
      <polygon points="68,14 74,10 78,16 72,20" fill="#d49b20"/>
    </svg>`
  },

  // H
  {
    id: 'hat',
    letter: 'H',
    word: 'Hat',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="72" rx="40" ry="10" fill="#d49b20"/>
      <path d="M30,70 L34,32 Q50,28 66,32 L70,70 Z" fill="#f7c948"/>
      <rect x="31" y="62" width="38" height="8" fill="#ff6f59"/>
    </svg>`
  },
  {
    id: 'horse',
    letter: 'H',
    word: 'Horse',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M30,76 L40,46 Q44,28 62,32 L72,46 Q74,60 54,64 L46,80 Z" fill="#d49b20"/>
      <polygon points="60,26 66,16 68,28" fill="#a47214"/>
      <circle cx="60" cy="42" r="3.5" fill="#332d29"/>
      <path d="M44,38 Q38,44 42,60" stroke="#a47214" stroke-width="5" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'house',
    letter: 'H',
    word: 'House',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,18 18,44 82,44" fill="#ff6f59"/>
      <rect x="26" y="44" width="48" height="40" fill="#f4ede2" stroke="#d49b20" stroke-width="2"/>
      <rect x="42" y="58" width="16" height="26" fill="#d49b20"/>
      <rect x="32" y="50" width="10" height="10" fill="#68b5e8"/>
      <rect x="58" y="50" width="10" height="10" fill="#68b5e8"/>
      <rect x="66" y="24" width="6" height="14" fill="#d94d38"/>
    </svg>`
  },

  // I
  {
    id: 'igloo',
    letter: 'I',
    word: 'Igloo',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,74 Q16,30 50,30 Q84,30 84,74 Z" fill="#68b5e8" opacity="0.3"/>
      <path d="M20,74 Q20,34 50,34 Q80,34 80,74 Z" fill="#ffffff" stroke="#68b5e8" stroke-width="2.5"/>
      <path d="M22,50 Q50,46 78,50 M20,62 Q50,58 80,62" stroke="#68b5e8" stroke-width="1.8" fill="none"/>
      <path d="M38,74 Q38,56 50,56 Q62,56 62,74 Z" fill="#3a8ec7"/>
    </svg>`
  },
  {
    id: 'insect',
    letter: 'I',
    word: 'Insect',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="58" r="24" fill="#ff6f59"/>
      <circle cx="50" cy="34" r="12" fill="#332d29"/>
      <line x1="50" y1="36" x2="50" y2="82" stroke="#332d29" stroke-width="2.5"/>
      <circle cx="40" cy="52" r="4" fill="#332d29"/>
      <circle cx="60" cy="52" r="4" fill="#332d29"/>
      <circle cx="38" cy="68" r="3.5" fill="#332d29"/>
      <circle cx="62" cy="68" r="3.5" fill="#332d29"/>
      <path d="M44,26 Q36,16 30,18 M56,26 Q64,16 70,18" stroke="#332d29" stroke-width="2" fill="none"/>
    </svg>`
  },

  // J
  {
    id: 'jam',
    letter: 'J',
    word: 'Jam',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" y="42" width="44" height="44" rx="8" fill="#ff6f59"/>
      <rect x="24" y="32" width="52" height="12" rx="4" fill="#ffffff" stroke="#ff6f59" stroke-width="2"/>
      <rect x="36" y="52" width="28" height="22" rx="3" fill="#fffdfa"/>
      <circle cx="50" cy="63" r="4.5" fill="#c44569"/>
    </svg>`
  },
  {
    id: 'jellyfish',
    letter: 'J',
    word: 'Jellyfish',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M24,52 Q24,24 50,24 Q76,24 76,52 Q50,56 24,52 Z" fill="#c44569"/>
      <circle cx="40" cy="42" r="3" fill="#ffffff"/>
      <circle cx="60" cy="42" r="3" fill="#ffffff"/>
      <path d="M34,54 Q30,70 36,86 M44,54 Q40,74 46,86 M54,54 Q58,74 52,86 M64,54 Q68,70 62,86" stroke="#c44569" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'juice',
    letter: 'J',
    word: 'Juice',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="36" width="40" height="50" rx="4" fill="#f7c948"/>
      <circle cx="50" cy="62" r="12" fill="#ff6f59"/>
      <path d="M60,18 L64,36" stroke="#ff6f59" stroke-width="4" stroke-linecap="round"/>
      <path d="M60,18 L54,16" stroke="#ff6f59" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },

  // K
  {
    id: 'kite',
    letter: 'K',
    word: 'Kite',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,14 78,44 50,78 22,44" fill="#68b5e8"/>
      <polygon points="50,14 78,44 50,44" fill="#ff6f59"/>
      <polygon points="22,44 50,44 50,78" fill="#f7c948"/>
      <line x1="50" y1="14" x2="50" y2="78" stroke="#ffffff" stroke-width="2"/>
      <line x1="22" y1="44" x2="78" y2="44" stroke="#ffffff" stroke-width="2"/>
      <path d="M50,78 Q60,86 52,94" stroke="#332d29" stroke-width="1.8" fill="none"/>
    </svg>`
  },
  {
    id: 'key',
    letter: 'K',
    word: 'Key',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="34" cy="50" r="16" fill="#f7c948" stroke="#d49b20" stroke-width="3"/>
      <circle cx="34" cy="50" r="7" fill="#fffdfa"/>
      <rect x="47" y="46" width="36" height="8" rx="2" fill="#f7c948"/>
      <rect x="71" y="54" width="6" height="10" rx="1.5" fill="#f7c948"/>
      <rect x="61" y="54" width="6" height="6" rx="1.5" fill="#f7c948"/>
    </svg>`
  },
  {
    id: 'kangaroo',
    letter: 'K',
    word: 'Kangaroo',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="44" cy="62" rx="22" ry="24" fill="#d49b20"/>
      <circle cx="60" cy="38" r="14" fill="#d49b20"/>
      <polygon points="62,26 66,12 70,26" fill="#a47214"/>
      <circle cx="64" cy="36" r="3" fill="#332d29"/>
      <path d="M26,72 Q14,76 16,86" stroke="#d49b20" stroke-width="7" stroke-linecap="round" fill="none"/>
      <ellipse cx="48" cy="68" rx="10" ry="10" fill="#f7c948"/>
    </svg>`
  },

  // L
  {
    id: 'lion',
    letter: 'L',
    word: 'Lion',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="52" r="34" fill="#d49b20"/>
      <circle cx="50" cy="52" r="24" fill="#f7c948"/>
      <ellipse cx="50" cy="60" rx="12" ry="8" fill="#fffdfa"/>
      <polygon points="46,56 54,56 50,60" fill="#332d29"/>
      <circle cx="41" cy="46" r="3.5" fill="#332d29"/>
      <circle cx="59" cy="46" r="3.5" fill="#332d29"/>
    </svg>`
  },
  {
    id: 'leaf',
    letter: 'L',
    word: 'Leaf',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,80 Q22,46 54,26 Q82,24 80,56 Q76,82 20,80 Z" fill="#48b874"/>
      <line x1="20" y1="80" x2="68" y2="38" stroke="#2f8750" stroke-width="2.5"/>
      <path d="M36,68 Q44,60 52,64 M48,56 Q56,48 64,52" stroke="#2f8750" stroke-width="1.8" fill="none"/>
    </svg>`
  },
  {
    id: 'lamp',
    letter: 'L',
    word: 'Lamp',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="32,46 68,46 60,20 40,20" fill="#ff6f59"/>
      <rect x="47" y="46" width="6" height="34" fill="#68b5e8"/>
      <ellipse cx="50" cy="80" rx="18" ry="6" fill="#3a8ec7"/>
      <polygon points="30,52 70,52 84,86 16,86" fill="#f7c948" opacity="0.25"/>
    </svg>`
  },

  // M
  {
    id: 'moon',
    letter: 'M',
    word: 'Moon',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M64,20 C42,20 26,38 26,60 C26,78 38,92 56,92 C46,84 40,72 40,58 C40,40 50,28 64,20 Z" fill="#f7c948"/>
      <polygon points="76,32 78,38 84,38 80,42 82,48 76,44 70,48 72,42 68,38 74,38" fill="#f7c948"/>
    </svg>`
  },
  {
    id: 'mouse',
    letter: 'M',
    word: 'Mouse',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="62" rx="26" ry="18" fill="#94a3b8"/>
      <circle cx="34" cy="42" r="11" fill="#cbd5e1"/>
      <circle cx="34" cy="42" r="6" fill="#ff6f59" opacity="0.6"/>
      <circle cx="66" cy="42" r="11" fill="#cbd5e1"/>
      <circle cx="66" cy="42" r="6" fill="#ff6f59" opacity="0.6"/>
      <circle cx="42" cy="58" r="3" fill="#332d29"/>
      <circle cx="58" cy="58" r="3" fill="#332d29"/>
      <circle cx="50" cy="66" r="3.5" fill="#ff6f59"/>
    </svg>`
  },
  {
    id: 'mushroom',
    letter: 'M',
    word: 'Mushroom',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="52" width="20" height="32" rx="6" fill="#fffdfa" stroke="#d49b20" stroke-width="2"/>
      <path d="M16,56 Q16,24 50,24 Q84,24 84,56 Z" fill="#ff6f59"/>
      <circle cx="36" cy="42" r="5" fill="#ffffff"/>
      <circle cx="64" cy="42" r="5" fill="#ffffff"/>
      <circle cx="50" cy="34" r="4.5" fill="#ffffff"/>
    </svg>`
  },

  // N
  {
    id: 'nest',
    letter: 'N',
    word: 'Nest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="48" rx="7" ry="10" fill="#68b5e8" transform="rotate(-15 40 48)"/>
      <ellipse cx="50" cy="46" rx="7" ry="10" fill="#68b5e8"/>
      <ellipse cx="60" cy="48" rx="7" ry="10" fill="#68b5e8" transform="rotate(15 60 48)"/>
      <path d="M18,52 Q50,46 82,52 Q76,82 50,82 Q24,82 18,52 Z" fill="#a47214"/>
      <path d="M22,56 Q50,66 78,56 M24,64 Q50,74 76,64" stroke="#d49b20" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'nut',
    letter: 'N',
    word: 'Nut',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M30,46 Q30,78 50,86 Q70,78 70,46 Z" fill="#d49b20"/>
      <path d="M26,46 Q50,38 74,46 L74,40 Q50,32 26,40 Z" fill="#a47214"/>
      <rect x="48" y="24" width="4" height="12" rx="2" fill="#a47214"/>
    </svg>`
  },
  {
    id: 'necklace',
    letter: 'N',
    word: 'Necklace',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M24,30 Q50,78 76,30" stroke="#f7c948" stroke-width="2" fill="none"/>
      <circle cx="28" cy="36" r="4.5" fill="#ff6f59"/>
      <circle cx="35" cy="46" r="4.5" fill="#68b5e8"/>
      <circle cx="42" cy="54" r="4.5" fill="#48b874"/>
      <circle cx="50" cy="58" r="6" fill="#f7c948"/>
      <circle cx="58" cy="54" r="4.5" fill="#48b874"/>
      <circle cx="65" cy="46" r="4.5" fill="#68b5e8"/>
      <circle cx="72" cy="36" r="4.5" fill="#ff6f59"/>
    </svg>`
  },

  // O
  {
    id: 'octopus',
    letter: 'O',
    word: 'Octopus',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="46" rx="26" ry="24" fill="#c44569"/>
      <circle cx="40" cy="42" r="4" fill="#ffffff"/>
      <circle cx="60" cy="42" r="4" fill="#ffffff"/>
      <circle cx="41" cy="42" r="2" fill="#332d29"/>
      <circle cx="59" cy="42" r="2" fill="#332d29"/>
      <path d="M28,64 Q20,80 30,84 M38,66 Q34,84 44,82 M50,68 Q50,86 56,84 M62,66 Q66,84 68,82 M72,64 Q80,80 74,84" stroke="#c44569" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'orange',
    letter: 'O',
    word: 'Orange',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="56" r="32" fill="#ff6f59"/>
      <path d="M50,24 Q60,14 66,20 Q56,30 50,24 Z" fill="#48b874"/>
      <circle cx="50" cy="24" r="3" fill="#2f8750"/>
      <circle cx="42" cy="48" r="1.5" fill="#ffffff" opacity="0.6"/>
    </svg>`
  },
  {
    id: 'ostrich',
    letter: 'O',
    word: 'Ostrich',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="44" cy="64" rx="22" ry="18" fill="#332d29"/>
      <path d="M56,60 Q66,48 64,30" stroke="#f4ede2" stroke-width="7" stroke-linecap="round" fill="none"/>
      <circle cx="64" cy="26" r="8" fill="#f4ede2"/>
      <polygon points="70,26 82,28 72,32" fill="#f7c948"/>
      <circle cx="64" cy="24" r="2" fill="#332d29"/>
      <line x1="38" y1="80" x2="36" y2="92" stroke="#d49b20" stroke-width="3"/>
      <line x1="50" y1="80" x2="52" y2="92" stroke="#d49b20" stroke-width="3"/>
    </svg>`
  },

  // P
  {
    id: 'pig',
    letter: 'P',
    word: 'Pig',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="26,36 20,20 38,28" fill="#ff6f59"/>
      <polygon points="74,36 80,20 62,28" fill="#ff6f59"/>
      <circle cx="50" cy="54" r="28" fill="#ff6f59"/>
      <ellipse cx="50" cy="60" rx="12" ry="8" fill="#fffdfa"/>
      <circle cx="46" cy="60" r="2" fill="#ff6f59"/>
      <circle cx="54" cy="60" r="2" fill="#ff6f59"/>
      <circle cx="40" cy="46" r="3.5" fill="#332d29"/>
      <circle cx="60" cy="46" r="3.5" fill="#332d29"/>
    </svg>`
  },
  {
    id: 'pumpkin',
    letter: 'P',
    word: 'Pumpkin',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="58" rx="34" ry="26" fill="#ff6f59"/>
      <ellipse cx="50" cy="58" rx="20" ry="26" fill="#d94d38"/>
      <ellipse cx="50" cy="58" rx="8" ry="26" fill="#ff6f59"/>
      <path d="M50,34 Q48,20 56,18" stroke="#48b874" stroke-width="5" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'panda',
    letter: 'P',
    word: 'Panda',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="34" r="10" fill="#332d29"/>
      <circle cx="72" cy="34" r="10" fill="#332d29"/>
      <circle cx="50" cy="56" r="28" fill="#ffffff" stroke="#332d29" stroke-width="2"/>
      <ellipse cx="38" cy="52" rx="7" ry="9" fill="#332d29" transform="rotate(-20 38 52)"/>
      <ellipse cx="62" cy="52" rx="7" ry="9" fill="#332d29" transform="rotate(20 62 52)"/>
      <circle cx="38" cy="52" r="2.5" fill="#ffffff"/>
      <circle cx="62" cy="52" r="2.5" fill="#ffffff"/>
      <ellipse cx="50" cy="65" rx="5" ry="3.5" fill="#332d29"/>
    </svg>`
  },

  // Q
  {
    id: 'queen',
    letter: 'Q',
    word: 'Queen',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,66 L26,38 L40,52 L50,28 L60,52 L74,38 L78,66 Z" fill="#f7c948"/>
      <rect x="22" y="66" width="56" height="10" rx="3" fill="#d49b20"/>
      <circle cx="26" cy="36" r="3.5" fill="#c44569"/>
      <circle cx="50" cy="26" r="4.5" fill="#68b5e8"/>
      <circle cx="74" cy="36" r="3.5" fill="#c44569"/>
      <circle cx="36" cy="71" r="2.5" fill="#c44569"/>
      <circle cx="50" cy="71" r="2.5" fill="#48b874"/>
      <circle cx="64" cy="71" r="2.5" fill="#c44569"/>
    </svg>`
  },
  {
    id: 'quilt',
    letter: 'Q',
    word: 'Quilt',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="60" height="60" rx="4" fill="#f4ede2" stroke="#d49b20" stroke-width="2"/>
      <rect x="24" y="24" width="24" height="24" fill="#ff6f59"/>
      <rect x="52" y="24" width="24" height="24" fill="#68b5e8"/>
      <rect x="24" y="52" width="24" height="24" fill="#f7c948"/>
      <rect x="52" y="52" width="24" height="24" fill="#48b874"/>
    </svg>`
  },

  // R
  {
    id: 'rabbit',
    letter: 'R',
    word: 'Rabbit',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="38" cy="28" rx="7" ry="18" fill="#ffffff" stroke="#e2d7c5" stroke-width="2"/>
      <ellipse cx="38" cy="28" rx="3.5" ry="12" fill="#ff6f59" opacity="0.6"/>
      <ellipse cx="62" cy="28" rx="7" ry="18" fill="#ffffff" stroke="#e2d7c5" stroke-width="2"/>
      <ellipse cx="62" cy="28" rx="3.5" ry="12" fill="#ff6f59" opacity="0.6"/>
      <circle cx="50" cy="60" r="26" fill="#ffffff" stroke="#e2d7c5" stroke-width="2"/>
      <circle cx="41" cy="56" r="3.5" fill="#332d29"/>
      <circle cx="59" cy="56" r="3.5" fill="#332d29"/>
      <polygon points="47,64 53,64 50,68" fill="#ff6f59"/>
    </svg>`
  },
  {
    id: 'rainbow',
    letter: 'R',
    word: 'Rainbow',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,74 A34,34 0 0,1 84,74" stroke="#ff6f59" stroke-width="6" fill="none"/>
      <path d="M22,74 A28,28 0 0,1 78,74" stroke="#f7c948" stroke-width="6" fill="none"/>
      <path d="M28,74 A22,22 0 0,1 72,74" stroke="#48b874" stroke-width="6" fill="none"/>
      <path d="M34,74 A16,16 0 0,1 66,74" stroke="#68b5e8" stroke-width="6" fill="none"/>
      <circle cx="20" cy="74" r="8" fill="#ffffff"/>
      <circle cx="80" cy="74" r="8" fill="#ffffff"/>
    </svg>`
  },
  {
    id: 'rocket',
    letter: 'R',
    word: 'Rocket',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,14 Q66,32 64,68 L36,68 Q34,32 50,14 Z" fill="#ffffff" stroke="#ff6f59" stroke-width="2"/>
      <path d="M50,14 Q58,24 62,36 L38,36 Q42,24 50,14 Z" fill="#ff6f59"/>
      <polygon points="36,54 20,68 36,68" fill="#68b5e8"/>
      <polygon points="64,54 80,68 64,68" fill="#68b5e8"/>
      <circle cx="50" cy="50" r="7" fill="#68b5e8"/>
      <polygon points="42,68 50,88 58,68" fill="#f7c948"/>
    </svg>`
  },

  // S
  {
    id: 'sun',
    letter: 'S',
    word: 'Sun',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="22" fill="#f7c948"/>
      <g stroke="#f7c948" stroke-width="5" stroke-linecap="round">
        <line x1="50" y1="14" x2="50" y2="22"/>
        <line x1="50" y1="78" x2="50" y2="86"/>
        <line x1="14" y1="50" x2="22" y2="50"/>
        <line x1="78" y1="50" x2="86" y2="50"/>
        <line x1="24" y1="24" x2="30" y2="30"/>
        <line x1="70" y1="70" x2="76" y2="76"/>
        <line x1="24" y1="76" x2="30" y2="70"/>
        <line x1="70" y1="30" x2="76" y2="24"/>
      </g>
      <circle cx="43" cy="46" r="3" fill="#332d29"/>
      <circle cx="57" cy="46" r="3" fill="#332d29"/>
      <path d="M44,56 Q50,62 56,56" stroke="#332d29" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'star',
    letter: 'S',
    word: 'Star',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,14 62,38 88,42 68,60 74,86 50,72 26,86 32,60 12,42 38,38" fill="#f7c948" stroke="#d49b20" stroke-width="2"/>
      <circle cx="43" cy="48" r="3" fill="#332d29"/>
      <circle cx="57" cy="48" r="3" fill="#332d29"/>
      <path d="M46,58 Q50,62 54,58" stroke="#332d29" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'snail',
    letter: 'S',
    word: 'Snail',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="64" cy="52" rx="20" ry="20" fill="#f7c948"/>
      <path d="M64,52 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 m6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" stroke="#d49b20" stroke-width="2.5" fill="none"/>
      <path d="M22,76 Q42,66 84,76" stroke="#48b874" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="24" cy="62" r="8" fill="#48b874"/>
      <circle cx="22" cy="60" r="2.5" fill="#332d29"/>
      <line x1="20" y1="56" x2="16" y2="46" stroke="#48b874" stroke-width="2"/>
    </svg>`
  },

  // T
  {
    id: 'tiger',
    letter: 'T',
    word: 'Tiger',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="34" r="10" fill="#ff6f59"/>
      <circle cx="72" cy="34" r="10" fill="#ff6f59"/>
      <circle cx="50" cy="56" r="28" fill="#ff6f59"/>
      <ellipse cx="50" cy="64" rx="14" ry="10" fill="#fffdfa"/>
      <polygon points="46,58 54,58 50,62" fill="#332d29"/>
      <circle cx="39" cy="48" r="4" fill="#332d29"/>
      <circle cx="61" cy="48" r="4" fill="#332d29"/>
      <path d="M50,30 L50,42 M42,34 L48,40 M58,34 L52,40 M24,56 L34,56 M76,56 L66,56" stroke="#332d29" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'turtle',
    letter: 'T',
    word: 'Turtle',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="56" rx="26" ry="22" fill="#48b874" stroke="#2f8750" stroke-width="2"/>
      <circle cx="76" cy="56" r="9" fill="#a4e4be"/>
      <circle cx="78" cy="54" r="2" fill="#332d29"/>
      <ellipse cx="34" cy="38" rx="5" ry="8" fill="#a4e4be" transform="rotate(-30 34 38)"/>
      <ellipse cx="66" cy="38" rx="5" ry="8" fill="#a4e4be" transform="rotate(30 66 38)"/>
      <ellipse cx="34" cy="74" rx="5" ry="8" fill="#a4e4be" transform="rotate(30 34 74)"/>
      <ellipse cx="66" cy="74" rx="5" ry="8" fill="#a4e4be" transform="rotate(-30 66 74)"/>
      <path d="M42,50 L50,44 L58,50 L58,62 L50,68 L42,62 Z" stroke="#2f8750" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'train',
    letter: 'T',
    word: 'Train',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="44" width="46" height="28" fill="#68b5e8"/>
      <rect x="52" y="30" width="28" height="42" fill="#ff6f59"/>
      <rect x="58" y="36" width="16" height="14" fill="#f7c948"/>
      <rect x="28" y="32" width="8" height="12" fill="#332d29"/>
      <circle cx="34" cy="74" r="7" fill="#332d29"/>
      <circle cx="52" cy="74" r="7" fill="#332d29"/>
      <circle cx="70" cy="74" r="7" fill="#332d29"/>
      <circle cx="30" cy="22" r="5" fill="#e2d7c5" opacity="0.6"/>
      <circle cx="26" cy="14" r="7" fill="#e2d7c5" opacity="0.4"/>
    </svg>`
  },

  // U
  {
    id: 'umbrella',
    letter: 'U',
    word: 'Umbrella',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M18,52 Q50,18 82,52 Q72,50 62,52 Q50,50 38,52 Q28,50 18,52 Z" fill="#c44569"/>
      <line x1="50" y1="20" x2="50" y2="76" stroke="#d49b20" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M50,76 Q50,86 42,86" stroke="#d49b20" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'unicorn',
    letter: 'U',
    word: 'Unicorn',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="56" r="26" fill="#ffffff" stroke="#e2d7c5" stroke-width="2"/>
      <polygon points="46,32 54,32 50,10" fill="#f7c948"/>
      <circle cx="41" cy="52" r="3.5" fill="#332d29"/>
      <circle cx="59" cy="52" r="3.5" fill="#332d29"/>
      <ellipse cx="50" cy="65" rx="8" ry="5" fill="#ff6f59" opacity="0.6"/>
      <path d="M30,42 Q20,54 26,66" stroke="#68b5e8" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M70,42 Q80,54 74,66" stroke="#c44569" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`
  },

  // V
  {
    id: 'van',
    letter: 'V',
    word: 'Van',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="38" width="60" height="34" rx="6" fill="#68b5e8"/>
      <rect x="60" y="44" width="16" height="12" fill="#fffdfa"/>
      <rect x="26" y="44" width="28" height="12" fill="#fffdfa"/>
      <circle cx="34" cy="72" r="8" fill="#332d29"/>
      <circle cx="66" cy="72" r="8" fill="#332d29"/>
      <circle cx="80" cy="58" r="3.5" fill="#f7c948"/>
    </svg>`
  },
  {
    id: 'violin',
    letter: 'V',
    word: 'Violin',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M44,40 C34,44 34,60 40,66 C36,74 46,84 56,80 C64,84 74,74 70,66 C76,60 76,44 66,40 Z" fill="#d49b20"/>
      <rect x="52" y="16" width="6" height="26" fill="#332d29"/>
      <circle cx="55" cy="14" r="5" fill="#a47214"/>
      <line x1="28" y1="26" x2="76" y2="74" stroke="#a47214" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'volcano',
    letter: 'V',
    word: 'Volcano',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,38 18,84 82,84" fill="#a47214"/>
      <polygon points="42,38 50,56 58,38" fill="#ff6f59"/>
      <path d="M46,38 Q36,20 44,14 M54,38 Q64,20 56,14" stroke="#ff6f59" stroke-width="3" fill="none"/>
    </svg>`
  },

  // W
  {
    id: 'whale',
    letter: 'W',
    word: 'Whale',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,60 Q26,38 56,42 Q82,46 84,60 Q66,74 22,60 Z" fill="#68b5e8"/>
      <polygon points="14,48 24,58 14,68" fill="#3a8ec7"/>
      <circle cx="68" cy="52" r="3.5" fill="#332d29"/>
      <path d="M50,40 Q50,22 44,18 M52,40 Q58,22 62,20" stroke="#3a8ec7" stroke-width="2.5" fill="none"/>
    </svg>`
  },
  {
    id: 'watermelon',
    letter: 'W',
    word: 'Watermelon',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,46 Q50,92 84,46 Z" fill="#48b874"/>
      <path d="M22,46 Q50,84 78,46 Z" fill="#ff6f59"/>
      <circle cx="36" cy="54" r="2" fill="#332d29"/>
      <circle cx="50" cy="62" r="2" fill="#332d29"/>
      <circle cx="64" cy="54" r="2" fill="#332d29"/>
    </svg>`
  },
  {
    id: 'worm',
    letter: 'W',
    word: 'Worm',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M24,70 Q34,44 46,62 Q58,78 70,52 Q76,42 84,46" stroke="#ff6f59" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="82" cy="44" r="2" fill="#332d29"/>
    </svg>`
  },

  // X
  {
    id: 'xylophone',
    letter: 'X',
    word: 'Xylophone',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="24" width="10" height="54" rx="2" fill="#ff6f59"/>
      <rect x="34" y="28" width="10" height="50" rx="2" fill="#f7c948"/>
      <rect x="48" y="32" width="10" height="46" rx="2" fill="#48b874"/>
      <rect x="62" y="36" width="10" height="42" rx="2" fill="#68b5e8"/>
      <rect x="76" y="40" width="10" height="38" rx="2" fill="#c44569"/>
      <line x1="28" y1="18" x2="52" y2="38" stroke="#d49b20" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="28" cy="18" r="4.5" fill="#ff6f59"/>
    </svg>`
  },
  {
    id: 'xray',
    letter: 'X',
    word: 'X-ray',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="18" width="56" height="64" rx="6" fill="#1e293b"/>
      <path d="M46,32 L46,66 M54,32 L54,66 M38,40 L62,40 M36,50 L64,50 M40,60 L60,60" stroke="#68b5e8" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },

  // Y
  {
    id: 'yoyo',
    letter: 'Y',
    word: 'Yoyo',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="58" rx="26" ry="18" fill="#ff6f59"/>
      <ellipse cx="50" cy="54" rx="22" ry="14" fill="#f7c948"/>
      <circle cx="50" cy="54" r="8" fill="#ff6f59"/>
      <path d="M50,54 Q54,32 50,18" stroke="#332d29" stroke-width="2.5" fill="none"/>
    </svg>`
  },
  {
    id: 'yarn',
    letter: 'Y',
    word: 'Yarn',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="54" r="26" fill="#c44569"/>
      <path d="M30,50 Q50,70 70,50 M32,60 Q50,40 68,60 M40,32 Q60,54 44,74" stroke="#ff6f59" stroke-width="2.5" fill="none"/>
      <line x1="20" y1="20" x2="74" y2="78" stroke="#d49b20" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'yak',
    letter: 'Y',
    word: 'Yak',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M28,34 Q20,18 16,24 Q24,38 32,40 M72,34 Q80,18 84,24 Q76,38 68,40" stroke="#a47214" stroke-width="4.5" fill="none"/>
      <ellipse cx="50" cy="56" rx="26" ry="24" fill="#a47214"/>
      <ellipse cx="50" cy="64" rx="14" ry="10" fill="#d49b20"/>
      <circle cx="40" cy="50" r="3.5" fill="#332d29"/>
      <circle cx="60" cy="50" r="3.5" fill="#332d29"/>
      <ellipse cx="50" cy="64" rx="4" ry="2.5" fill="#332d29"/>
    </svg>`
  },

  // Z
  {
    id: 'zebra',
    letter: 'Z',
    word: 'Zebra',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="56" rx="26" ry="24" fill="#ffffff" stroke="#332d29" stroke-width="2"/>
      <circle cx="39" cy="50" r="3.5" fill="#332d29"/>
      <circle cx="61" cy="50" r="3.5" fill="#332d29"/>
      <ellipse cx="50" cy="65" rx="12" ry="7" fill="#f4ede2"/>
      <path d="M28,42 L42,46 M26,52 L38,54 M72,42 L58,46 M74,52 L62,54" stroke="#332d29" stroke-width="3" stroke-linecap="round"/>
      <polygon points="34,26 40,14 44,26" fill="#332d29"/>
      <polygon points="66,26 60,14 56,26" fill="#332d29"/>
    </svg>`
  },
  {
    id: 'zipper',
    letter: 'Z',
    word: 'Zipper',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <line x1="50" y1="16" x2="50" y2="84" stroke="#a47214" stroke-width="8" stroke-dasharray="3 3"/>
      <rect x="42" y="36" width="16" height="22" rx="4" fill="#d49b20"/>
      <ellipse cx="50" cy="66" rx="5" ry="8" fill="#f7c948"/>
      <circle cx="50" cy="42" r="3" fill="#332d29"/>
    </svg>`
  }
];

// Helper to wrap the SVG illustration or AI-generated image into a full Flashcard card SVG
function createCardSvg(def, { revealed = false } = {}) {
  const { letter, word, svg } = def;
  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const innerContent = innerMatch ? innerMatch[1] : '';

  const jpgPath = path.join(OUTPUT_DIR, `${def.id}.jpg`);
  const hasJpg = fs.existsSync(jpgPath);

  let imageContent = '';
  if (hasJpg) {
    imageContent = `
    <clipPath id="imgClip_${def.id}_${revealed ? 'rev' : 'norm'}">
      <rect x="23" y="24" width="154" height="148" rx="14"/>
    </clipPath>
    <image href="/art/flashcards/${def.id}.jpg" x="23" y="24" width="154" height="148" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip_${def.id}_${revealed ? 'rev' : 'norm'})"/>
    `;
  } else {
    imageContent = `
    <g transform="translate(38, 36) scale(1.24)">
      ${innerContent}
    </g>
    `;
  }

  // Nautical / Boho decor accents
  const cornerSeal = revealed
    ? `
    <!-- Celebratory Golden Letter Badge -->
    <g>
      <line x1="37" y1="20" x2="37" y2="24" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="37" y1="52" x2="37" y2="56" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="19" y1="38" x2="23" y2="38" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="51" y1="38" x2="55" y2="38" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <circle cx="37" cy="38" r="14" fill="#f7c948" stroke="#d49b20" stroke-width="2"/>
      <text x="37" y="44.5" font-family="'Nunito', system-ui, -apple-system, sans-serif" font-weight="900" font-size="17" fill="#332d29" text-anchor="middle">${letter}</text>
    </g>
    `
    : `
    <!-- Nautical Compass / Boho Sun Seal (Hides Letter) -->
    <g>
      <circle cx="37" cy="38" r="12" fill="#f4ece1" stroke="#c8b49e" stroke-width="1.5"/>
      <path d="M37,29 L38.6,35.4 L45,37 L38.6,38.6 L37,45 L35.4,38.6 L29,37 L35.4,35.4 Z" fill="#d49b20" opacity="0.85"/>
      <circle cx="37" cy="37" r="1.8" fill="#fffdfa"/>
    </g>
    `;

  const bottomBanner = revealed
    ? `
    <!-- Celebratory Word Reveal Banner -->
    <g>
      <rect x="24" y="176" width="152" height="38" rx="12" fill="#fffdfa" stroke="#e5a823" stroke-width="2.5" filter="url(#cardShadow)"/>
      <polygon points="34,195 36,190 38,195 35,192 37,192" fill="#f7c948"/>
      <polygon points="166,195 164,190 162,195 165,192 163,192" fill="#f7c948"/>
      <text x="100" y="202.5" font-family="'Nunito', system-ui, -apple-system, sans-serif" font-weight="900" font-size="21" fill="#332d29" text-anchor="middle">
        <tspan fill="#e26a57">${word[0]}</tspan>${word.slice(1)}
      </text>
    </g>
    `
    : `
    <!-- Nautical Boho Sea-Wave Mystery Banner (Hides Word) -->
    <g>
      <rect x="26" y="178" width="148" height="34" rx="10" fill="#f3ece1" stroke="#d8c5b0" stroke-width="1.5"/>
      <path d="M68,195 Q74,189 80,195 Q86,201 92,195 M96,195 Q102,189 108,195 Q114,201 120,195 M124,195 Q130,189 136,195" stroke="#ba9e82" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <circle cx="56" cy="195" r="2.5" fill="#e26a57" opacity="0.75"/>
      <circle cx="144" cy="195" r="2.5" fill="#e26a57" opacity="0.75"/>
    </g>
    `;

  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#36291e" flood-opacity="0.16"/>
    </filter>
    <linearGradient id="cardBg_${def.id}_${revealed ? 'rev' : 'norm'}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffefc"/>
      <stop offset="100%" stop-color="#f7f0e4"/>
    </linearGradient>
    <linearGradient id="viewportBg_${def.id}_${revealed ? 'rev' : 'norm'}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eff5f6"/>
      <stop offset="100%" stop-color="#faf8f2"/>
    </linearGradient>
  </defs>

  <!-- Card Surface (Handmade Coastal Linen Stock) -->
  <rect x="8" y="6" width="184" height="228" rx="22" fill="url(#cardBg_${def.id}_${revealed ? 'rev' : 'norm'})" stroke="#c7b29a" stroke-width="3" filter="url(#cardShadow)"/>
  
  <!-- Nautical Rope / Twine Trim -->
  <rect x="15" y="13" width="170" height="214" rx="16" fill="none" stroke="#ba9e82" stroke-width="1.6" stroke-dasharray="5, 3" opacity="0.6"/>

  <!-- Inner Double Border -->
  <rect x="19" y="17" width="162" height="206" rx="13" fill="none" stroke="#ded2c0" stroke-width="1"/>

  <!-- Boho Corner Flourishes -->
  <circle cx="24" cy="22" r="1.5" fill="#ba9e82" opacity="0.5"/>
  <circle cx="176" cy="22" r="1.5" fill="#ba9e82" opacity="0.5"/>
  <circle cx="24" cy="218" r="1.5" fill="#ba9e82" opacity="0.5"/>
  <circle cx="176" cy="218" r="1.5" fill="#ba9e82" opacity="0.5"/>

  <!-- Illustration Viewport (Recessed aperture with sea-glass wash) -->
  <rect x="23" y="24" width="154" height="148" rx="14" fill="url(#viewportBg_${def.id}_${revealed ? 'rev' : 'norm'})" stroke="#ded0be" stroke-width="1.5"/>

  <!-- Artwork Content -->
  ${imageContent}

  <!-- Top Corner Seal (Hidden or Revealed) -->
  ${cornerSeal}

  <!-- Bottom Banner (Mystery Wave or Revealed Word) -->
  ${bottomBanner}
</svg>`;
}

// 1. Write standalone SVG icons and complete Flashcard SVGs (both normal and revealed) to public/art/flashcards/
console.log(`Writing ${FLASHCARD_DEFS.length} flashcard assets to ${OUTPUT_DIR}...`);
for (const def of FLASHCARD_DEFS) {
  const iconPath = path.join(OUTPUT_DIR, `${def.id}.svg`);
  const cardPath = path.join(OUTPUT_DIR, `${def.id}-card.svg`);
  const revealedPath = path.join(OUTPUT_DIR, `${def.id}-revealed.svg`);

  fs.writeFileSync(iconPath, def.svg.trim(), 'utf8');
  fs.writeFileSync(cardPath, createCardSvg(def, { revealed: false }).trim(), 'utf8');
  fs.writeFileSync(revealedPath, createCardSvg(def, { revealed: true }).trim(), 'utf8');
}

console.log('Successfully generated all nautical/boho flashcard SVG assets!');

