import { GROUP_COLORS, heat } from "./colors";

/**
 * The kernel as a coloured table: row i, column j = how alike dots i and j are.
 * `order` lists dot numbers in the order to draw them; `groups` colours the side strips.
 */
export default function KernelGrid({
  matrix,
  order,
  groups,
  selected,
  onSelect,
}: {
  matrix: number[][];
  order: number[];
  groups?: number[];
  selected?: [number, number] | null;
  onSelect?: (pair: [number, number]) => void;
}) {
  const n = order.length;
  const size = 480;
  const strip = groups ? 12 : 0;
  const cell = size / n;
  const pos = new Map(order.map((dot, k) => [dot, k]));
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size + strip + 2} ${size + strip + 2}`} className="max-h-[62vh] w-full max-w-[560px]" role="img" aria-label="Kernel grid">
        {groups &&
          order.map((dot, k) => (
            <g key={`s${k}`}>
              <rect x={strip + k * cell} y={0} width={cell} height={strip - 3} fill={GROUP_COLORS[groups[dot]]} />
              <rect x={0} y={strip + k * cell} width={strip - 3} height={cell} fill={GROUP_COLORS[groups[dot]]} />
            </g>
          ))}
        {order.map((a, r) =>
          order.map((b, c) => (
            <rect
              key={`${r}-${c}`}
              x={strip + c * cell}
              y={strip + r * cell}
              width={cell + 0.3}
              height={cell + 0.3}
              fill={heat(matrix[a][b])}
              shapeRendering="crispEdges"
              onClick={onSelect ? () => onSelect([a, b]) : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          )),
        )}
        {selected && (
          <rect
            x={strip + pos.get(selected[1])! * cell - 1}
            y={strip + pos.get(selected[0])! * cell - 1}
            width={cell + 2}
            height={cell + 2}
            fill="none"
            stroke="#fff"
            strokeWidth={3}
          />
        )}
      </svg>
      <div className="flex items-center gap-3 text-base text-zinc-300">
        <span>different</span>
        <span
          className="h-4 w-48 rounded"
          style={{ background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(heat).join(",")})` }}
        />
        <span>alike</span>
      </div>
    </div>
  );
}
