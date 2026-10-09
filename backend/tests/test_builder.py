"""Pipeline builder: every encoding x kernel x algorithm, upload rules, speed."""

import csv
import time
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from qiskit.quantum_info import Operator

from app.core import CannotEncode
from app.pipeline import algorithms, builder, featuremaps, kernels, samples

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "datasets" / "samples"
COMBOS = [
    (enc, k, alg)
    for enc in featuremaps.ENCODINGS
    for alg, (_, uses_kernel) in algorithms.ALGORITHMS.items()
    for k in (kernels.KERNELS if uses_kernel else ["fidelity"])
]


@pytest.mark.parametrize("key", samples.SAMPLES)
def test_sample_csvs_match_the_generators(key):
    with open(SAMPLE_DIR / f"{key}.csv", newline="") as f:
        assert list(csv.reader(f)) == samples.csv_rows(key)


@pytest.mark.parametrize("key", samples.SAMPLES)
def test_samples_are_small_and_balanced(key):
    d = samples.SAMPLES[key]()
    assert len(d["X"]) == 40 and len(d["columns"]) <= builder.MAX_FEATURES
    assert sorted({d["labels"].count(c) for c in set(d["labels"])}) == [20]


@pytest.mark.parametrize("encoding, kernel, algorithm", COMBOS)
def test_every_combination_runs_fast_on_the_student_data(encoding, kernel, algorithm):
    d = samples.student()
    t = time.perf_counter()
    r = builder.run(d["X"], d["labels"], encoding, kernel, algorithm)
    assert time.perf_counter() - t < 10
    assert 0 <= r["quantum"]["percent"] <= 100
    assert len(r["predictions"]) == len(r["test_index"])
    assert (r["kernel_matrix"] is None) == (algorithm == "qnn")
    if r["kernel_matrix"] is not None:
        K = np.array(r["kernel_matrix"])
        assert np.allclose(K, K.T, atol=1e-3) and np.allclose(np.diag(K), 1, atol=1e-3)


def test_default_choice_beats_a_coin_toss_on_every_sample():
    for make in samples.SAMPLES.values():
        d = make()
        assert builder.run(d["X"], d["labels"], "angle", "fidelity", "qsvm")["quantum"]["percent"] >= 75


def test_train_and_test_rows_do_not_overlap():
    d = samples.finance()
    r = builder.run(d["X"], d["labels"], "angle", "fidelity", "qsvm")
    assert not set(r["train_index"]) & set(r["test_index"])
    assert sorted(r["train_index"] + r["test_index"]) == list(range(40))


def test_clustering_works_without_labels():
    d = samples.moons()
    r = builder.run(d["X"], None, "angle", "fidelity", "qclustering")
    assert r["quantum"] is None and set(r["predictions"]) == {0, 1}


@pytest.mark.parametrize(
    "X, labels, algorithm, sentence",
    [
        ([[1.0] * 11] * 10, ["a", "b"] * 5, "qsvm", "at most 10 number columns"),
        ([[1.0, 2.0]] * 5, ["a", "b", "a", "b", "a"], "qsvm", "between 8 and 60 rows"),
        ([[float(i), 1.0] for i in range(10)], None, "qsvm", "needs a label column"),
        ([[float(i), 1.0] for i in range(10)], ["a"] * 10, "qsvm", "at least two different values"),
        ([[float(i), 1.0] for i in range(10)], ["a"] * 9 + ["b"], "qsvm", "at least 2 rows"),
        ([[float(i), 1.0] for i in range(12)], ["a", "b", "c"] * 4, "qnn", "two labels apart"),
    ],
)
def test_broken_rules_are_one_sentence(X, labels, algorithm, sentence):
    with pytest.raises(CannotEncode, match=sentence):
        builder.run(X, labels, "angle", "fidelity", algorithm)


def test_numpy_qnn_matches_qiskit():
    rng = np.random.default_rng(1)
    for n in (2, 4):
        S = rng.normal(size=(3, 2**n)) + 1j * rng.normal(size=(3, 2**n))
        S /= np.linalg.norm(S, axis=1, keepdims=True)
        qc, p = algorithms.qnn_ansatz(n)
        theta = rng.uniform(0, 6, len(p))
        U = Operator(qc.assign_parameters(dict(zip(p, theta)))).data
        assert np.allclose(algorithms._apply_ansatz(S, theta), S @ U.T)


def test_projected_kernel_matches_partial_trace():
    from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace

    d = samples.student()
    stats = featuremaps.column_stats(d["X"])
    S = kernels.states("zz", d["X"][:2], stats)
    b = kernels.bloch_vectors(S)
    rho = partial_trace(DensityMatrix(Statevector(S[0])), [1, 2, 3]).data
    assert np.allclose(b[0, 0], [2 * rho[0, 1].real, -2 * rho[0, 1].imag, (rho[0, 0] - rho[1, 1]).real])


def test_builder_endpoints():
    from app.main import app

    d = samples.student()
    with TestClient(app) as c:
        r = c.post("/api/builder/encode", json={"encoding": "zz", "X": d["X"]})
        assert r.status_code == 200 and r.json()["n_qubits"] == 4
        r = c.post(
            "/api/builder/run",
            json={"X": d["X"], "labels": d["labels"], "encoding": "angle", "kernel": "fidelity", "algorithm": "qsvm"},
        )
        assert r.status_code == 200 and r.json()["quantum"]["total"] == 12
        bad = c.post(
            "/api/builder/run",
            json={"X": d["X"], "labels": None, "encoding": "angle", "kernel": "fidelity", "algorithm": "qsvm"},
        )
        assert bad.status_code == 400 and "label column" in bad.json()["detail"]
