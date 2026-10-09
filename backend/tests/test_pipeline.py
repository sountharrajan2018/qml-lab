"""Pipeline checks: datasets, kernel, the three algorithms and the endpoint."""

import csv
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.pipeline import datasets, kernel, qcnn
from app.pipeline.run import ALGORITHMS, build

CSV_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "datasets" / "pipeline"


@pytest.mark.parametrize("name", datasets.CSV_FILES)
def test_csv_files_match_the_generators(name):
    with open(CSV_DIR / name, newline="") as f:
        assert list(csv.reader(f)) == datasets.csv_rows(name)


def test_dataset_sizes_and_balance():
    m, b, li = datasets.moons(), datasets.blobs(), datasets.lines()
    assert (len(m["train"][0]), len(m["test"][0])) == (40, 20)
    assert len(b["train"][0]) == 30 and sorted(set(b["train"][1])) == [0, 1, 2]
    assert (len(li["train"][0]), len(li["test"][0])) == (33, 15)
    all_lines = li["train"][1] + li["test"][1]
    assert all_lines.count(0) == all_lines.count(1) == 24
    # Every picture is one straight line of 2 to 4 pixels.
    for pic in li["train"][0] + li["test"][0]:
        assert 2 <= sum(pic) <= 4


def test_kernel_is_a_similarity():
    X, _ = datasets.moons()["train"]
    stats = kernel.stats_for(X)
    K = kernel.matrix(*(2 * [kernel.states(X, stats)]))
    assert np.allclose(K, K.T)
    assert np.allclose(np.diag(K), 1.0)
    assert K.min() >= 0 and K.max() <= 1 + 1e-9
    assert np.linalg.eigvalsh(K).min() > -1e-9  # a valid kernel has no negative eigenvalues
    # Uses the narrower 0..pi/2 range, not the Encoding Lab's 0..pi.
    assert max(kernel.scaled(X[0], stats)) <= np.pi / 2 + 1e-9


@pytest.mark.parametrize(
    "algorithm, quantum_floor",
    [("qsvm", 85), ("clustering", 100), ("qcnn", 85)],
)
def test_algorithms_reach_their_scores(algorithm, quantum_floor):
    r = build(algorithm)["result"]
    assert r["quantum"]["percent"] >= quantum_floor
    assert r["classical"]["percent"] >= 75


def test_qcnn_saved_training_matches_a_fresh_run():
    saved = qcnn.load_trained()
    assert len(saved["params"]) == qcnn.N_DIALS == 22
    assert saved["loss"][-1] < saved["loss"][0] / 2
    # The live predictions come from the saved dials.
    r = build("qcnn")["result"]
    assert all((c > 0.5) == bool(p) for c, p in zip(r["chances"], r["predictions"]))


def test_qcnn_has_no_kernel_and_others_do():
    assert build("qcnn")["kernel"] is None and build("qcnn")["model_circuit"]["n_dials"] == 22
    for name in ("qsvm", "clustering"):
        k = build(name)["kernel"]
        n = len(build(name)["train"]["X"])
        assert len(k["matrix"]) == n and sorted(k["order"]) == list(range(n))


def test_pipeline_endpoint():
    from app.main import app

    with TestClient(app) as c:
        for name in ALGORITHMS:
            r = c.post("/api/pipeline", json={"algorithm": name})
            assert r.status_code == 200
            body = r.json()
            assert body["example"]["circuit_svg"].startswith("<svg")
            assert set(body["result"]) >= {"quantum", "classical", "predictions"}
        assert c.post("/api/pipeline", json={"algorithm": "nope"}).status_code == 422
