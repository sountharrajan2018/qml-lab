import { fmt, isPicture } from "../data";

function Picture({ values }: { values: number[] }) {
  const top = Math.max(...values, 1e-9);
  return (
    <div className="grid w-48 grid-cols-4 gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-sm border border-zinc-600"
          style={{ background: `rgba(255,255,255,${v / top})` }}
          title={fmt(v)}
        />
      ))}
    </div>
  );
}

function Chips({ values, names, accent }: { values: number[]; names?: string[]; accent?: boolean }) {
  const grid = values.length === 16;
  return (
    <div className={grid ? "grid w-fit grid-cols-4 gap-2" : "flex flex-wrap gap-3"}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center">
          {names && <span className="mb-1 text-sm text-zinc-500">{names[i]}</span>}
          <span
            className={`rounded-lg px-3 py-1 font-mono ${grid ? "text-lg" : "text-3xl"} ${
              accent ? "bg-cyan-400/15 text-cyan-300" : "bg-zinc-800 text-white"
            }`}
          >
            {fmt(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Numbers({
  row,
  columns,
  scaled,
  scaledLabel,
}: {
  row: number[];
  columns: string[];
  scaled: number[] | null;
  scaledLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-zinc-400">Your numbers</h3>
      {isPicture(row) ? <Picture values={row} /> : <Chips values={row} names={columns} />}
      {scaled && (
        <>
          <div className="text-5xl leading-none text-zinc-500" aria-hidden>
            ↓
          </div>
          <h3 className="text-lg font-semibold text-cyan-300">{scaledLabel}</h3>
          <Chips values={scaled} accent />
        </>
      )}
    </div>
  );
}
