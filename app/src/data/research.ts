/**
 * Curated, real sources behind this game's teaching approach — for the
 * "grown-ups' corner" Research panel (Dashboard.tsx). Every URL here was
 * looked up directly (search, not recalled from memory) so it's a real,
 * currently-live page, not a guess. Kept to a short, credible list
 * (Reading Rockets, the NICHD-run National Reading Panel, Edutopia, the
 * AAP) rather than an exhaustive bibliography — a parent skimming this
 * should be able to read all of it in a few minutes.
 */
export interface ResearchLink {
  title: string;
  url: string;
  source: string;
  blurb: string;
}

export const RESEARCH_LINKS: ResearchLink[] = [
  {
    title: 'The Alphabetic Principle',
    url: 'https://www.readingrockets.org/topics/phonics-and-decoding/articles/alphabetic-principle',
    source: 'Reading Rockets',
    blurb: 'The foundational idea this whole game is built on: letters stand for sounds, and once a child grasps that link, reading opens up.',
  },
  {
    title: 'Findings of the National Reading Panel',
    url: 'https://www.readingrockets.org/topics/curriculum-and-instruction/articles/findings-national-reading-panel',
    source: 'Reading Rockets, summarizing the NICHD-convened National Reading Panel',
    blurb: 'The large research review behind "systematic phonics" as a teaching approach — strong, well-established benefits from kindergarten through 1st grade especially.',
  },
  {
    title: 'Phonics and Decoding — the basics',
    url: 'https://www.readingrockets.org/reading-101/reading-and-writing-basics/phonics-and-decoding',
    source: 'Reading Rockets',
    blurb: 'A short, plain-language explainer of what phonics instruction actually is, for anyone who wants the basics without the jargon.',
  },
  {
    title: 'A Multisensory Approach to Literacy in Kindergarten',
    url: 'https://www.edutopia.org/article/multisensory-approach-literacy-kindergarten/',
    source: 'Edutopia',
    blurb: "Why this game offers so many ways to answer the same letter (tap, trace, type, say, spot a picture, find the plane) — seeing, hearing, and moving all reinforce the same letter-sound link.",
  },
  {
    title: 'Media and Young Minds',
    url: 'https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds',
    source: 'American Academy of Pediatrics',
    blurb: "The AAP's own guidance on screen use with young children — worth reading alongside this game, not instead of it. Their advice: keep sessions purposeful and, where possible, shared with a grown-up.",
  },
];
