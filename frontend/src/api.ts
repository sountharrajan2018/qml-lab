// Talks to the FastAPI backend. Left empty, VITE_API_BASE sends requests to the
// same site: the /api rewrite on Vercel services, local start.py, or the dev proxy.
// Set it only when the backend lives on another host (e.g. Render).
import type { ColumnStat } from "./data";
import type { Algorithm, PipelineResult } from "./pipeline/types";

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export type Encoding = "basis" | "angle" | "amplitude" | "iqp" | "hamiltonian";

export interface Bar {
  label: string;
  p: number;
}

export interface Bloch {
  x: number;
  y: number;
  z: number;
}

export interface EncodeResult {
  encoding: Encoding;
  n_qubits: number;
  scaled: number[] | null;
  circuit_svg: string | null;
  gate_count: number | null;
  probabilities: Bar[] | null;
  bloch: Bloch[] | null;
  formula_latex: string | null;
  code: { qiskit: string; pennylane: string } | null;
  message: string | null;
}

export type CompareResult = Pick<
  EncodeResult,
  "encoding" | "n_qubits" | "gate_count" | "probabilities" | "message"
>;

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Server answered ${res.status}`);
  return res.json() as Promise<T>;
}

export function encode(
  encoding: Encoding,
  row: number[],
  stats: ColumnStat[],
  signal?: AbortSignal,
): Promise<EncodeResult> {
  return post("/api/encode", { encoding, row, column_stats: stats }, signal);
}

export function compare(
  row: number[],
  stats: ColumnStat[],
  signal?: AbortSignal,
): Promise<CompareResult[]> {
  return post("/api/compare", { row, column_stats: stats }, signal);
}

export function pipeline(algorithm: Algorithm, signal?: AbortSignal): Promise<PipelineResult> {
  return post("/api/pipeline", { algorithm }, signal);
}

/** Wake a sleeping free server as soon as the page opens. */
export function wake(): void {
  fetch(`${BASE}/api/health`).catch(() => {});
}
