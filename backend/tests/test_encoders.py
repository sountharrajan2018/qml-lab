"""Correctness checks from PLAN.md, run against every bundled dataset."""

import csv
import math
from pathlib import Path

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator, SparsePauliOp
from scipy.linalg import expm

from app.core import CannotEncode, bloch_vectors, column_stats, probabilities
from app.encoders import ENCODERS, amplitude, angle, basis, hamiltonian, iqp

DATASETS = Path(__file__).resolve().parents[2] / "frontend" / "public" / "datasets"


def load(name: str) -> list[list[float]]:
    with open(DATASETS / f"{name}.csv", newline="") as f:
        return [[float(v) for k, v in r.items() if k != "label"] for r in csv.DictReader(f)]


ALL = {name: load(name) for name in ("toy_2d", "iris_4d", "pixels_16d")}


def chances(qc: QuantumCircuit) -> dict[str, float]:
    return {item["label"]: item["p"] for item in probabilities(qc)}


@pytest.mark.parametrize("dataset", ALL)
@pytest.mark.parametrize("encoding", ENCODERS)
def test_probabilities_add_up_to_one(dataset, encoding):
    rows = ALL[dataset]
    stats = column_stats(rows)
    for row in rows:
        try:
            qc = ENCODERS[encoding].build(row, stats)
        except CannotEncode as e:
            # Only the 16-number pixels rows are too wide, and only for one-qubit-per-number encodings.
            assert dataset == "pixels_16d" and encoding != "amplitude"
            assert str(e) == "16 numbers would need 16 qubits here. Try Amplitude."
            continue
        assert sum(chances(qc).values()) == pytest.approx(1.0, abs=1e-9)


@pytest.mark.parametrize("dataset", ["toy_2d", "iris_4d"])
def test_basis_gives_one_bar_at_100_percent(dataset):
    rows = ALL[dataset]
    stats = column_stats(rows)
    for row in rows:
        p = chances(basis.build(row, stats))
        assert sorted(p.values())[-1] == pytest.approx(1.0)
        assert sum(1 for v in p.values() if v > 1e-12) == 1
        bits = "".join(str(int(x > s["median"])) for x, s in zip(row, stats))
        assert p[bits] == pytest.approx(1.0)


def test_angle_on_toy_matches_cos_and_sin_by_hand():
    rows = ALL["toy_2d"]
    stats = column_stats(rows)
    assert [(s["min"], s["max"]) for s in stats] == [(0.0, 1.0), (0.0, 1.0)]
    for x1, x2 in rows:
        t1, t2 = x1 * math.pi, x2 * math.pi  # toy columns run 0..1, so the tilt is x * pi
        a = (math.cos(t1 / 2), math.sin(t1 / 2))  # q0 amplitudes for |0>, |1>
        b = (math.cos(t2 / 2), math.sin(t2 / 2))  # q1
        expected = {f"{i}{j}": (a[i] * b[j]) ** 2 for i in (0, 1) for j in (0, 1)}
        got = chances(angle.build([x1, x2], stats))
        for label, value in expected.items():
            assert got[label] == pytest.approx(value, abs=1e-9)


def test_angle_bloch_arrows_tilt_by_their_number():
    rows = ALL["toy_2d"]
    stats = column_stats(rows)
    for row in rows:
        for vec, x in zip(bloch_vectors(angle.build(row, stats)), row):
            theta = x * math.pi
            assert vec["x"] == pytest.approx(math.sin(theta), abs=1e-9)
            assert vec["y"] == pytest.approx(0.0, abs=1e-9)
            assert vec["z"] == pytest.approx(math.cos(theta), abs=1e-9)


def test_amplitude_pixels_match_squared_normalized_values():
    for row in ALL["pixels_16d"]:
        qc = amplitude.build(row, None)
        assert qc.num_qubits == 4
        norm2 = sum(x * x for x in row)
        got = probabilities(qc)  # sorted |0000>, |0001>, ... |1111>
        assert [g["label"] for g in got] == [format(i, "04b") for i in range(16)]
        for i, x in enumerate(row):
            # Pixel i lands on result |i> written left to right, so the bars keep the picture's order.
            assert got[i]["p"] == pytest.approx(x * x / norm2, abs=1e-9)


def test_amplitude_pads_with_zeros_and_uses_few_qubits():
    assert [amplitude.n_qubits(k) for k in (1, 2, 3, 4, 5, 16, 17)] == [1, 1, 2, 2, 3, 4, 5]
    p = chances(amplitude.build([3.0, 4.0, 0.0], None))
    assert p == pytest.approx({"00": 9 / 25, "01": 16 / 25, "10": 0.0, "11": 0.0})


def test_amplitude_all_zero_row_gets_a_sentence():
    with pytest.raises(CannotEncode, match="nothing to pack"):
        amplitude.build([0.0, 0.0], None)


