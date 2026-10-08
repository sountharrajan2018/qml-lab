// Talks to the FastAPI backend. VITE_API_BASE is the Render URL in production;
// left empty, requests go to the same site (local start.py or the dev proxy).
import type { ColumnStat } from "./data";

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

/** Wake a sleeping free server as soon as the page opens. */
export function wake(): void {
  fetch(`${BASE}/api/health`).catch(() => {});
}
