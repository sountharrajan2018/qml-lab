import { BAD, GREY, GROUP_COLORS, OK } from "./colors";

export interface Dot {
  x: number;
  y: number;
  group: number | null; // null = no label shown (grey)
  ring?: boolean;
  mark?: "ok" | "bad";
}

interface Regions {
  xs: number[];
  ys: number[];
  labels: number[][]; // labels[row of ys][col of xs]
}

const W = 600;
const H = 470;
const PAD = 36;

function Shape({ group, cx, cy, r }: { group: number | null; cx: number; cy: number; r: number }) {
  const fill = group === null ? GREY : GROUP_COLORS[group];
  const common = { fill, stroke: "#000", strokeWidth: 1.5 };
  if (group === 1) return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} {...common} />;
  if (group === 2)
    return <polygon points={`${cx},${cy - r * 1.2} ${cx - r * 1.1},${cy + r * 0.8} ${cx + r * 1.1},${cy + r * 0.8}`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

/** Scatter plot of 2-number dots, optionally over the regions a classifier picks. */
export default function Plot({ dots, regions, names }: { dots: Dot[]; regions?: Regions; names?: string[] }) {
  const xsAll = dots.map((d) => d.x).concat(regions ? [regions.xs[0], regions.xs.at(-1)!] : []);
  const ysAll = dots.map((d) => d.y).concat(regions ? [regions.ys[0], regions.ys.at(-1)!] : []);
  const [x0, x1] = [Math.min(...xsAll), Math.max(...xsAll)];
  const [y0, y1] = [Math.min(...ysAll), Math.max(...ysAll)];
  const px = (x: number) => PAD + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * PAD);
  const py = (y: number) => H - PAD - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);

  const cells = [];
  if (regions) {
    const dx = (px(regions.xs[1]) - px(regions.xs[0])) / 2;
    const dy = (py(regions.ys[0]) - py(regions.ys[1])) / 2;
    for (let r = 0; r < regions.ys.length; r++)
      for (let c = 0; c < regions.xs.length; c++)
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={px(regions.xs[c]) - dx}
            y={py(regions.ys[r]) - dy}
            width={2 * dx + 0.5}
            height={2 * dy + 0.5}
            fill={GROUP_COLORS[regions.labels[r][c]]}
            opacity={0.22}
            shapeRendering="crispEdges"
          />,
        );
  }
  const groups = [...new Set(dots.map((d) => d.group))].filter((g): g is number => g !== null).sort();

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="max-h-[60vh] w-full" role="img" aria-label="Scatter plot of the dots">
        <rect x={PAD / 2} y={PAD / 2} width={W - PAD} height={H - PAD} fill="none" stroke="#3f3f46" />
        {cells}
        {dots.map((d, i) => (
          <g key={i}>
            {d.ring && <circle cx={px(d.x)} cy={py(d.y)} r={15} fill="none" stroke="#fff" strokeWidth={3} />}
            <Shape group={d.group} cx={px(d.x)} cy={py(d.y)} r={8} />
            {d.mark && (
              <text x={px(d.x) + 11} y={py(d.y) - 9} fill={d.mark === "ok" ? OK : BAD} fontSize={20} fontWeight={700}>
                {d.mark === "ok" ? "✓" : "✗"}
              </text>
            )}
          </g>
        ))}
      </svg>
      {names && groups.length > 0 && (
        <div className="flex flex-wrap gap-6 text-lg text-zinc-200">
          {groups.map((g) => (
            <span key={g} className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6">
                <Shape group={g} cx={12} cy={12} r={8} />
              </svg>
              {names[g]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
