import katex from "katex";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import type { CompareResult, EncodeResult, Encoding } from "./api";
import Compare from "./Compare";
import { BUNDLED, loadBundled, parseCsv, type Dataset } from "./data";
import { ENCODINGS, PANEL_SENTENCES } from "./explain";
import Circuit from "./panels/Circuit";
import Numbers from "./panels/Numbers";
import Panel from "./panels/Panel";
import Qubits from "./panels/Qubits";

const OFFLINE = "Cannot reach the server. It may still be waking up, so try again in a moment.";

function Formula({ latex }: { latex: string }) {
  const html = useMemo(
    () => katex.renderToString(latex, { displayMode: true, throwOnError: false }),
    [latex],
  );
  return <div className="overflow-x-auto py-2 text-white" dangerouslySetInnerHTML={{ __html: html }} />;
}

function CodeDrawer({ code }: { code: { qiskit: string; pennylane: string } }) {
  const [tab, setTab] = useState<"qiskit" | "pennylane">("qiskit");
  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-black">
      <div className="flex gap-2 border-b border-zinc-800 p-2">
        {(["qiskit", "pennylane"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-lg font-semibold ${
              tab === t ? "bg-zinc-200 text-black" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {t === "qiskit" ? "Qiskit" : "PennyLane"}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto p-4 text-base leading-relaxed text-zinc-100">
        <code>{code[tab]}</code>
      </pre>
    </div>
  );
}

export default function EncodingLab({ onOpenPipeline }: { onOpenPipeline?: () => void } = {}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState("toy_2d");
  const [rowIndex, setRowIndex] = useState(0);
  const [encoding, setEncoding] = useState<Encoding>("basis");
  const [result, setResult] = useState<EncodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState<CompareResult[] | null>(null);
  const [explainStep, setExplainStep] = useState(0); // 0 off, 1-3 panels, 4 formula
  const [presenter, setPresenter] = useState(() => document.documentElement.classList.contains("presenter"));
  const [showCode, setShowCode] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dataset = datasets.find((d) => d.id === datasetId);
  const row = dataset?.rows[Math.min(rowIndex, dataset.rows.length - 1)];
  const text = ENCODINGS.find((e) => e.id === encoding)!;

  // Wake the free server and load the bundled datasets once.
  useEffect(() => {
    api.wake();
    Promise.all(BUNDLED.map((b) => loadBundled(b.id, b.name)))
      .then(setDatasets)
      .catch(() => setError("The bundled datasets could not be loaded."));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("presenter", presenter);
  }, [presenter]);

  // Fetch the main screen whenever the row or encoding changes.
  useEffect(() => {
    if (!dataset || !row || comparing) return;
    const ctrl = new AbortController();
    setLoading(true);
    api
      .encode(encoding, row, dataset.stats, ctrl.signal)
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(OFFLINE);
        void e;
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [dataset, row, encoding, comparing, retry]);

  // Fetch the Compare table when it is open.
  useEffect(() => {
    if (!dataset || !row || !comparing) return;
    const ctrl = new AbortController();
    api
      .compare(row, dataset.stats, ctrl.signal)
      .then((r) => {
        setCompareResults(r);
        setError(null);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError(OFFLINE);
      });
    return () => ctrl.abort();
  }, [dataset, row, comparing, retry]);

  const pickEncoding = useCallback((e: Encoding) => {
    setEncoding(e);
    setComparing(false);
  }, []);

  const moveRow = useCallback(
    (delta: number) => {
      if (!dataset) return;
      const n = dataset.rows.length;
      setRowIndex((i) => (Math.min(i, n - 1) + delta + n) % n);
    },
    [dataset],
  );

  const advanceExplain = useCallback(() => {
    setComparing(false);
    setExplainStep((s) => (s >= 4 ? 0 : s + 1));
  }, []);

  // Presenter shortcuts: P, arrows, 1-5, E. That is the full list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "p") setPresenter((p) => !p);
      else if (key === "e") advanceExplain();
      else if (key === "arrowright" || key === "arrowdown") moveRow(1);
      else if (key === "arrowleft" || key === "arrowup") moveRow(-1);
      else if (/^[1-5]$/.test(key)) pickEncoding(ENCODINGS[Number(key) - 1].id);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advanceExplain, moveRow, pickEncoding]);

  async function onUpload(file: File) {
    const parsed = parseCsv(await file.text(), `upload:${file.name}`, `Your file: ${file.name}`);
    if ("error" in parsed) {
      setUploadError(parsed.error);
      return;
    }
    setUploadError(null);
    setDatasets((list) => [...list.filter((d) => d.id !== parsed.dataset.id), parsed.dataset]);
    setDatasetId(parsed.dataset.id);
    setRowIndex(0);
  }

  // Only show a result that belongs to the encoding on screen.
  const shown = result && result.encoding === encoding ? result : null;
  const step = explainStep;
  const dim = (panel: number) => step !== 0 && step !== panel;
  const caption = (panel: number) => (step === panel ? text.explain[panel - 1] : null);

  return (
    <div className="min-h-screen bg-black px-8 py-6 text-zinc-100">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="mr-4 text-2xl font-bold text-white">QML Encoding Lab</h1>
        <nav className="flex gap-2">
          {ENCODINGS.map((e, i) => (
            <button
              key={e.id}
              onClick={() => pickEncoding(e.id)}
              className={`rounded-xl px-5 py-3 text-xl font-semibold ${
                !comparing && encoding === e.id
                  ? "bg-cyan-400 text-black"
                  : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
              title={`Key ${i + 1}`}
            >
              {e.tab}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={datasetId}
            onChange={(e) => {
              setDatasetId(e.target.value);
              setRowIndex(0);
              e.target.blur(); // hand the arrow keys back to the row picker
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white"
            aria-label="Dataset"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setComparing((c) => !c);
              setExplainStep(0);
            }}
            className={`rounded-xl px-5 py-3 text-lg font-semibold ${
              comparing ? "bg-cyan-400 text-black" : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            Compare
          </button>
          <button
            onClick={advanceExplain}
            className={`rounded-xl px-5 py-3 text-lg font-semibold ${
              step ? "bg-amber-300 text-black" : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Key E"
          >
            {step === 0 ? "Explain" : step < 4 ? `Next (${step} of 4)` : "Done"}
          </button>
          {onOpenPipeline && (
            <button
              onClick={onOpenPipeline}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Pipeline →
            </button>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-xl px-3 py-3 text-sm text-zinc-400 hover:bg-zinc-900"
          >
            Upload CSV
          </button>
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
        </div>
      </header>

      {uploadError && (
        <p className="mt-3 rounded-xl bg-red-500/15 px-4 py-2 text-lg text-red-200">
          {uploadError}{" "}
          <button className="ml-2 underline" onClick={() => setUploadError(null)}>
            OK
          </button>
        </p>
      )}

      {/* Row picker: the only control a student sees */}
      {dataset && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-lg text-zinc-400">Pick a data row:</span>
          {dataset.rows.map((_, i) => (
            <button
              key={i}
              onClick={() => setRowIndex(i)}
              className={`rounded-full px-4 py-1.5 text-lg font-semibold ${
                i === rowIndex ? "bg-white text-black" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              Row {i + 1}
            </button>
          ))}
          {loading && <span className="ml-3 text-zinc-500">Updating…</span>}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-amber-300/15 px-4 py-3 text-xl text-amber-100">
          {error}{" "}
          <button className="ml-2 font-semibold underline" onClick={() => setRetry((r) => r + 1)}>
            Try again
          </button>
        </p>
      )}

      {comparing ? (
        <main className="mt-6">
          <Compare results={compareResults} />
        </main>
      ) : (
        dataset &&
        row && (
          <main className="mt-6">
            <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-6">
              <Panel
                step={1}
                title="Your numbers"
                sentence={PANEL_SENTENCES.numbers}
                caption={caption(1)}
                dimmed={dim(1)}
              >
                <Numbers
                  row={row}
                  columns={dataset.columns}
                  scaled={shown?.scaled ?? null}
                  scaledLabel={text.scaledLabel}
                />
              </Panel>

              {shown?.message ? (
                <section
                  className={`col-span-2 flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 p-10 transition-opacity ${
                    dim(2) && dim(3) ? "opacity-15" : ""
                  }`}
                >
                  <p className="max-w-2xl text-center text-3xl font-semibold text-amber-200">
                    {shown.message}
                  </p>
                </section>
              ) : (
                <>
                  <Panel
                    step={2}
                    title="The circuit"
                    sentence={PANEL_SENTENCES.circuit}
                    caption={caption(2)}
                    dimmed={dim(2)}
                  >
                    {shown?.circuit_svg && (
                      <Circuit
                        svg={shown.circuit_svg}
                        gateCount={shown.gate_count ?? 0}
                        nQubits={shown.n_qubits}
                        isAmplitude={encoding === "amplitude"}
                      />
                    )}
                  </Panel>
                  <Panel
                    step={3}
                    title="The qubits"
                    sentence={PANEL_SENTENCES.qubits}
                    caption={caption(3)}
                    dimmed={dim(3)}
                  >
                    {shown?.probabilities && <Qubits bars={shown.probabilities} bloch={shown.bloch} />}
                  </Panel>
                </>
              )}
            </div>

            {/* Headline, formula and code */}
            <section
              className={`mt-6 rounded-2xl border bg-zinc-950 p-6 transition-opacity duration-300 ${
                step === 4 ? "border-amber-300 ring-4 ring-amber-300/40" : "border-zinc-800"
              } ${dim(4) ? "opacity-15" : ""}`}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-4xl font-bold text-white">{text.headline}</p>
                  <p className="mt-2 text-xl text-zinc-300">{text.pictureIt}</p>
                </div>
                {shown?.code && (
                  <button
                    onClick={() => setShowCode((s) => !s)}
                    className="shrink-0 rounded-xl bg-zinc-900 px-5 py-3 text-lg font-semibold text-zinc-200 hover:bg-zinc-800"
                  >
                    {showCode ? "Hide code" : "Show code"}
                  </button>
                )}
              </div>
              {step === 4 && (
                <p className="mt-4 rounded-xl bg-amber-300 px-4 py-3 text-xl font-semibold text-black">
                  {text.explain[3]}
                </p>
              )}
              {shown?.formula_latex && <Formula latex={shown.formula_latex} />}
              {showCode && shown?.code && <CodeDrawer code={shown.code} />}
            </section>
          </main>
        )
      )}
    </div>
  );
}
