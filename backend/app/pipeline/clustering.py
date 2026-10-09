"""Quantum clustering: group dots by the quantum kernel, without any labels."""

from __future__ import annotations

import numpy as np
from scipy.optimize import linear_sum_assignment
from sklearn.cluster import KMeans, SpectralClustering

from . import kernel
from .datasets import SEED, blobs

N_GROUPS = 3


def match_groups(found: list[int], truth: list[int]) -> list[int]:
    """Rename found groups so they line up with the true clouds (group names are arbitrary)."""
    k = max(max(found), max(truth)) + 1
    overlap = np.zeros((k, k), dtype=int)
    for f, t in zip(found, truth):
        overlap[f, t] += 1
    rows, cols = linear_sum_assignment(-overlap)
    rename = dict(zip(rows, cols))
    return [int(rename[f]) for f in found]


def run() -> dict:
    data = blobs()
    X, y = data["train"]
    stats = kernel.stats_for(X)
    K = kernel.matrix(*(2 * [kernel.states(X, stats)]))
    found = SpectralClustering(N_GROUPS, affinity="precomputed", random_state=SEED).fit_predict(K)
    classical = KMeans(N_GROUPS, n_init=10, random_state=SEED).fit_predict(np.array(X))
    return {
        "stats": stats,
        "kernel": K,
        "learn": {"groups": match_groups(list(found), y)},
        "predictions": match_groups(list(found), y),
        "classical_predictions": match_groups(list(classical), y),
        "classical_name": "Classical k-means",
    }
