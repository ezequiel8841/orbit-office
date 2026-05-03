// Lightweight SVG chart renderer. Zero deps.
import type { ChartSpec } from "./model";

export interface SeriesData {
  labels: string[];
  series: { name: string; values: number[] }[];
}

export function extractSeries(
  read: (r: number, c: number) => import("./model").CellValue,
  chart: ChartSpec,
): SeriesData {
  const { range, hasHeader } = chart;
  const headerRow = hasHeader ? range.r1 : -1;
  const labelsCol = range.c1;
  const dataR1 = hasHeader ? range.r1 + 1 : range.r1;
  const labels: string[] = [];
  for (let r = dataR1; r <= range.r2; r++) {
    const v = read(r, labelsCol);
    labels.push(v == null ? "" : String(v));
  }
  const series: { name: string; values: number[] }[] = [];
  for (let c = labelsCol + 1; c <= range.c2; c++) {
    const name = headerRow >= 0 ? String(read(headerRow, c) ?? `Col ${c}`) : `Series ${c - labelsCol}`;
    const values: number[] = [];
    for (let r = dataR1; r <= range.r2; r++) {
      const v = read(r, c);
      values.push(typeof v === "number" ? v : Number(v) || 0);
    }
    series.push({ name, values });
  }
  return { labels, series };
}

const PALETTE = [
  "hsl(220 90% 55%)",
  "hsl(160 70% 45%)",
  "hsl(30 90% 55%)",
  "hsl(340 80% 60%)",
  "hsl(270 70% 60%)",
  "hsl(190 80% 50%)",
];

export function ChartView({
  chart,
  data,
  onRemove,
  onMoveStart,
}: {
  chart: ChartSpec;
  data: SeriesData;
  onRemove?: () => void;
  onMoveStart?: (e: React.MouseEvent) => void;
}) {
  const padding = { l: 36, r: 12, t: 26, b: 22 };
  const innerW = chart.w - padding.l - padding.r;
  const innerH = chart.h - padding.t - padding.b;
  const allValues = data.series.flatMap((s) => s.values);
  const max = Math.max(0, ...allValues);
  const min = Math.min(0, ...allValues);
  const span = max - min || 1;
  const xFor = (i: number, total: number) =>
    total <= 1 ? innerW / 2 : (i / (total - 1)) * innerW;
  const yFor = (v: number) => innerH - ((v - min) / span) * innerH;

  const renderLine = () => (
    <>
      {data.series.map((s, si) => {
        const color = PALETTE[si % PALETTE.length];
        const d = s.values
          .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i, s.values.length).toFixed(1)},${yFor(v).toFixed(1)}`)
          .join(" ");
        return <path key={si} d={d} fill="none" stroke={color} strokeWidth="2" />;
      })}
    </>
  );
  const renderBars = (vertical: boolean) => {
    const groupCount = data.labels.length;
    const seriesCount = data.series.length;
    const groupW = (vertical ? innerW : innerH) / Math.max(1, groupCount);
    const barW = (groupW * 0.8) / Math.max(1, seriesCount);
    return (
      <>
        {data.series.map((s, si) => {
          const color = PALETTE[si % PALETTE.length];
          return s.values.map((v, i) => {
            if (vertical) {
              const gx = i * groupW + (groupW - barW * seriesCount) / 2 + si * barW;
              const y = yFor(Math.max(v, 0));
              const h = Math.abs(yFor(v) - yFor(0));
              return <rect key={`${si}-${i}`} x={gx} y={y} width={barW - 1} height={h} fill={color} />;
            } else {
              const gy = i * groupW + (groupW - barW * seriesCount) / 2 + si * barW;
              const x = ((Math.min(v, 0) - min) / span) * innerW;
              const w = (Math.abs(v) / span) * innerW;
              return <rect key={`${si}-${i}`} x={x} y={gy} width={w} height={barW - 1} fill={color} />;
            }
          });
        })}
      </>
    );
  };

  return (
    <div
      className="oo-chart"
      style={{ left: chart.x, top: chart.y, width: chart.w, height: chart.h }}
    >
      <div className="oo-chart-head" onMouseDown={onMoveStart}>
        <span className="oo-chart-title">{chart.title ?? `${chart.kind.toUpperCase()} chart`}</span>
        {onRemove && (
          <button
            className="oo-chart-close"
            aria-label="Remove chart"
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        )}
      </div>
      <svg width={chart.w} height={chart.h - 24} role="img" aria-label={chart.title ?? "chart"}>
        <g transform={`translate(${padding.l},${padding.t})`}>
          {/* axis */}
          <line x1={0} y1={yFor(0)} x2={innerW} y2={yFor(0)} stroke="hsl(var(--border))" />
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="hsl(var(--border))" />
          {chart.kind === "line" && renderLine()}
          {chart.kind === "column" && renderBars(true)}
          {chart.kind === "bar" && renderBars(false)}
        </g>
        {/* legend */}
        <g transform={`translate(${padding.l},8)`}>
          {data.series.map((s, si) => (
            <g key={si} transform={`translate(${si * 90},0)`}>
              <rect width="10" height="10" fill={PALETTE[si % PALETTE.length]} />
              <text x={14} y={9} fontSize="10" fill="currentColor">{s.name}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
