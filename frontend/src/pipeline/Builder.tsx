import katex from "katex";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "../api";
import { fmt, loadBundled, parseCsv, type Dataset, type Limits } from "../data";
import Circuit from "../panels/Circuit";
import {
  ALGORITHM_CHOICES,
  ENCODING_CHOICES,
  KERNEL_CHOICES,
  pick,
  pipelineCode,
  type AlgorithmId,
  type EncodingId,
  type KernelId,
} from "./builderText";
import { BAD, GROUP_COLORS, OK } from "./colors";
import KernelGrid from "./KernelGrid";
import LossCurve from "./LossCurve";
import Plot from "./Plot";

const LIMITS: Limits = { rows: 60, columns: 10 };
const SAMPLES = [
  { id: "student", name: "Students: will they pass?" },
  { id: "healthcare", name: "Healthcare: diabetes risk" },
  { id: "finance", name: "Finance: loan approval" },
  { id: "moons", name: "Two moons (2 numbers)" },
];
const OFFLINE = "Cannot reach the server. It may still be waking up, so try again in a moment.";
type Tab = "data" | "encoding" | "kernel" | "result";

function Tex({ latex }: { latex: string }) {
  const html = useMemo(() => katex.renderToString(latex, { displayMode: true, throwOnError: false }), [latex]);
  return <div className="overflow-x-auto text-white [&_.katex]:text-[1.15em]" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** One numbered menu on the left: a drop-down plus its plain sentence. */
function Menu({
  n,
  title,
  active,
  children,
  onFocus,
}: {
  n: number;
  title: string;
  active: boolean;
  children: ReactNode;
  onFocus: () => void;
}) {
  return (
    <section
      onClick={onFocus}
      className={`rounded-2xl border p-5 ${active ? "border-cyan-400 bg-cyan-400/5" : "border-zinc-800 bg-zinc-950"}`}
    >
      <h2 className="mb-3 text-xl font-bold text-white">
        <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-lg text-black">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { id: T; name: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value as T);
        e.target.blur();
      }}
      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white disabled:opacity-40"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function DataTable({ data, highlight }: { data: Dataset; highlight?: Map<number, "ok" | "bad"> }) {
  const shown = highlight ? [...highlight.keys()] : data.rows.slice(0, 10).map((_, i) => i);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-base">
        <thead>
          <tr className="text-sm text-zinc-400">
            <th className="px-2 py-1">row</th>
            {data.columns.map((c) => (
              <th key={c} className="px-2 py-1">
                {c}
              </th>
            ))}
            {data.labels && <th className="px-2 py-1">{data.labelName}</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((i) => (
            <tr key={i} className="border-t border-zinc-800 text-zinc-100">
              <td className="px-2 py-1 text-zinc-500">{i + 1}</td>
              {data.rows[i].map((v, j) => (
                <td key={j} className="px-2 py-1">
                  {fmt(v)}
                </td>
              ))}
              {data.labels && <td className="px-2 py-1 text-cyan-200">{data.labels[i]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!highlight && data.rows.length > 10 && (
        <p className="mt-2 text-zinc-400">…and {data.rows.length - 10} more rows.</p>
      )}
    </div>
  );
}

function ScoreCard({ title, score, accent, sub }: { title: string; score: { correct: number; total: number; percent: number }; accent?: boolean; sub?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-cyan-400 bg-cyan-400/10" : "border-zinc-700 bg-zinc-900"}`}>
      <p className="text-lg font-semibold text-zinc-300">{title}</p>
      <p className="mt-1 font-mono text-5xl font-bold text-white">
        {score.correct}
        <span className="text-3xl text-zinc-400"> / {score.total}</span>
      </p>
      <p className="text-xl text-zinc-300">
        {score.percent}% correct{sub && <span className="text-zinc-400"> · {sub}</span>}
      </p>
    </div>
  );
}

function Result({ data, result }: { data: Dataset; result: api.BuilderResult }) {
  const [xi, setXi] = useState(0);
  const [yi, setYi] = useState(Math.min(1, data.columns.length - 1));
  const alg = pick(ALGORITHM_CHOICES, result.algorithm as AlgorithmId);
  const clustering = result.algorithm === "qclustering";
  const truth = data.labels ? data.labels.map((l) => result.classes.indexOf(l)) : null;
  const names = clustering ? ["group 1", "group 2", "group 3", "group 4"] : result.classes;
  const marks = new Map(
    result.test_index.map((row, k) => [row, truth ? (result.predictions[k] === truth[row] ? "ok" : "bad") : "ok"] as const),
  );
  return (
    <div className="flex flex-col gap-6">
      {result.quantum ? (
        <div className="grid grid-cols-2 gap-4">
          <ScoreCard title={alg.name} score={result.quantum} accent sub={`${result.seconds} s`} />
          {result.classical.score && <ScoreCard title={result.classical.name} score={result.classical.score} />}
        </div>
      ) : (
        <p className="text-2xl text-white">
          Found {new Set(result.predictions).size} groups in {result.seconds} s. Without a label column there is no
          answer to check them against.
        </p>
      )}
      <p className="text-xl text-zinc-200">
        {clustering
          ? "Every row was grouped without looking at its label. ✓ means it landed in the group that matches its label."
          : `Learned from ${result.train_index.length} rows, then tested on ${result.test_index.length} rows it had never seen.`}
      </p>

      {data.columns.length >= 1 && (
        <div className="grid grid-cols-[1.3fr_1fr] gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-lg text-zinc-300">
              Plot
              <select value={xi} onChange={(e) => setXi(Number(e.target.value))} className="rounded-lg bg-zinc-900 px-2 py-1 text-white" aria-label="Across">
                {data.columns.map((c, i) => (
                  <option key={c} value={i}>
                    {c}
                  </option>
                ))}
              </select>
              against
              <select value={yi} onChange={(e) => setYi(Number(e.target.value))} className="rounded-lg bg-zinc-900 px-2 py-1 text-white" aria-label="Up">
                {data.columns.map((c, i) => (
                  <option key={c} value={i}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Plot
              names={names}
              dots={result.test_index.map((row, k) => ({
                x: data.rows[row][xi],
                y: data.rows[row][yi],
                group: result.predictions[k] % GROUP_COLORS.length,
                mark: truth ? marks.get(row) : undefined,
              }))}
            />
            <p className="mt-1 text-zinc-400">
              Colour and shape = the {clustering ? "group found" : "guess"}; ✓ / ✗ = right or wrong. Only the{" "}
              {clustering ? "" : "unseen "}rows are shown.
            </p>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="text-sm text-zinc-400">
                  <th className="px-2 py-1">row</th>
                  {truth && <th className="px-2 py-1">{data.labelName}</th>}
                  <th className="px-2 py-1">{clustering ? "group" : "guess"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.test_index.map((row, k) => (
                  <tr key={row} className="border-t border-zinc-800">
                    <td className="px-2 py-1 font-mono text-zinc-500">{row + 1}</td>
                    {truth && <td className="px-2 py-1 text-zinc-100">{data.labels![row]}</td>}
                    <td className="px-2 py-1 text-white">{names[result.predictions[k]]}</td>
                    <td className="px-2 py-1 text-xl font-bold" style={{ color: marks.get(row) === "ok" ? OK : BAD }}>
                      {truth ? (marks.get(row) === "ok" ? "✓" : "✗") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.loss && (
        <div>
          <h3 className="mb-2 text-xl font-bold text-white">How the QNN learned ({result.n_dials} dials)</h3>
          <LossCurve loss={result.loss} />
        </div>
      )}
    </div>
  );
}

export default function Builder({
  onOpenEncodings,
  onOpenGuided,
}: {
  onOpenEncodings?: () => void;
  onOpenGuided?: () => void;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataId, setDataId] = useState("student");
  const [encoding, setEncoding] = useState<EncodingId>("angle");
  const [kernel, setKernel] = useState<KernelId>("fidelity");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("qsvm");
  const [tab, setTab] = useState<Tab>("data");
  const [preview, setPreview] = useState<api.BuilderPreview | null>(null);
  const [result, setResult] = useState<api.BuilderResult | null>(null);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const data = datasets.find((d) => d.id === dataId);
  const usesKernel = algorithm !== "qnn";
  const qubits = data ? (encoding === "amplitude" ? Math.max(1, Math.ceil(Math.log2(data.columns.length))) : data.columns.length) : 0;

  useEffect(() => {
    api.wake();
    Promise.all(SAMPLES.map((s) => loadBundled(s.id, s.name, "datasets/samples", LIMITS)))
      .then(setDatasets)
      .catch(() => setProblem("The sample datasets could not be loaded."));
  }, []);

  // Any change of choice clears the old result.
  useEffect(() => {
    setResult(null);
    setProblem(null);
  }, [dataId, encoding, kernel, algorithm, datasets]);

  // Encoding preview: the circuit for the first row.
  useEffect(() => {
    if (!data) return;
    const ctrl = new AbortController();
    setPreview(null);
    api
      .builderEncode(encoding, data.rows, ctrl.signal)
      .then(setPreview)
      .catch((e) => {
        if (!ctrl.signal.aborted) setProblem(e instanceof api.RuleError ? e.message : OFFLINE);
      });
    return () => ctrl.abort();
  }, [data, encoding]);

  async function run() {
    if (!data) return;
    setRunning(true);
    setProblem(null);
    try {
      const r = await api.builderRun({ X: data.rows, labels: data.labels, encoding, kernel, algorithm });
      setResult(r);
      setTab("result");
    } catch (e) {
      setProblem(e instanceof api.RuleError ? e.message : OFFLINE);
    } finally {
      setRunning(false);
    }
  }

  async function onUpload(file: File) {
    const id = `upload:${file.name}`;
    const parsed = parseCsv(await file.text(), id, `Your file: ${file.name}`, LIMITS);
    if ("error" in parsed) {
      setUploadError(parsed.error);
      return;
    }
    setUploadError(null);
    setDatasets((list) => [...list.filter((d) => d.id !== id), parsed.dataset]);
    setDataId(id);
    setTab("data");
  }

  const encodingText = pick(ENCODING_CHOICES, encoding);
  const kernelText = pick(KERNEL_CHOICES, kernel);
  const algorithmText = pick(ALGORITHM_CHOICES, algorithm);
  const classes = data?.labels ? [...new Set(data.labels)] : [];
  const csvName = data && !data.id.startsWith("upload:") ? `${data.id}.csv` : (data?.id.slice(7) ?? "data.csv");

  const tabs: { id: Tab; label: string }[] = [
    { id: "data", label: "1 Data" },
    { id: "encoding", label: "2 Encoding" },
    { id: "kernel", label: usesKernel ? "3 Kernel" : "3 No kernel" },
    { id: "result", label: "4 Result" },
  ];

  return (
    <div className="min-h-screen bg-black px-8 py-6 text-zinc-100">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="mr-2 text-2xl font-bold text-white">QML Pipeline Builder</h1>
        <p className="text-xl text-zinc-300">Pick your data, an encoding, a kernel and an algorithm, then run.</p>
        <div className="ml-auto flex gap-3">
          {onOpenGuided && (
            <button onClick={onOpenGuided} className="rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800">
              Guided demo
            </button>
          )}
          {onOpenEncodings && (
            <button onClick={onOpenEncodings} className="rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800">
              ← Encodings
            </button>
          )}
        </div>
      </header>

      {/* The chosen pipeline, always visible */}
      {data && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-lg">
          {[data.name, encodingText.name, usesKernel ? kernelText.name : "no kernel", algorithmText.name].map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-900 px-4 py-1.5 text-zinc-100">{s}</span>
              <span className="text-zinc-600">→</span>
            </span>
          ))}
          <span className={`rounded-full px-4 py-1.5 font-semibold ${result?.quantum ? "bg-cyan-400 text-black" : "bg-zinc-900 text-zinc-400"}`}>
            {result?.quantum ? `${result.quantum.percent}% correct` : result ? "groups found" : "result"}
          </span>
          <button
            onClick={run}
            disabled={running}
            className="ml-auto rounded-xl bg-cyan-400 px-6 py-2.5 text-xl font-bold text-black hover:bg-cyan-300 disabled:opacity-50"
          >
            {running ? (algorithm === "qnn" ? "Training the QNN…" : "Running…") : "Run the pipeline ▶"}
          </button>
        </p>
      )}
      {problem && <p className="mt-3 rounded-xl bg-amber-300/15 px-4 py-3 text-lg text-amber-100">{problem}</p>}

      <main className="mt-5 grid grid-cols-[420px_1fr] gap-6">
        {/* Left: the four menus, one after the other */}
        <div className="flex flex-col gap-4">
          <Menu n={1} title="Your data" active={tab === "data"} onFocus={() => setTab("data")}>
            <Select
              label="Dataset"
              value={dataId}
              options={datasets.map((d) => ({ id: d.id, name: d.name }))}
              onChange={(v) => {
                setDataId(v);
                setTab("data");
              }}
            />
            {data && (
              <p className="mt-2 text-base text-zinc-300">
                {data.rows.length} rows · {data.columns.length} number columns ·{" "}
                {data.labels
                  ? `${data.labelName === "label" ? "labels" : `label column "${data.labelName}"`}: ${classes.join(" / ")}`
                  : "no label column"}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <button
                onClick={() => fileInput.current?.click()}
                className="whitespace-nowrap rounded-xl bg-zinc-800 px-4 py-2 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
              >
                Upload your own CSV
              </button>
              {data && !data.id.startsWith("upload:") && (
                <a
                  href={`${import.meta.env.BASE_URL}datasets/samples/${data.id}.csv`}
                  download
                  className="text-base text-cyan-300 underline"
                >
                  Download this sample
                </a>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
            {uploadError && <p className="mt-2 text-base text-red-300">{uploadError}</p>}
            <p className="mt-2 text-sm text-zinc-500">
              CSV with a header row, up to {LIMITS.columns} number columns and {LIMITS.rows} rows, plus one label column
              (text such as pass/fail).
            </p>
          </Menu>

          <Menu n={2} title="Encoding" active={tab === "encoding"} onFocus={() => setTab("encoding")}>
            <Select
              label="Encoding"
              value={encoding}
              options={ENCODING_CHOICES}
              onChange={(v) => {
                setEncoding(v);
                setTab("encoding");
              }}
            />
            <p className="mt-2 text-base text-zinc-300">
              {encodingText.sentence}{" "}
              {data && (
                <span className="text-cyan-300">
                  {data.columns.length} numbers → {qubits} qubit{qubits === 1 ? "" : "s"}.
                </span>
              )}
            </p>
          </Menu>

          <Menu n={3} title="Quantum kernel" active={tab === "kernel"} onFocus={() => setTab("kernel")}>
            <Select
              label="Kernel"
              value={kernel}
              options={KERNEL_CHOICES}
              disabled={!usesKernel}
              onChange={(v) => {
                setKernel(v);
                setTab("kernel");
              }}
            />
            <p className="mt-2 text-base text-zinc-300">
              {usesKernel ? kernelText.sentence : "Not used: the QNN learns its own dials instead of comparing rows."}
            </p>
          </Menu>

          <Menu n={4} title="Algorithm" active={tab === "result"} onFocus={() => setTab("result")}>
            <Select label="Algorithm" value={algorithm} options={ALGORITHM_CHOICES} onChange={setAlgorithm} />
            <p className="mt-2 text-base text-zinc-300">{algorithmText.sentence}</p>
          </Menu>

        </div>

        {/* Right: what the selected step looks like */}
        <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <nav className="mb-5 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-lg font-semibold ${
                  tab === t.id ? "bg-white text-black" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setShowCode((s) => !s)}
              className={`ml-auto rounded-full px-4 py-2 text-lg font-semibold ${
                showCode ? "bg-zinc-200 text-black" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {showCode ? "Hide code" : "Show code"}
            </button>
          </nav>

          {showCode ? (
            <div>
              <p className="mb-3 text-lg text-zinc-300">
                The whole pipeline you picked, as one Python script. Save it next to {csvName} and run it.
              </p>
              <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-zinc-100">
                <code>{pipelineCode(csvName, encoding, kernel, algorithm)}</code>
              </pre>
            </div>
          ) : !data ? (
            <p className="text-2xl text-zinc-400">Loading the sample datasets…</p>
          ) : tab === "data" ? (
            <div className="flex flex-col gap-4">
              <p className="text-3xl font-bold text-white">Here is the data the computer will learn from.</p>
              <p className="text-xl text-zinc-300">
                Each row is one example. The number columns go into the qubits; the label column is the answer we want
                it to learn{data.id === "healthcare" ? ". This healthcare data is made up (synthetic), not from real patients" : ""}.
              </p>
              <DataTable data={data} />
            </div>
          ) : tab === "encoding" ? (
            <div className="flex flex-col gap-4">
              <p className="text-3xl font-bold text-white">{encodingText.sentence}</p>
              <Tex latex={encodingText.formula} />
              {preview ? (
                <>
                  <p className="text-xl text-zinc-300">
                    Row 1 ({data.rows[0].map(fmt).join(", ")}) becomes{" "}
                    <span className="font-mono text-cyan-300">({preview.prepared.map(fmt).join(", ")})</span>, then this circuit:
                  </p>
                  <Circuit svg={preview.circuit_svg} gateCount={preview.gate_count} nQubits={preview.n_qubits} isAmplitude={encoding === "amplitude"} />
                </>
              ) : (
                <p className="text-xl text-zinc-400">Drawing the circuit…</p>
              )}
            </div>
          ) : tab === "kernel" ? (
            <div className="flex flex-col gap-4">
              {usesKernel ? (
                <>
                  <p className="text-3xl font-bold text-white">{kernelText.sentence}</p>
                  <Tex latex={kernelText.formula} />
                  {result?.kernel_matrix ? (
                    <>
                      <p className="text-xl text-zinc-300">
                        The kernel table for the {result.kernel_matrix.length} learning rows
                        {data.labels ? ", sorted by label (colour strips). Bright squares = alike rows." : ". Bright = alike."}
                      </p>
                      <KernelGrid
                        matrix={result.kernel_matrix}
                        order={result.kernel_order!}
                        groups={
                          data.labels ? result.train_index.map((row) => result.classes.indexOf(data.labels![row]) % GROUP_COLORS.length) : undefined
                        }
                      />
                    </>
                  ) : (
                    <p className="text-xl text-zinc-400">Press Run to compute the kernel table.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white">The QNN uses no kernel.</p>
                  <p className="text-xl text-zinc-300">
                    Instead of comparing rows, it adds trainable layers after the encoding (a turn on every qubit, then
                    links between neighbours, three times) and adjusts their dials until its answers match the labels.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-3xl font-bold text-white">{algorithmText.sentence}</p>
              <Tex latex={algorithmText.formula} />
              {result ? (
                <Result data={data} result={result} />
              ) : (
                <p className="text-xl text-zinc-400">Press “Run the pipeline” to see the result.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
