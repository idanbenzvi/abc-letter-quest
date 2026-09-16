import { useState, lazy, Suspense, type ReactNode } from 'react';
import { useApp } from './state/AppContext';
import { Onboarding } from './screens/Onboarding';
import { PlayerSelect } from './screens/PlayerSelect';
import { Dashboard } from './screens/Dashboard';
import { FlightGameScreen } from './three/FlightGameScreen';
import { ScreenTransition } from './components/ScreenTransition';

// Dev-only and raw three.js — a static import here dragged the entire
// three.js library into the first-load chunk for every player, for a
// screen only reachable via `?rig`. Lazy so it costs nothing otherwise.
const RigTool = lazy(() => import('./three/RigTool').then((m) => ({ default: m.RigTool })));

// World Map + Letter Learning (reveal/trace/quiz) + their Celebration/
// ChapterComplete moments have been replaced by the flight game per
// direct user instruction — see docs/10-flight-game.md. The old screen
// files are untouched (not deleted) since the trace mechanic's fate
// inside the new game is still an open question at time of writing.
type View = { type: 'play' } | { type: 'dashboard' } | { type: 'playerSelect' };

export default function App() {
  const { players, activePlayerId } = useApp();
  const [view, setView] = useState<View>({ type: 'play' });

  // Dev-only rigging tool (see RigTool.tsx) — a completely separate
  // screen for hand-placing the albatross model's joints, unrelated to
  // and bypassing the normal profile/onboarding flow entirely. Plain
  // three.js internally (no Suspense needed) — see RigTool.tsx's doc
  // comment for why it doesn't use R3F like everything else here.
  if (new URLSearchParams(window.location.search).has('rig')) {
    return (
      <Suspense fallback={null}>
        <RigTool />
      </Suspense>
    );
  }

  // No player at all yet — a brand-new install. Straight to Onboarding,
  // same as before multi-player support existed; there's nothing to
  // pick from, so a picker screen here would just be an empty extra step.
  let screenKey: string;
  let screen: ReactNode;
  if (players.length === 0) {
    screenKey = 'onboarding';
    screen = <Onboarding />;
  } else if (!activePlayerId || view.type === 'playerSelect') {
    // 1+ players exist but none is active (first launch after that, or
    // a deliberate switch from the settings menu mid-play) — "who's
    // flying today?" gates play until someone is picked or added.
    screenKey = 'playerSelect';
    screen = (
      <PlayerSelect
        onSelected={() => setView({ type: 'play' })}
        onCancel={activePlayerId && view.type === 'playerSelect' ? () => setView({ type: 'play' }) : undefined}
      />
    );
  } else if (view.type === 'dashboard') {
    screenKey = 'dashboard';
    screen = <Dashboard onBack={() => setView({ type: 'play' })} onSwitchPlayer={() => setView({ type: 'playerSelect' })} />;
  } else {
    screenKey = 'play';
    screen = <FlightGameScreen onOpenDashboard={() => setView({ type: 'dashboard' })} />;
  }

  return <ScreenTransition transitionKey={screenKey}>{screen}</ScreenTransition>;
}
