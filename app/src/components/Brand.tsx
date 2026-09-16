import './Brand.css';

/**
 * The ABCtross wordmark (public/art/abctross-wordmark.png, cut out of
 * the generated title art) — used on every screen that "introduces" the
 * game: onboarding, the player picker, the loading veil. The full key
 * art with the pilot albatross (public/art/abctross-key-art.jpg) is the
 * intro screen's hero; the wordmark is what appears where a heading
 * would otherwise sit.
 */
export function Wordmark({ width = 320, className = '' }: { width?: number; className?: string }) {
  return <img className={`brand-wordmark ${className}`} src="/art/abctross-wordmark.png" alt="ABCtross" width={width} draggable={false} />;
}

export function KeyArt({ className = '' }: { className?: string }) {
  return <img className={`brand-keyart ${className}`} src="/art/abctross-key-art.jpg" alt="ABCtross — learning adventure" draggable={false} />;
}
