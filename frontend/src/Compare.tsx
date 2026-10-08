import type { CompareResult } from "./api";
import { ENCODINGS } from "./explain";
import { Bars } from "./panels/Qubits";

/** All five encodings for the same row: what each one costs, in one look. */
export default function Compare({ results }: { results: CompareResult[] | null }) {
  if (!results) return <p className="p-10 text-2xl text-zinc-400">Loading all five encodings…</p>;
  const byId = new Map(results.map((r) => [r.encoding, r]));
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="mb-4 text-lg text-zinc-300">The same row, put into qubits five different ways.</p>
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr>
            <th className="w-44" />
            {ENCODINGS.map((e) => (
              <th key={e.id} className="px-3 pb-3 text-2xl font-bold text-white">
                {e.tab}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-3xl">
          <tr className="border-t border-zinc-800">
            <th className="py-4 text-lg font-semibold text-zinc-400">Qubits used</th>
            {ENCODINGS.map((e) => (
              <td key={e.id} className="px-3 py-4 font-mono">
                {byId.get(e.id)?.message ? "–" : byId.get(e.id)?.n_qubits}
              </td>
            ))}
          </tr>
          <tr className="border-t border-zinc-800">
            <th className="py-4 text-lg font-semibold text-zinc-400">Gates</th>
            {ENCODINGS.map((e) => (
              <td key={e.id} className="px-3 py-4 font-mono">
                {byId.get(e.id)?.gate_count ?? "–"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-zinc-800 align-top">
            <th className="py-4 text-lg font-semibold text-zinc-400">Chance of seeing each result</th>
            {ENCODINGS.map((e) => {
              const r = byId.get(e.id);
              return (
                <td key={e.id} className="px-1 py-4">
                  {r?.probabilities ? (
                    <Bars bars={r.probabilities} compact />
                  ) : (
                    <p className="text-lg text-amber-200">{r?.message}</p>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
