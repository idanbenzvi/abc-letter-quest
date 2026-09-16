import { useState } from 'react';
import { OCEAN_SKY_DEFAULTS, type OceanDevParams } from './oceanSky';
import './DevOceanPanel.css';

interface SliderSpec {
  key: keyof OceanDevParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'timeOfDay', label: 'Time of day', min: 0, max: 24, step: 0.1 },
  { key: 'seaHeight', label: 'Sea height', min: 0, max: 2, step: 0.01 },
  { key: 'seaChoppy', label: 'Sea choppiness', min: 0, max: 8, step: 0.1 },
  { key: 'seaFreq', label: 'Sea frequency', min: 0.02, max: 0.6, step: 0.005 },
  { key: 'seaRipples', label: 'Sea ripples', min: 0, max: 1, step: 0.01 },
  { key: 'seaSpeed', label: 'Sea speed', min: 0, max: 3, step: 0.05 },
  { key: 'starIntensity', label: 'Star intensity', min: 0, max: 6, step: 0.1 },
  { key: 'sunSize', label: 'Sun size', min: 0.001, max: 0.05, step: 0.001 },
  { key: 'moonSize', label: 'Moon size', min: 0.01, max: 0.2, step: 0.005 },
];

interface ColorSpec {
  key: keyof OceanDevParams;
  label: string;
}

const COLORS: ColorSpec[] = [
  { key: 'daySkyColor', label: 'Day sky' },
  { key: 'sunsetSkyColor', label: 'Sunset sky' },
  { key: 'nightSkyColor', label: 'Night sky' },
  { key: 'sunColor', label: 'Sun' },
  { key: 'moonColor', label: 'Moon' },
  { key: 'seaBaseColor', label: 'Sea base' },
  { key: 'seaWaterColor', label: 'Sea water' },
];

function rgbToHex([r, g, b]: [number, number, number]): string {
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface DevOceanPanelProps {
  params: OceanDevParams;
  onChange: (params: OceanDevParams) => void;
  onClose: () => void;
}

/**
 * Dev-only sea/sky tuning sidebar — the control panel the original
 * "Oceanara" CodePen demo had (GSAP-tweened sliders) before this app
 * stripped it during the port (see docs/10-flight-game.md). Brought
 * back specifically for tuning, not for players: toggled with the `
 * (backtick) key, never shown otherwise. "Copy params" exports the
 * current palette as JSON so a good-looking combination found here can
 * be pasted into OCEAN_SKY_DEFAULTS (oceanSky.ts) as the new baked-in
 * default once decided.
 */
export function DevOceanPanel({ params, onChange, onClose }: DevOceanPanelProps) {
  const [copied, setCopied] = useState(false);

  function set<K extends keyof OceanDevParams>(key: K, value: OceanDevParams[K]) {
    onChange({ ...params, [key]: value });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail (permissions, insecure context) — the panel
      // still shows the JSON isn't lost, just not silently copied.
    }
  }

  return (
    <div className="dev-ocean-panel">
      <div className="dev-ocean-header">
        <span>Ocean/Sky tuning (dev)</span>
        <button type="button" onClick={onClose} aria-label="Close dev panel">
          ×
        </button>
      </div>

      <div className="dev-ocean-section">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <label key={key} className="dev-ocean-row">
            <span className="dev-ocean-label">
              {label}
              <span className="dev-ocean-value">{(params[key] as number).toFixed(3)}</span>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={params[key] as number}
              onChange={(e) => set(key, Number(e.target.value) as OceanDevParams[typeof key])}
            />
          </label>
        ))}
      </div>

      <div className="dev-ocean-section">
        {COLORS.map(({ key, label }) => (
          <label key={key} className="dev-ocean-row dev-ocean-row-color">
            <span className="dev-ocean-label">{label}</span>
            <input
              type="color"
              value={rgbToHex(params[key] as [number, number, number])}
              onChange={(e) => set(key, hexToRgb(e.target.value) as OceanDevParams[typeof key])}
            />
          </label>
        ))}
      </div>

      <div className="dev-ocean-actions">
        <button type="button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy params as JSON'}
        </button>
        <button type="button" onClick={() => onChange({ ...OCEAN_SKY_DEFAULTS })}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
