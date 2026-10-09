// Datasets: the three bundled CSVs and the professor's upload, parsed in the
// browser. Uploaded files are never sent anywhere except one row at a time.
import Papa from "papaparse";

export interface ColumnStat {
  min: number;
  max: number;
  median: number;
}

export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: number[][];
  stats: ColumnStat[];
  /** One label per row, if the file has a label column. */
  labels: string[] | null;
  labelName: string | null;
}

export const BUNDLED = [
  { id: "toy_2d", name: "Toy: 2 numbers" },
  { id: "iris_4d", name: "Iris flowers: 4 numbers" },
  { id: "pixels_16d", name: "Pixels: 16 numbers" },
];

export interface Limits {
  rows: number;
  columns: number;
}

export const LAB_LIMITS: Limits = { rows: 50, columns: 16 };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function isNumber(text: string): boolean {
  return text.trim() !== "" && Number.isFinite(Number(text));
}

/**
 * Parse CSV text, or return one sentence naming the rule it breaks.
 * The label is a column called "label", or else the one column holding text.
 */
export function parseCsv(
  text: string,
  id: string,
  name: string,
  limits: Limits = LAB_LIMITS,
): { dataset: Dataset } | { error: string } {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
  const [header, ...body] = parsed.data.map((r) => r.map((c) => c.trim()));
  if (!header || header.length === 0) return { error: "The file is empty." };
  if (header.every(isNumber)) {
    return { error: "The first line must be a header row with a name for each column." };
  }
  let labelAt = header.findIndex((h) => h.toLowerCase() === "label");
  if (labelAt < 0) {
    const textCols = header.map((_, i) => i).filter((i) => body.some((r) => r[i] !== undefined && !isNumber(r[i])));
    if (textCols.length === 1) labelAt = textCols[0];
  }
  const keep = header.map((_, i) => i).filter((i) => i !== labelAt);
  if (keep.length === 0) return { error: "The file needs at least one column of numbers." };
  if (keep.length > limits.columns) {
    return { error: `The file can have at most ${limits.columns} columns of numbers.` };
  }
  if (body.length === 0) return { error: "The file has a header row but no rows of numbers." };
  if (body.length > limits.rows) return { error: `The file can have at most ${limits.rows} rows.` };
  if (body.some((r) => r.length !== header.length)) {
    return { error: "Every row must have the same number of values as the header row." };
  }
  if (body.some((r) => keep.some((i) => !isNumber(r[i])))) {
    return { error: "Every value must be a number, except in one label column." };
  }
  const rows = body.map((r) => keep.map((i) => Number(r[i])));
  const stats = keep.map((_, c) => {
    const col = rows.map((r) => r[c]);
    return { min: Math.min(...col), max: Math.max(...col), median: median(col) };
  });
  const labels = labelAt >= 0 ? body.map((r) => r[labelAt]) : null;
  const labelName = labelAt >= 0 ? header[labelAt] : null;
  return { dataset: { id, name, columns: keep.map((i) => header[i]), rows, stats, labels, labelName } };
}

export async function loadBundled(id: string, name: string, folder = "datasets", limits = LAB_LIMITS): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}${folder}/${id}.csv`);
  const result = parseCsv(await res.text(), id, name, limits);
  if ("error" in result) throw new Error(result.error);
  return result.dataset;
}

/** Short number for the screen: at most 3 decimals, no trailing zeros. */
export function fmt(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/** A row of 16 numbers between 0 and 1 is drawn as a 4x4 picture. */
export function isPicture(values: number[]): boolean {
  return values.length === 16 && values.every((v) => v >= 0 && v <= 1);
}
