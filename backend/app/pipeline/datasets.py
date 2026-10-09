"""The three pipeline datasets. All are generated from fixed seeds, rounded to
4 decimals, and also saved as CSV in frontend/public/datasets/pipeline/.

Regenerate the CSVs with:  python -m app.pipeline.datasets ../frontend/public/datasets/pipeline
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np
from sklearn.datasets import make_blobs, make_moons

SEED = 42
DECIMALS = 4


def _round(X) -> list[list[float]]:
    return [[round(float(v), DECIMALS) for v in row] for row in X]


def moons() -> dict:
    """Two interlocking half-moons: 40 dots to learn from, 20 unseen dots to test."""
    X, y = make_moons(40, noise=0.1, random_state=SEED)
    Xt, yt = make_moons(20, noise=0.1, random_state=7)
    return {
        "columns": ["x", "y"],
        "class_names": ["moon A", "moon B"],
        "train": (_round(X), [int(v) for v in y]),
        "test": (_round(Xt), [int(v) for v in yt]),
    }


def blobs() -> dict:
    """Three round clouds of dots. The labels are kept only to check the result."""
    X, y = make_blobs(30, centers=3, cluster_std=0.8, random_state=SEED)
    return {
        "columns": ["x", "y"],
        "class_names": ["cloud 1", "cloud 2", "cloud 3"],
        "train": (_round(X), [int(v) for v in y]),
        "test": ([], []),
    }


TRAIN_LINES = 33  # the first 33 shuffled pictures are for learning, the other 15 for testing


def lines() -> dict:
    """48 black-and-white 4x4 pictures of one straight line: lying down (0) or standing up (1)."""
    pictures, labels = [], []
    for orientation in (0, 1):
        for r in range(4):
            for length, start in [(4, 0), (3, 0), (3, 1), (2, 0), (2, 1), (2, 2)]:
                a = np.zeros((4, 4))
                if orientation == 0:
                    a[r, start : start + length] = 1
                else:
                    a[start : start + length, r] = 1
                pictures.append(a.flatten())
                labels.append(orientation)
    order = np.random.default_rng(SEED).permutation(len(pictures))
    X = [[int(v) for v in pictures[i]] for i in order]
    y = [labels[i] for i in order]
    return {
        "columns": [f"p{i}" for i in range(1, 17)],
        "class_names": ["lying down", "standing up"],
        "train": (X[:TRAIN_LINES], y[:TRAIN_LINES]),
        "test": (X[TRAIN_LINES:], y[TRAIN_LINES:]),
    }


DATASETS = {"qsvm": moons, "clustering": blobs, "qcnn": lines}

CSV_FILES = {
    "moons_train.csv": (moons, "train"),
    "moons_test.csv": (moons, "test"),
    "blobs.csv": (blobs, "train"),
    "lines_train.csv": (lines, "train"),
    "lines_test.csv": (lines, "test"),
}


def csv_rows(name: str) -> list[list[str]]:
    make, part = CSV_FILES[name]
    data = make()
    X, y = data[part]
    header = data["columns"] + ["label"]
    return [header] + [[f"{v:g}" for v in row] + [data["class_names"][lab]] for row, lab in zip(X, y)]


def write_csvs(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for name in CSV_FILES:
        with open(folder / name, "w", newline="") as f:
            csv.writer(f, lineterminator="\n").writerows(csv_rows(name))


if __name__ == "__main__":
    write_csvs(Path(sys.argv[1]))
