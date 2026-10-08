"""Shared helpers: scaling, exact simulation and big-endian results.

Every encoder in ``encoders/`` builds a plain Qiskit circuit. This module turns
that circuit into what the screen shows. Probabilities are always returned in
big-endian order: qubit 0 is the leftmost bit of every label, so |01> means
q0 = 0 and q1 = 1.
"""

from __future__ import annotations

import math
from statistics import median

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace

MAX_QUBITS = 7


class CannotEncode(Exception):
    """Raised with one plain sentence when an encoding cannot take a row."""


def column_stats(rows: list[list[float]]) -> list[dict]:
    """Min, max and median of each column (the frontend computes the same)."""
    columns = list(zip(*rows))
    return [{"min": min(c), "max": max(c), "median": median(c)} for c in columns]


def rescale(value: float, stat: dict, top: float) -> float:
    """Map a number from its column's [min, max] onto [0, top]."""
    span = stat["max"] - stat["min"]
    if span == 0:
        return 0.0
    clipped = min(max(value, stat["min"]), stat["max"])
    return (clipped - stat["min"]) / span * top


def fmt(x: float) -> str:
    """Short number for formulas and code: at most 3 decimals."""
    r = round(float(x), 3)
    if r == 0:
        r = 0.0  # avoid "-0"
    return f"{r:g}"


def check_qubits(n_qubits: int, n_numbers: int) -> None:
    if n_qubits > MAX_QUBITS:
        if n_qubits == n_numbers:
            raise CannotEncode(
                f"{n_numbers} numbers would need {n_qubits} qubits here. Try Amplitude."
            )
        raise CannotEncode(
            f"{n_numbers} numbers would need {n_qubits} qubits, and this lab stops at {MAX_QUBITS}."
        )


def big_endian_label(index: int, n_qubits: int) -> str:
    """Qiskit counts q0 as the rightmost bit; we put q0 on the left."""
    return "".join(str((index >> q) & 1) for q in range(n_qubits))


def statevector(qc: QuantumCircuit) -> Statevector:
    return Statevector.from_instruction(qc)


def probabilities(qc: QuantumCircuit) -> list[dict]:
    """Exact chance of each result, labelled big-endian and sorted |00..>, |00..1>, ..."""
    probs = statevector(qc).probabilities()
    n = qc.num_qubits
    out = [{"label": big_endian_label(i, n), "p": float(p)} for i, p in enumerate(probs)]
    return sorted(out, key=lambda item: item["label"])


def bloch_vectors(qc: QuantumCircuit) -> list[dict]:
    """Bloch vector of each qubit on its own (only meaningful for product states)."""
    state = DensityMatrix(statevector(qc))
    n = qc.num_qubits
    paulis = {
        "x": np.array([[0, 1], [1, 0]]),
        "y": np.array([[0, -1j], [1j, 0]]),
        "z": np.array([[1, 0], [0, -1]]),
    }
    vectors = []
    for q in range(n):
        others = [k for k in range(n) if k != q]
        rho = partial_trace(state, others).data if others else state.data
        vectors.append({axis: float(np.real(np.trace(rho @ m))) for axis, m in paulis.items()})
    return vectors


def neighbour_pairs(n: int) -> list[tuple[int, int]]:
    """Pairs (0,1), (2,3), ... then (1,2), (3,4), ... The pair gates used here all
    commute, so this order changes nothing except letting the drawing put
    non-touching pairs side by side."""
    return [(q, q + 1) for start in (0, 1) for q in range(start, n - 1, 2)]


def gate_count(qc: QuantumCircuit) -> int:
    return sum(n for name, n in qc.count_ops().items() if name != "barrier")


def qubits_for_amplitude(n_numbers: int) -> int:
    return max(1, math.ceil(math.log2(n_numbers))) if n_numbers > 1 else 1
