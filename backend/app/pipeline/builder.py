"""The pipeline builder: data -> encoding -> kernel -> algorithm -> result."""

from __future__ import annotations

import time

import numpy as np
from scipy.optimize import linear_sum_assignment
from sklearn.model_selection import train_test_split

from ..core import CannotEncode, gate_count
from ..lab import circuit_svg, loading_cost
from . import algorithms, featuremaps, kernels

MAX_FEATURES = 10
MAX_ROWS = 60
MIN_ROWS = 8
TEST_SHARE = 0.3


def check(X, labels, algorithm: str) -> None:
    n_rows, n_feat = len(X), len(X[0]) if X else 0
    if not MIN_ROWS <= n_rows <= MAX_ROWS:
        raise CannotEncode(f"The data needs between {MIN_ROWS} and {MAX_ROWS} rows; this has {n_rows}.")
    if any(len(r) != n_feat for r in X):
        raise CannotEncode("Every row must have the same number of values.")
    if not 1 <= n_feat <= MAX_FEATURES:
        raise CannotEncode(f"The data can have at most {MAX_FEATURES} number columns; this has {n_feat}.")
    if algorithm == "qclustering":
        return
    if labels is None:
        raise CannotEncode("This algorithm learns from examples, so the data needs a label column.")
    counts = {c: labels.count(c) for c in set(labels)}
    if len(counts) < 2:
        raise CannotEncode("The label column needs at least two different values.")
    if min(counts.values()) < 2:
        raise CannotEncode("Every label needs at least 2 rows, so some can be kept aside for testing.")
    if algorithm == "qnn" and len(counts) > 2:
        raise CannotEncode("This QNN reads one qubit, so it can only tell two labels apart. Try the Quantum SVM.")


def match_groups(found, truth) -> np.ndarray:
    k = max(max(found), max(truth)) + 1
    overlap = np.zeros((k, k), dtype=int)
    for f, t in zip(found, truth):
        overlap[f, t] += 1
    rows, cols = linear_sum_assignment(-overlap)
    rename = dict(zip(rows, cols))
    return np.array([rename[f] for f in found])


def encoding_preview(encoding: str, X) -> dict:
    stats = featuremaps.column_stats(X)
    qc = featuremaps.circuit(encoding, X[0], stats)
    return {
        "encoding": encoding,
        "prepared": [float(v) for v in featuremaps.prepare(encoding, X[0], stats)],
        "n_qubits": qc.num_qubits,
        "gate_count": loading_cost("amplitude" if encoding == "amplitude" else encoding, qc),
        "circuit_svg": circuit_svg(qc),
    }


def run(X, labels, encoding: str, kernel: str, algorithm: str) -> dict:
    check(X, labels, algorithm)
    start = time.perf_counter()
    X = np.asarray(X, dtype=float)
    classes = sorted(set(labels)) if labels is not None else []
    y = np.array([classes.index(c) for c in labels]) if labels is not None else None
    uses_kernel = algorithms.ALGORITHMS[algorithm][1]

    if algorithm == "qclustering":
        train_idx = test_idx = np.arange(len(X))
    else:
        train_idx, test_idx = train_test_split(
            np.arange(len(X)), test_size=TEST_SHARE, random_state=algorithms.SEED, stratify=y
        )
    stats = featuremaps.column_stats(X[train_idx])
    S_train = kernels.states(encoding, X[train_idx], stats)
    S_test = S_train if algorithm == "qclustering" else kernels.states(encoding, X[test_idx], stats)

    out = {
        "encoding": encoding,
        "kernel": kernel if uses_kernel else None,
        "algorithm": algorithm,
        "classes": classes,
        "train_index": train_idx.tolist(),
        "test_index": test_idx.tolist(),
        "n_qubits": int(np.log2(S_train.shape[1])),
        "kernel_matrix": None,
        "kernel_order": None,
        "loss": None,
        "n_dials": None,
    }

    if uses_kernel:
        K_train, K_test = kernels.build(kernel, S_train, S_test)
        order = list(range(len(train_idx)))
        if y is not None:
            order = sorted(order, key=lambda i: (y[train_idx][i], i))
        out["kernel_matrix"] = np.round(K_train, 3).tolist()
        out["kernel_order"] = order

    scaled = lambda idx: np.array([[featuremaps.rescale(v, s, 1.0) for v, s in zip(r, stats)] for r in X[idx]])
    n_groups = max(2, len(classes))
    if algorithm == "qsvm":
        pred = algorithms.qsvm(K_train, y[train_idx], K_test)
    elif algorithm == "qknn":
        pred = algorithms.qknn(K_train, y[train_idx], K_test)
    elif algorithm == "qclustering":
        pred = algorithms.qclustering(K_train, n_groups)
    else:
        pred, out["loss"], out["n_dials"] = algorithms.qnn(S_train, y[train_idx], S_test)
    quantum_seconds = time.perf_counter() - start

    c_name, c_pred = algorithms.classical(
        algorithm, scaled(train_idx), None if y is None else y[train_idx], scaled(test_idx), n_groups
    )
    if algorithm == "qclustering" and y is not None:
        pred, c_pred = match_groups(pred, y), match_groups(c_pred, y)

    def score(p):
        if y is None:
            return None
        truth = y[test_idx]
        correct = int((np.asarray(p) == truth).sum())
        return {"correct": correct, "total": len(truth), "percent": round(100 * correct / len(truth))}

    out["predictions"] = [int(v) for v in pred]
    out["classical_predictions"] = [int(v) for v in c_pred]
    out["quantum"] = score(pred)
    out["classical"] = {"name": c_name, "score": score(c_pred)}
    out["seconds"] = round(quantum_seconds, 2)
    return out
