'use client'

// Custom token icon — replaces coin emoji for cross-platform rendering consistency.
// Design: Milled Edge base with Compass 4-point star (points at N/S/E/W).
// Gradient ID: tokenFill — used across all instances.
// Sizes used in the app: 13, 14, 15, 16, 18, 20, 22, 48px

/** SSR-safe: Node vs browser Math.cos/sin can differ at the last ULP; round so markup matches. */
function svgCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export default function TokenSVG({ size = 20 }: { size?: number }) {
  const star = (cx: number, cy: number, dy: number, outer: number, inner: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? outer : inner;
      const x = svgCoord(cx + r * Math.cos(a));
      const y = svgCoord(cy + dy + r * Math.sin(a));
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    >
      <defs>
        <radialGradient id="tokenFill" cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#FFE070" />
          <stop offset="45%" stopColor="#F0A500" />
          <stop offset="100%" stopColor="#8B5200" />
        </radialGradient>
      </defs>
      {/* Drop shadow */}
      <circle cx="10" cy="10.8" r="8.5" fill="rgba(0,0,0,0.35)" />
      {/* Main face */}
      <circle cx="10" cy="10" r="8.5" fill="url(#tokenFill)" />
      {/* Outer rim */}
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="rgba(255,200,60,0.4)" strokeWidth="0.6" />
      {/* Inner ring */}
      <circle cx="10" cy="10" r="5.8" fill="none" stroke="rgba(140,80,0,0.55)" strokeWidth="0.9" />
      {/* Milled edge dots */}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={svgCoord(10 + 7.6 * Math.cos(a))}
            cy={svgCoord(10 + 7.6 * Math.sin(a))}
            r="0.45"
            fill="rgba(120,70,0,0.5)"
          />
        );
      })}
      {/* Compass star — shadow layer */}
      <polygon points={star(10, 10, 0.3, 3.5, 1.1)} fill="rgba(140,80,0,0.5)" />
      {/* Compass star — lit layer */}
      <polygon points={star(10, 10, 0, 3.5, 1.1)} fill="rgba(255,230,100,0.9)" />
      {/* Glint */}
      <circle cx="7.2" cy="7" r="1.1" fill="rgba(255,255,220,0.55)" />
      <circle cx="8.5" cy="6" r="0.5" fill="rgba(255,255,220,0.35)" />
    </svg>
  );
}
