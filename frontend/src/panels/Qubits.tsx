import { useId } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { Bar as BarData, Bloch } from "../api";

const BAR_COLOR = "#22d3ee"; // saturated cyan, readable on a projector
const ARROW_COLOR = "#f472b6";

const percent = (p: number) => `${Math.round(p * 100)}%`;

/** "Chance of seeing each result" bars. Compact mode is the small chart in Compare. */
export function Bars({ bars, compact = false }: { bars: BarData[]; compact?: boolean }) {
  const data = bars.map((b) => ({ name: `|${b.label}⟩`, value: b.p }));
  const many = data.length > 8;
  const fontSize = compact ? 13 : many ? 15 : 20;
  return (
    <ResponsiveContainer width="100%" height={compact ? 150 : many ? 330 : 300}>
      <BarChart data={data} margin={{ top: compact ? 8 : 34, right: 8, bottom: 0, left: compact ? 0 : 8 }}>
        <XAxis
          dataKey="name"
          interval={0}
          angle={many ? -60 : 0}
          textAnchor={many ? "end" : "middle"}
          height={many ? (compact ? 48 : 70) : 32}
          tick={{ fill: "#e4e4e7", fontSize, fontFamily: "ui-monospace, monospace" }}
          stroke="#52525b"
          hide={compact && many}
        />
        <YAxis
          domain={[0, 1]}
          ticks={[0, 0.5, 1]}
          tickFormatter={percent}
          tick={{ fill: "#a1a1aa", fontSize: compact ? 12 : 16 }}
          stroke="#52525b"
          width={compact ? 40 : 56}
        />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {!compact && !many && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v) => percent(Number(v))}
              fill="#ffffff"
              fontSize={20}
              fontWeight={700}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** One qubit drawn on its own: up is 0, down is 1, the arrow is the qubit. */
export function BlochSphere({ vector, index }: { vector: Bloch; index: number }) {
  const id = useId();
  const r = 44;
  const c = 60;
  // Up/down is the 0-1 axis; left/right shows the tilt. Depth (y) is drawn at a slant.
  const tipX = c + r * (vector.x - 0.35 * vector.y);
  const tipY = c - r * (vector.z - 0.35 * vector.y);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 130" className="h-36 w-32" role="img" aria-label={`Qubit ${index}`}>
        <defs>
          <marker id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={ARROW_COLOR} />
          </marker>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#71717a" strokeWidth="1.5" />
        <ellipse cx={c} cy={c} rx={r} ry={r * 0.3} fill="none" stroke="#52525b" strokeDasharray="3 3" />
        <line x1={c} y1={c - r} x2={c} y2={c + r} stroke="#52525b" />
        <text x={c} y={c - r - 4} textAnchor="middle" fill="#e4e4e7" fontSize="13">
          |0⟩
        </text>
        <text x={c} y={c + r + 15} textAnchor="middle" fill="#e4e4e7" fontSize="13">
          |1⟩
        </text>
        <line
          x1={c}
          y1={c}
          x2={tipX}
          y2={tipY}
          stroke={ARROW_COLOR}
          strokeWidth="5"
          strokeLinecap="round"
          markerEnd={`url(#${CSS.escape(id)})`}
        />
        <circle cx={c} cy={c} r="3" fill="#e4e4e7" />
      </svg>
      <figcaption className="font-mono text-xl text-zinc-200">q{index}</figcaption>
    </figure>
  );
}

export default function Qubits({ bars, bloch }: { bars: BarData[]; bloch: Bloch[] | null }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-zinc-400">Chance of seeing each result</h3>
      <Bars bars={bars} />
      {bloch && (
        <div className="flex flex-wrap justify-center gap-4 border-t border-zinc-800 pt-4">
          {bloch.map((v, i) => (
            <BlochSphere key={i} vector={v} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
