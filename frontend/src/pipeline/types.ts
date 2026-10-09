// Shape of POST /api/pipeline (see backend/app/pipeline/run.py).
export type Algorithm = "qsvm" | "clustering" | "qcnn";

export interface Score {
  correct: number;
  total: number;
  percent: number;
}

export interface PipelineResult {
  algorithm: Algorithm;
  columns: string[];
  class_names: string[];
  train: { X: number[][]; y: number[] };
  test: { X: number[][]; y: number[] };
  example: {
    index: number;
    raw: number[];
    scaled: number[];
    circuit_svg: string;
    gate_count: number;
    n_qubits: number;
  };
  kernel: { matrix: number[][]; order: number[] } | null;
  model_circuit: { svg: string; n_dials: number } | null;
  learn: {
    grid?: { xs: number[]; ys: number[]; labels: number[][] };
    support?: number[];
    groups?: number[];
    order?: number[];
    loss?: number[];
    train_correct?: number;
  };
  result: {
    predictions: number[];
    chances: number[] | null;
    quantum: Score;
    classical: Score & { name: string };
    classical_predictions: number[];
  };
}
