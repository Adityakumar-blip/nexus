"use client";

import { useId } from "react";

export interface ChartSeries {
  key: string;
  label: string;
  color: string; // any CSS color (hex / oklch / var)
  values: number[];
}

// A dependency-free, multi-series area+line chart. Smooth Catmull-Rom curves,
// soft gradient fills, and an x-axis of labels. Purely presentational — feed it
// already-bucketed numbers. Reusable anywhere a small trend chart is needed.
export function TrendChart({
  series,
  labels,
  height = 200,
  className,
}: {
  series: ChartSeries[];
  labels: string[];
  height?: number;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const width = 600;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const innerH = height - padTop - padBottom;
  const innerW = width - padX * 2;

  const count = Math.max(1, labels.length);
  const max =
    Math.max(1, ...series.flatMap((s) => s.values), 0) * 1.15; // headroom

  const x = (i: number) =>
    padX + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / max) * innerH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height }}
      role="img"
    >
      <defs>
        {series.map((s) => (
          <linearGradient
            key={s.key}
            id={`grad-${uid}-${s.key}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* horizontal gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={width - padX}
          y1={padTop + innerH * t}
          y2={padTop + innerH * t}
          stroke="currentColor"
          strokeOpacity={0.07}
          strokeWidth={1}
        />
      ))}

      {series.map((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v)] as const);
        const line = smoothPath(pts);
        const area = `${line} L ${x(count - 1)} ${padTop + innerH} L ${x(0)} ${
          padTop + innerH
        } Z`;
        return (
          <g key={s.key}>
            <path d={area} fill={`url(#grad-${uid}-${s.key})`} />
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {pts.map(([px, py], i) => (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={2.5}
                fill="var(--background)"
                stroke={s.color}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}

      {/* x-axis labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 6}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.5}
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

// Build a smooth SVG path through points using a Catmull-Rom → cubic Bézier
// conversion. Falls back to a straight move for a single point.
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
