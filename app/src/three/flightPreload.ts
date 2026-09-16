import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export const STL_URL = '/models/albatross.stl';

/**
 * Warms the bird mesh into R3F's loader cache while the child is still on
 * the intro — so "Take Off!" never waits on a 2.5MB download. Lives in
 * its own module (not FlightCanvas.tsx) purely so that file exports only
 * a component, which React Fast Refresh needs; it's only ever reached
 * through a dynamic import, so it stays in the 3D chunk.
 */
export function preloadFlightAssets(): void {
  useLoader.preload(STLLoader, STL_URL);
}
