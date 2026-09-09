// src/components/Sparkline.tsx — live price trace built from poll samples.
// Single series, so it uses the direction colour (green up / red down) rather
// than a categorical palette.

interface SparklineProps {
  values: number[];
  color: string;
  height?: number;
  /** Draw the pulsing "latest sample" marker. */
  showHead?: boolean;
}

const VIEW_W = 600;
const PAD = 6;

export function Sparkline({ values, color, height = 84, showHead = true }: SparklineProps) {
  const usable = values.filter((value) => Number.isFinite(value));

  if (usable.length === 0) {
    return <div style={{ height }} />;
  }

  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const span = max - min;
  const plotH = height - PAD * 2;

  const yFor = (value: number) => (span === 0 ? PAD + plotH / 2 : PAD + (1 - (value - min) / span) * plotH);
  const xFor = (index: number) =>
    usable.length === 1 ? VIEW_W : (index / (usable.length - 1)) * VIEW_W;

  const points = usable.map((value, index) => `${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`);
  const line =
    usable.length === 1
      ? `M0,${yFor(usable[0]).toFixed(2)} L${VIEW_W},${yFor(usable[0]).toFixed(2)}`
      : `M${points.join(" L")}`;
  const area = `${line} L${VIEW_W},${height} L0,${height} Z`;

  const headTop = (yFor(usable[usable.length - 1]) / height) * 100;
  const gradientId = "sparkline-fill";

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price trace, ${usable.length} samples, latest ${usable[usable.length - 1]}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showHead && (
        <span
          className="live-dot"
          style={{
            position: "absolute",
            right: -3,
            top: `${headTop}%`,
            width: 7,
            height: 7,
            marginTop: -3.5,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 0 3px ${color}22`,
          }}
        />
      )}
    </div>
  );
}
