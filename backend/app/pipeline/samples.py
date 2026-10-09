"""Small sample datasets for the pipeline builder (synthetic, seeded, no real people).

Each has 40 rows, 2 to 4 number columns and a text label. Regenerate the CSVs with:
    python -m app.pipeline.samples ../frontend/public/datasets/samples
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np
from sklearn.datasets import make_moons

SEED = 42
ROWS = 40


def _label(score: np.ndarray, yes: str, no: str) -> list[str]:
    """Top half of the score gets `yes`, so both labels have 20 rows."""
    cut = np.median(score)
    return [yes if s > cut else no for s in score]


def student() -> dict:
    rng = np.random.default_rng(SEED)
    study = rng.uniform(0, 10, ROWS).round(1)
    attendance = rng.uniform(50, 100, ROWS).round(0)
    previous = np.clip(rng.normal(65, 12, ROWS), 30, 100).round(0)
    sleep = rng.uniform(4, 9, ROWS).round(1)
    score = (
        0.45 * study / 10
        + 0.3 * (attendance - 50) / 50
        + 0.25 * (previous - 30) / 70
        - 0.1 * (sleep < 5.5)
        + 0.06 * rng.normal(size=ROWS)
    )
    return {
        "name": "Students: will they pass?",
        "columns": ["study_hours", "attendance_pct", "previous_score", "sleep_hours"],
        "X": np.column_stack([study, attendance, previous, sleep]).tolist(),
        "labels": _label(score, "pass", "fail"),
    }


def healthcare() -> dict:
    rng = np.random.default_rng(SEED + 1)
    glucose = rng.normal(110, 25, ROWS).round(0)
    bmi = rng.normal(27, 5, ROWS).round(1)
    age = rng.uniform(20, 75, ROWS).round(0)
    bp = rng.normal(80, 10, ROWS).round(0)
    z = lambda v: (v - v.mean()) / v.std()
    score = 0.5 * z(glucose) + 0.3 * z(bmi) + 0.2 * z(age) + 0.15 * rng.normal(size=ROWS)
    return {
        "name": "Healthcare: diabetes risk (synthetic)",
        "columns": ["glucose", "bmi", "age", "blood_pressure"],
        "X": np.column_stack([glucose, bmi, age, bp]).tolist(),
        "labels": _label(score, "high risk", "low risk"),
    }


def finance() -> dict:
    rng = np.random.default_rng(SEED + 2)
    income = rng.uniform(20, 150, ROWS).round(0)
    credit = rng.uniform(450, 850, ROWS).round(0)
    loan = rng.uniform(5, 60, ROWS).round(0)
    years = rng.uniform(0, 20, ROWS).round(0)
    z = lambda v: (v - v.mean()) / v.std()
    score = 0.5 * z(credit) + 0.4 * z(income / loan) + 0.1 * z(years) + 0.35 * rng.normal(size=ROWS)
    return {
        "name": "Finance: loan approval",
        "columns": ["income_k", "credit_score", "loan_k", "years_employed"],
        "X": np.column_stack([income, credit, loan, years]).tolist(),
        "labels": _label(score, "approved", "rejected"),
    }


def moons() -> dict:
    X, y = make_moons(ROWS, noise=0.1, random_state=SEED)
    return {
        "name": "Two moons (2 numbers, easy to plot)",
        "columns": ["x", "y"],
        "X": X.round(3).tolist(),
        "labels": ["moon A" if v == 0 else "moon B" for v in y],
    }


SAMPLES = {"student": student, "healthcare": healthcare, "finance": finance, "moons": moons}


def csv_rows(key: str) -> list[list[str]]:
    d = SAMPLES[key]()
    return [d["columns"] + ["label"]] + [[f"{v:g}" for v in row] + [lab] for row, lab in zip(d["X"], d["labels"])]


def write_csvs(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for key in SAMPLES:
        with open(folder / f"{key}.csv", "w", newline="") as f:
            csv.writer(f, lineterminator="\n").writerows(csv_rows(key))


if __name__ == "__main__":
    write_csvs(Path(sys.argv[1]))
