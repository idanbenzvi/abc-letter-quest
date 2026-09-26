import './SkyBackdrop.css';

/**
 * Drifting CSS clouds + a warm sun — the cheap, always-on echo of the
 * flight game's raymarched ocean/sky shader (three/oceanSky.ts). Used
 * wherever a screen wants to feel like part of the same world without
 * paying for WebGL: originally just the flight-intro screen (a sky
 * that's alive before the 3D one loads), now also PlayerSelect and
 * Onboarding, so picking a player or meeting a new child doesn't feel
 * like a bare form bolted onto the game. A parent element that renders
 * this needs `position: relative` and the `.sky-stage` class for the
 * gradient background; its own in-flow content needs `position:
 * relative; z-index: 1` to stack above this (see FlightGameScreen.css's
 * `.flight-intro-content` for the reference pattern).
 */
export function SkyBackdrop() {
  return (
    <div className="sky-backdrop" aria-hidden="true">
      <div className="sky-sun" />
      <div className="sky-cloud c1" />
      <div className="sky-cloud c2" />
      <div className="sky-cloud c3" />
      <div className="sky-cloud c4" />
      <div className="sky-sea" />
    </div>
  );
}
