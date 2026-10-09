"""Builds everything the six Pipeline steps show for one algorithm.

Results are deterministic, so each algorithm is computed once and cached.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np

from ..core import gate_count
from ..encoders import amplitude
from ..lab import circuit_svg, loading_cost
from . import clustering, kernel, qcnn, qsvm
from .datasets import DATASETS

ALGORITHMS = ("qsvm", "clustering", "qcnn")
EXAMPLE = 0  # the dot (or picture) followed through steps 2 and 3


def score(pred: list[int], truth: list[int]) -> dict:
    correct = int(sum(p == t for p, t in zip(pred, truth)))
    return {"correct": correct, "total": len(truth), "percent": round(100 * correct / len(truth))}


def kernel_view(K: np.ndarray, order: list[int]) -> dict:
    return {"matrix": np.round(K, 3).tolist(), "order": order}


@lru_cache(maxsize=None)
def build(algorithm: str) -> dict:
    data = DATASETS[algorithm]()
    X, y = data["train"]
    Xt, yt = data["test"]
    out = {
        "algorithm": algorithm,
        "columns": data["columns"],
        "class_names": data["class_names"],
        "train": {"X": X, "y": y},
        "test": {"X": Xt, "y": yt},
        "kernel": None,
        "model_circuit": None,
    }

    if algorithm == "qcnn":
        res = qcnn.run()
        qc = amplitude.build([float(v) for v in X[EXAMPLE]])
        out["example"] = {
            "index": EXAMPLE,
            "raw": X[EXAMPLE],
            "scaled": amplitude.scale([float(v) for v in X[EXAMPLE]]),
            "circuit_svg": circuit_svg(qc),
            "gate_count": loading_cost("amplitude", qc),
            "n_qubits": qc.num_qubits,
        }
        out["model_circuit"] = {"svg": circuit_svg(res["model"], fontsize=13), "n_dials": qcnn.N_DIALS}
        truth = yt
    else:
        res = qsvm.run() if algorithm == "qsvm" else clustering.run()
        stats = res["stats"]
        qc = kernel.circuit(X[EXAMPLE], stats)
        out["example"] = {
            "index": EXAMPLE,
            "raw": X[EXAMPLE],
            "scaled": kernel.scaled(X[EXAMPLE], stats),
            "circuit_svg": circuit_svg(qc),
            "gate_count": gate_count(qc),
            "n_qubits": qc.num_qubits,
        }
        if algorithm == "qsvm":
            # Labels are known when learning with a teacher, so the grid is sorted by them.
            order = sorted(range(len(y)), key=lambda i: (y[i], i))
            truth = yt
        else:
            # Clustering has no labels: the grid keeps the file's order; step 5 re-sorts it.
            order = list(range(len(y)))
            groups = res["learn"]["groups"]
            res["learn"]["order"] = sorted(range(len(y)), key=lambda i: (groups[i], i))
            truth = y
        out["kernel"] = kernel_view(res["kernel"], order)

    out["learn"] = res["learn"]
    out["result"] = {
        "predictions": res["predictions"],
        "chances": res.get("chances"),
        "quantum": score(res["predictions"], truth),
        "classical": {"name": res["classical_name"], **score(res["classical_predictions"], truth)},
        "classical_predictions": res["classical_predictions"],
    }
    return out


def warm_up() -> None:
    for name in ALGORITHMS:
        build(name)
