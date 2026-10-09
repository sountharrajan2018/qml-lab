import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const REPLAY_MS = 5000;

/** The QCNN training curve, with a Replay button that redraws it over 5 seconds. */
export default function LossCurve({ loss }: { loss: number[] }) {
  const [shown, setShown] = useState(loss.length);

  useEffect(() => {
    if (shown >= loss.length) return;
    const step = Math.max(1, Math.round(loss.length / (REPLAY_MS / 40)));
    const t = setTimeout(() => setShown((s) => Math.min(loss.length, s + step)), 40);
    return () => clearTimeout(t);
  }, [shown, loss.length]);

  const data = loss.slice(0, shown).map((v, i) => ({ step: i + 1, v }));
  const top = Math.ceil(Math.max(...loss) * 2) / 2;
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid stroke="#27272a" />
          <XAxis
            dataKey="step"
            type="number"
            domain={[1, loss.length]}
            tick={{ fill: "#d4d4d8", fontSize: 16 }}
            stroke="#52525b"
            label={{ value: "training step", position: "insideBottom", offset: -18, fill: "#a1a1aa", fontSize: 16 }}
          />
          <YAxis
            domain={[0, top]}
            tick={{ fill: "#d4d4d8", fontSize: 16 }}
            stroke="#52525b"
            label={{ value: "how wrong", angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 16 }}
          />
          <Line dataKey="v" stroke="#22d3ee" strokeWidth={3} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-6">
        <button
          onClick={() => setShown(1)}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-lg font-semibold text-black hover:bg-cyan-300"
        >
          Replay training
        </button>
        <span className="text-xl text-zinc-200">
          Step {Math.min(shown, loss.length)} of {loss.length} · how wrong: {data.at(-1)?.v.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
