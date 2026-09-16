export function NestIllustration({ size = 220 }: { size?: number }) {
  return (
    <svg viewBox="0 0 220 160" width={size} height={(size * 160) / 220} aria-hidden="true">
      <path d="M20,120 Q30,88 60,96 Q70,80 90,93 Q100,76 120,90 Q140,76 155,93 Q180,86 197,116 Q202,136 110,140 Q18,138 20,120 Z" fill="var(--sun-dark)" opacity="0.9" />
      <path d="M14,124 Q110,156 206,121 L206,133 Q110,164 14,136 Z" fill="var(--sun-dark)" />
      <g>
        <ellipse cx="78" cy="106" rx="18" ry="16" fill="#f5e6a8" />
        <polygon points="80,112 90,116 80,120" fill="#c98a2e" />
        <circle cx="72" cy="101" r="3" fill="var(--ink)" />
      </g>
      <g>
        <ellipse cx="114" cy="98" rx="20" ry="18" fill="#f7ecb0" />
        <polygon points="116,106 127,110 116,114" fill="#c98a2e" />
        <circle cx="107" cy="92" r="3.2" fill="var(--ink)" />
      </g>
      <g>
        <ellipse cx="149" cy="108" rx="16" ry="14" fill="#f5e6a8" />
        <polygon points="151,114 159,118 151,121" fill="#c98a2e" />
        <circle cx="143" cy="103" r="3" fill="var(--ink)" />
      </g>
    </svg>
  );
}
