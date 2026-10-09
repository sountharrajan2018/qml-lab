"""Quantum SVM: a support vector machine that measures similarity with the quantum kernel."""

from __future__ import annotations

import numpy as np
from sklearn.svm import SVC

from . import kernel
from .datasets import moons

GRID = 40  # the background of the boundary plot is a GRID x GRID set of dots
MARGIN = 0.15  # the background reaches a little past the learning dots, so unseen dots sit on it


def run() -> dict:
    data = moons()
    X, y = data["train"]
    Xt, yt = data["test"]
    stats = kernel.stats_for(X)
    A = kernel.states(X, stats)
    K = kernel.matrix(A, A)
    clf = SVC(kernel="precomputed").fit(K, y)

    test_pred = clf.predict(kernel.matrix(kernel.states(Xt, stats), A))
    def axis(s):
        pad = MARGIN * (s["max"] - s["min"])
        return np.linspace(s["min"] - pad, s["max"] + pad, GRID)

    xs, ys = axis(stats[0]), axis(stats[1])
    grid = [(a, b) for b in ys for a in xs]
    grid_pred = clf.predict(kernel.matrix(kernel.states(grid, stats), A)).reshape(GRID, GRID)

    classical = SVC(kernel="rbf").fit(X, y)
    c_pred = classical.predict(Xt)
    return {
        "stats": stats,
        "kernel": K,
        "learn": {
            "grid": {"xs": xs.tolist(), "ys": ys.tolist(), "labels": grid_pred.astype(int).tolist()},
            "support": sorted(int(i) for i in clf.support_),
        },
        "predictions": [int(p) for p in test_pred],
        "classical_predictions": [int(p) for p in c_pred],
        "classical_name": "Classical SVM",
    }