def test_big_endian_q0_is_the_leftmost_bit():
    # Raw Qiskit: flip only q1. Qiskit itself would call this '10'; we must say |01>.
    qc = QuantumCircuit(2)
    qc.x(1)
    assert chances(qc)["01"] == pytest.approx(1.0)

    stats = column_stats(ALL["toy_2d"])
    # Basis: (0.2, 0.8) -> q0 below its median (0), q1 above (1) -> |01>.
    assert chances(basis.build([0.2, 0.8], stats))["01"] == pytest.approx(1.0)
    # Angle: q0 not tilted, q1 tilted all the way (pi) -> |01>.
    assert chances(angle.build([0.0, 1.0], stats))["01"] == pytest.approx(1.0)
    # Amplitude: second number only -> second result |01>.
    assert chances(amplitude.build([0.0, 1.0, 0.0, 0.0], None))["01"] == pytest.approx(1.0)
    # Bloch arrows follow the same order: q0 points up (|0>), q1 points down (|1>).
    z = [v["z"] for v in bloch_vectors(basis.build([0.2, 0.8], stats))]
    assert z == pytest.approx([1.0, -1.0])


def test_more_than_seven_qubits_is_a_plain_message():
    row = [float(i) for i in range(8)]
    stats = column_stats([row, [v + 1 for v in row]])
    for enc in (basis, angle, iqp, hamiltonian):
        with pytest.raises(CannotEncode, match="8 numbers would need 8 qubits here. Try Amplitude."):
            enc.build(row, stats)
    # Seven numbers is fine.
    assert angle.build(row[:7], stats[:7]).num_qubits == 7


def pauli_op(terms: list[tuple[str, list[int], float]], n: int) -> np.ndarray:
    return SparsePauliOp.from_sparse_list(terms, num_qubits=n).to_matrix()


def same_up_to_global_phase(a: np.ndarray, b: np.ndarray) -> bool:
    k = np.argmax(np.abs(b))
    phase = a.flat[k] / b.flat[k]
    return np.allclose(a, phase * b, atol=1e-9)


def test_iqp_circuit_matches_its_formula():
    rows = ALL["iris_4d"]
    stats = column_stats(rows)
    row = rows[4]
    x = iqp.scale(row, stats)
    n = len(x)
    exponent = pauli_op(
        [("Z", [q], x[q]) for q in range(n)]
        + [("ZZ", [q, q + 1], (math.pi - x[q]) * (math.pi - x[q + 1])) for q in range(n - 1)],
        n,
    )
    h_all = QuantumCircuit(n)
    h_all.h(range(n))
    block = expm(1j * exponent) @ Operator(h_all).data
    assert same_up_to_global_phase(Operator(iqp.build(row, stats)).data, block @ block)


def test_hamiltonian_circuit_is_two_trotter_steps_of_its_formula():
    rows = ALL["iris_4d"]
    stats = column_stats(rows)
    row = rows[6]
    x = hamiltonian.scale(row, stats)
    n = len(x)
    dt = hamiltonian.TIME / hamiltonian.TROTTER_STEPS
    z_part = pauli_op([("Z", [q], x[q]) for q in range(n)], n)
    xx_part = pauli_op([("XX", [q, q + 1], x[q] * x[q + 1]) for q in range(n - 1)], n)
    step = expm(-1j * dt * xx_part) @ expm(-1j * dt * z_part)
    plus = QuantumCircuit(n)
    plus.h(range(n))
    expected = step @ step @ Operator(plus).data
    assert same_up_to_global_phase(Operator(hamiltonian.build(row, stats)).data, expected)
    # Two Trotter steps (fixed in PLAN.md) stay close to the exact evolution: about 91% overlap here.
    exact = expm(-1j * hamiltonian.TIME * (z_part + xx_part)) @ Operator(plus).data
    start = np.zeros(2**n)
    start[0] = 1
    overlap = abs(np.vdot(exact @ start, expected @ start)) ** 2
    assert overlap > 0.9


def test_hamiltonian_bars_shift_smoothly():
    # Nudging one number a little moves the bars only a little.
    stats = column_stats(ALL["toy_2d"])
    a = probabilities(hamiltonian.build([0.40, 0.60], stats))
    b = probabilities(hamiltonian.build([0.42, 0.60], stats))
    assert max(abs(p["p"] - q["p"]) for p, q in zip(a, b)) < 0.02


def test_formulas_render_for_every_row():
    for name, rows in ALL.items():
        stats = column_stats(rows)
        for row in rows:
            for enc in ENCODERS.values():
                if enc is not amplitude and len(row) > 7:
                    continue
                text = enc.formula(row, stats)
                assert text and "nan" not in text
