"""API checks: every encoding answers for every row of every bundled dataset."""

import importlib

import pytest
from fastapi.testclient import TestClient

from app.core import column_stats
from app.encoders import ENCODERS

from .test_encoders import ALL


@pytest.fixture(scope="module")
def client():
    from app.main import app

    with TestClient(app) as c:  # runs the startup warm-up too
        yield c


def payload(row, rows, encoding=None):
    body = {"row": row, "column_stats": column_stats(rows)}
    if encoding:
        body["encoding"] = encoding
    return body


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


@pytest.mark.parametrize("dataset", ALL)
@pytest.mark.parametrize("encoding", ENCODERS)
def test_encode_every_row(client, dataset, encoding):
    rows = ALL[dataset]
    for row in rows:
        r = client.post("/api/encode", json=payload(row, rows, encoding))
        assert r.status_code == 200, r.text
        body = r.json()
        if dataset == "pixels_16d" and encoding != "amplitude":
            assert body["message"] == "16 numbers would need 16 qubits here. Try Amplitude."
            assert body["probabilities"] is None
            continue
        assert body["message"] is None
        assert body["circuit_svg"].startswith("<svg")
        assert body["gate_count"] >= 0
        assert sum(p["p"] for p in body["probabilities"]) == pytest.approx(1.0, abs=1e-5)
        assert len(body["probabilities"]) == 2 ** body["n_qubits"]
        assert body["formula_latex"]
        assert set(body["code"]) == {"qiskit", "pennylane"}
        assert (body["bloch"] is not None) == (encoding in ("basis", "angle"))
        if body["bloch"]:
            assert len(body["bloch"]) == body["n_qubits"]


def test_amplitude_draws_one_box_but_counts_the_real_gates(client):
    rows = ALL["pixels_16d"]
    body = client.post("/api/encode", json=payload(rows[4], rows, "amplitude")).json()
    assert body["n_qubits"] == 4
    assert body["gate_count"] > 10  # the long loading circuit shows in the count


def test_compare_gives_all_five(client):
    rows = ALL["iris_4d"]
    r = client.post("/api/compare", json=payload(rows[0], rows))
    assert r.status_code == 200
    body = r.json()
    assert [b["encoding"] for b in body] == list(ENCODERS)
    assert [b["n_qubits"] for b in body] == [4, 4, 2, 4, 4]
    for b in body:
        assert sum(p["p"] for p in b["probabilities"]) == pytest.approx(1.0, abs=1e-5)
        assert "circuit_svg" not in b


def test_mismatched_stats_is_a_plain_sentence(client):
    r = client.post(
        "/api/encode",
        json={"encoding": "angle", "row": [1, 2], "column_stats": [{"min": 0, "max": 1, "median": 0.5}]},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "The row and its column stats must have the same length."


def test_code_snippets(client):
    """Qiskit code runs and gives the same chances; PennyLane code is valid Python.

    The code shows numbers rounded to 4 decimals, so chances agree to about 1e-3."""
    rows = ALL["toy_2d"]
    for encoding in ENCODERS:
        body = client.post("/api/encode", json=payload(rows[0], rows, encoding)).json()
        compile(body["code"]["pennylane"], "pennylane_snippet", "exec")
        scope: dict = {"print": lambda *a: None}
        exec(body["code"]["qiskit"], scope)
        qiskit_probs = scope["state"].probabilities_dict()
        if encoding == "amplitude":
            # Plain Qiskit puts number i on its own (right-to-left) label i; same values overall.
            got = sorted(qiskit_probs.values())
            want = sorted(p["p"] for p in body["probabilities"])
            assert got == pytest.approx(want, abs=1e-3)
            continue
        for p in body["probabilities"]:
            assert qiskit_probs.get(p["label"][::-1], 0.0) == pytest.approx(p["p"], abs=1e-3)


def test_cors_reads_frontend_origin(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://lab.example.app/")
    import app.main as main

    main = importlib.reload(main)
    with TestClient(main.app) as c:
        ok = c.options(
            "/api/encode",
            headers={"Origin": "https://lab.example.app", "Access-Control-Request-Method": "POST"},
        )
        assert ok.headers.get("access-control-allow-origin") == "https://lab.example.app"
        local = c.get("/api/health", headers={"Origin": "http://localhost:5173"})
        assert local.headers.get("access-control-allow-origin") == "http://localhost:5173"
        other = c.get("/api/health", headers={"Origin": "https://evil.example.com"})
        assert "access-control-allow-origin" not in other.headers
    monkeypatch.delenv("FRONTEND_ORIGIN")
    importlib.reload(main)
