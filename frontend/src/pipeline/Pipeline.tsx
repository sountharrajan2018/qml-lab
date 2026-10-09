import katex from "katex";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../api";
import { fmt } from "../data";
import Circuit, { fitSvg } from "../panels/Circuit";
import Numbers from "../panels/Numbers";
import KernelGrid from "./KernelGrid";
import LossCurve from "./LossCurve";
import Pictures from "./Pictures";
import Plot, { type Dot } from "./Plot";
import { ALGORITHMS, STEP_NAMES, STEPS, type Code } from "./text";
import type { Algorithm, PipelineResult } from "./types";

const OFFLINE = "Cannot reach the server. It may still be waking up, so try again in a moment.";

function Tex({ latex, block = true }: { latex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(latex, { displayMode: block, throwOnError: false }),
    [latex, block],
  );
  return <div className="overflow-x-auto text-white" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Details({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex flex-col gap-3 text-lg leading-relaxed text-zinc-200">
      {paragraphs.map((p, i) =>
        p.startsWith("$$") ? <Tex key={i} latex={p.slice(2, -2)} /> : <p key={i}>{p}</p>,
      )}
    </div>
  );
}

function CodeTabs({ code }: { code: Code }) {
  const tabs = (["qiskit", "pennylane", "python"] as const).filter((t) => code[t]);
  const [tab, setTab] = useState(tabs[0]);
  const active = code[tab] ? tab : tabs[0];
  const names = { qiskit: "Qiskit", pennylane: "PennyLane", python: "Python" };
  return (
    <div className="rounded-xl border border-zinc-800 bg-black">
      <div className="flex gap-2 border-b border-zinc-800 p-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-lg font-semibold ${
              active === t ? "bg-zinc-200 text-black" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {names[t]}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto p-4 text-base leading-relaxed text-zinc-100">
        <code>{code[active]}</code>
      </pre>
    </div>
  );
}

function ScoreCards({ data }: { data: PipelineResult }) {
  const { quantum, classical } = data.result;
  const card = (title: string, s: { correct: number; total: number; percent: number }, accent: boolean) => (
    <div className={`rounded-2xl border p-5 ${accent ? "border-cyan-400 bg-cyan-400/10" : "border-zinc-700 bg-zinc-900"}`}>
      <p className="text-lg font-semibold text-zinc-300">{title}</p>
      <p className="mt-1 font-mono text-5xl font-bold text-white">
        {s.correct}
        <span className="text-3xl text-zinc-400"> / {s.total}</span>
      </p>
      <p className="text-xl text-zinc-300">{s.percent}% correct</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      {card(ALGORITHMS.find((a) => a.id === data.algorithm)!.tab, quantum, true)}
      {card(classical.name, classical, false)}
    </div>
  );
}

/** Everything drawn on the left for one algorithm and one step (0-5). */
function Visual({
  data,
  step,
  pair,
  setPair,
}: {
  data: PipelineResult;
  step: number;
  pair: [number, number] | null;
  setPair: (p: [number, number]) => void;
}) {
  const { algorithm, train, test, example, result, learn, kernel } = data;
  const names = data.class_names;
  const trainDots = (group: (i: number) => number | null, ring?: (i: number) => boolean): Dot[] =>
    train.X.map((p, i) => ({ x: p[0], y: p[1], group: group(i), ring: ring?.(i) }));

  if (algorithm === "qcnn") {
    if (step === 0)
      return <Pictures items={train.X.map((p, i) => ({ pixels: p, caption: names[train.y[i]] }))} />;
    if (step === 1)
      return (
        <Numbers row={example.raw} columns={[]} scaled={example.scaled} scaledLabel="Divided by their total length" />
      );
    if (step === 2)
      return <Circuit svg={example.circuit_svg} gateCount={example.gate_count} nQubits={example.n_qubits} isAmplitude />;
    if (step === 3)
      return (
        <div className="flex flex-col gap-4">
          <div
            className="overflow-x-auto rounded-xl bg-black p-2"
            dangerouslySetInnerHTML={{ __html: fitSvg(data.model_circuit!.svg) }}
          />
          <p className="text-2xl font-semibold text-white">{data.model_circuit!.n_dials} dials, 4 qubits → 1 answer.</p>
        </div>
      );
    if (step === 4) return <LossCurve loss={learn.loss!} />;
    return (
      <Pictures
        big
        items={test.X.map((p, i) => {
          const guess = result.predictions[i];
          const chance = result.chances![i];
          return {
            pixels: p,
            caption: names[guess],
            mark: guess === test.y[i] ? "ok" : "bad",
            sub: `${Math.round(100 * (guess ? chance : 1 - chance))}% sure`,
          };
        })}
      />
    );
  }

  const labelled = algorithm === "qsvm";
  const label = (i: number) => (labelled ? train.y[i] : null);
  if (step === 0) return <Plot dots={trainDots(label)} names={names} />;
  if (step === 1) return <Plot dots={trainDots(label, (i) => i === example.index)} names={names} />;
  if (step === 2)
    return <Circuit svg={example.circuit_svg} gateCount={example.gate_count} nQubits={example.n_qubits} isAmplitude={false} />;
  if (step === 3)
    return (
      <KernelGrid
        matrix={kernel!.matrix}
        order={kernel!.order}
        groups={labelled ? train.y : undefined}
        selected={pair}
        onSelect={setPair}
      />
    );
  if (algorithm === "qsvm") {
    const support = new Set(learn.support);
    if (step === 4) return <Plot dots={trainDots(label, (i) => support.has(i))} regions={learn.grid} names={names} />;
    return (
      <Plot
        regions={learn.grid}
        names={names}
        dots={test.X.map((p, i) => ({
          x: p[0],
          y: p[1],
          group: test.y[i],
          mark: result.predictions[i] === test.y[i] ? "ok" : "bad",
        }))}
      />
    );
  }
  // clustering
  const groups = learn.groups!;
  if (step === 4)
    return (
      <div className="grid grid-cols-2 items-start gap-6">
        <KernelGrid matrix={kernel!.matrix} order={learn.order!} groups={groups} />
        <Plot dots={trainDots((i) => groups[i])} names={["group 1", "group 2", "group 3"]} />
      </div>
    );
  return (
    <Plot
      names={names}
      dots={train.X.map((p, i) => ({
        x: p[0],
        y: p[1],
        group: groups[i],
        mark: groups[i] === train.y[i] ? "ok" : "bad",
      }))}
    />
  );
}

/** Step-specific facts shown on the right, under the sentence. */
function Extra({ data, step, pair }: { data: PipelineResult; step: number; pair: [number, number] | null }) {
  const { algorithm, example, columns, kernel } = data;
  if (step === 5) return <ScoreCards data={data} />;
  if (algorithm !== "qcnn" && step === 1)
    return (
      <div className="flex flex-col gap-3">
        {example.raw.map((v, i) => (
          <p key={i} className="font-mono text-3xl text-white">
            <span className="mr-3 text-xl text-zinc-400">{columns[i]}</span>
            {fmt(v)} <span className="text-zinc-500">→</span> <span className="text-cyan-300">{fmt(example.scaled[i])}</span>
          </p>
        ))}
      </div>
    );
  if (algorithm !== "qcnn" && step === 3)
    return pair ? (
      <p className="text-2xl text-white">
        Dot {pair[0] + 1} and dot {pair[1] + 1}:{" "}
        <span className="font-mono font-bold text-cyan-300">{kernel!.matrix[pair[0]][pair[1]].toFixed(2)}</span> alike
        {pair[0] === pair[1] && <span className="text-zinc-400"> (a dot is always identical to itself)</span>}
      </p>
    ) : (
      <p className="text-xl text-zinc-400">Click a square to compare two dots.</p>
    );
  if (algorithm === "qcnn" && step === 4)
    return (
      <p className="text-2xl text-white">
        After training it gets{" "}
        <span className="font-mono font-bold text-cyan-300">
          {data.learn.train_correct} of {data.train.X.length}
        </span>{" "}
        learning pictures right.
      </p>
    );
  return null;
}

export default function Pipeline({ onOpenEncodings }: { onOpenEncodings?: () => void }) {
  const [algorithm, setAlgorithm] = useState<Algorithm>("qsvm");
  const [step, setStep] = useState(0);
  const [cache, setCache] = useState<Partial<Record<Algorithm, PipelineResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [drawer, setDrawer] = useState<"details" | "code" | null>(null);
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [presenter, setPresenter] = useState(() => document.documentElement.classList.contains("presenter"));

  const data = cache[algorithm];
  const text = STEPS[algorithm][step];

  useEffect(() => {
    api.wake();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("presenter", presenter);
  }, [presenter]);

  useEffect(() => {
    if (cache[algorithm]) return;
    const ctrl = new AbortController();
    api
      .pipeline(algorithm, ctrl.signal)
      .then((r) => {
        setCache((c) => ({ ...c, [algorithm]: r }));
        setError(null);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError(OFFLINE);
      });
    return () => ctrl.abort();
  }, [algorithm, cache, retry]);

  const goto = useCallback((s: number) => {
    setStep(Math.max(0, Math.min(5, s)));
    setPair(null);
  }, []);

  const pick = useCallback((a: Algorithm) => {
    setAlgorithm(a);
    setStep(0);
    setPair(null);
    setDrawer(null);
  }, []);

  // Shortcuts: arrows and E move between steps, 1-3 pick the algorithm, P = presenter.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowright" || key === "arrowdown" || key === "e") goto(step + 1);
      else if (key === "arrowleft" || key === "arrowup") goto(step - 1);
      else if (/^[1-3]$/.test(key)) pick(ALGORITHMS[Number(key) - 1].id);
      else if (key === "p") setPresenter((p) => !p);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, goto, pick]);

  const stepNames = STEP_NAMES.map((n, i) => (algorithm === "qcnn" && i === 3 ? "No kernel" : n));

  return (
    <div className="min-h-screen bg-black px-8 py-6 text-zinc-100">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="mr-4 text-2xl font-bold text-white">QML Pipeline</h1>
        <nav className="flex gap-2">
          {ALGORITHMS.map((a, i) => (
            <button
              key={a.id}
              onClick={() => pick(a.id)}
              title={`Key ${i + 1}`}
              className={`rounded-xl px-5 py-3 text-xl font-semibold ${
                algorithm === a.id ? "bg-cyan-400 text-black" : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {a.tab}
            </button>
          ))}
        </nav>
        <p className="text-xl text-zinc-300">{ALGORITHMS.find((a) => a.id === algorithm)!.headline}</p>
        {onOpenEncodings && (
          <button
            onClick={onOpenEncodings}
            className="ml-auto rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            ← Encodings
          </button>
        )}
      </header>

      {/* The pipeline itself: always visible, so everyone knows where we are */}
      <ol className="mt-5 flex flex-wrap items-center gap-2">
        {stepNames.map((name, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              onClick={() => goto(i)}
              className={`rounded-full px-4 py-2 text-lg font-semibold ${
                i === step
                  ? "bg-white text-black"
                  : i < step
                    ? "bg-cyan-400/20 text-cyan-200 hover:bg-cyan-400/30"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              } ${algorithm === "qcnn" && i === 3 ? "border border-dashed border-zinc-500" : ""}`}
            >
              {i + 1} {name}
            </button>
            {i < 5 && <span className="text-2xl text-zinc-600">→</span>}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-4 rounded-xl bg-amber-300/15 px-4 py-3 text-xl text-amber-100">
          {error}{" "}
          <button className="ml-2 font-semibold underline" onClick={() => setRetry((r) => r + 1)}>
            Try again
          </button>
        </p>
      )}

      {!data ? (
        !error && <p className="mt-10 text-2xl text-zinc-400">Running the pipeline…</p>
      ) : (
        <main className="mt-6 grid grid-cols-[1.5fr_1fr] gap-6">
          <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <Visual data={data} step={step} pair={pair} setPair={setPair} />
            <p className="mt-4 text-lg text-zinc-300">{text.look}</p>
          </section>

          <section className="flex min-w-0 flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-lg font-semibold text-zinc-400">
              Step {step + 1} of 6 · {text.title}
            </p>
            <p className="text-3xl font-bold leading-snug text-white">{text.sentence}</p>
            <Extra data={data} step={step} pair={pair} />
            {text.formula && <Tex latex={text.formula} />}
            <div className="mt-auto flex flex-wrap gap-3">
              {(["details", "code"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDrawer((cur) => (cur === d ? null : d))}
                  className={`rounded-xl px-5 py-3 text-lg font-semibold ${
                    drawer === d ? "bg-zinc-200 text-black" : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {d === "details" ? "Show details" : "Show code"}
                </button>
              ))}
              <div className="ml-auto flex gap-3">
                <button
                  onClick={() => goto(step - 1)}
                  disabled={step === 0}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
                >
                  ← Back
                </button>
                <button
                  onClick={() => goto(step + 1)}
                  disabled={step === 5}
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-lg font-semibold text-black hover:bg-cyan-300 disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          </section>

          {drawer && (
            <section className="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              {drawer === "details" ? <Details paragraphs={text.details} /> : <CodeTabs key={`${algorithm}-${step}`} code={text.code} />}
            </section>
          )}
        </main>
      )}
    </div>
  );
}

