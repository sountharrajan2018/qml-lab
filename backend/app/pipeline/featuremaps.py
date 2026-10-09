"""Encodings for the pipeline builder: one function per drop-down entry.

Each turns one row (already scaled, see `prepare`) into a circuit. They follow
the Encoding Lab's encodings, plus Qiskit's ZZ feature map (all pairs talk).
The builder allows up to 10 numbers, so these skip the Lab's 7-qubit cap.
"""

from __future__ import annotations

import math

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import StatePreparation

from ..core import big_endian_label, neighbour_pairs, qubits_for_amplitude, rescale  # noqa: F401  (rescale is re-exported)

REPS = 2


def _basis(x):
    qc = QuantumCircuit(len(x))
    for q, bit in enumerate(x):
        if bit:
            qc.x(q)
    return qc


def _angle(x):
    qc = QuantumCircuit(len(x))
    for q, theta in enumerate(x):
        qc.ry(theta, q)
    return qc


def _zz(x, pairs):
    """Havlicek et al. ZZ feature map: H, P(2x), then a CX-P-CX block per pair."""
    n = len(x)
    qc = QuantumCircuit(n)
    for rep in range(REPS):
        if rep:
            qc.barrier()
        qc.h(range(n))
        for q in range(n):
            qc.p(2 * x[q], q)
        for a, b in pairs:
            qc.cx(a, b)
            qc.p(2 * (math.pi - x[a]) * (math.pi - x[b]), b)
            qc.cx(a, b)
    return qc


def _iqp(x):
    n = len(x)
    qc = QuantumCircuit(n)
    for rep in range(REPS):
        if rep:
            qc.barrier()
        qc.h(range(n))
        for q in range(n):
            qc.rz(-2 * x[q], q)
        for a, b in neighbour_pairs(n):
            qc.rzz(-2 * (math.pi - x[a]) * (math.pi - x[b]), a, b)
    return qc


def _amplitude(x):
    n = qubits_for_amplitude(len(x))
    v = np.zeros(2**n)
    v[: len(x)] = x
    v = v / np.linalg.norm(v)
    state = np.zeros(2**n)
    for i, a in enumerate(v):
        state[int(big_endian_label(i, n), 2)] = a
    qc = QuantumCircuit(n)
    qc.append(StatePreparation(state), range(n))
    return qc


def _hamiltonian(x):
    n = len(x)
    dt = 1.0 / 2
    qc = QuantumCircuit(n)
    qc.h(range(n))
    for _ in range(2):
        qc.barrier()
        for q in range(n):
            qc.rz(2 * x[q] * dt, q)
        for a, b in neighbour_pairs(n):
            qc.rxx(2 * x[a] * x[b] * dt, a, b)
    return qc


# id: (label, how numbers are prepared, top of the scale, circuit builder)
ENCODINGS = {
    "angle": ("Angle encoding", "minmax", math.pi, _angle),
    # ZZ and IQP use a quarter turn: with 4+ numbers, bigger angles make every row look
    # different from every other and the kernel stops being useful (measured: 58% -> 100%).
    "zz": ("ZZ feature map", "minmax", math.pi / 4, lambda x: _zz(x, [(a, b) for a in range(len(x)) for b in range(a + 1, len(x))])),
    "iqp": ("IQP encoding", "minmax", math.pi / 4, _iqp),
    "amplitude": ("Amplitude encoding", "minmax_floor", 1.0, _amplitude),
    "hamiltonian": ("Hamiltonian encoding", "minmax", 1.0, _hamiltonian),
    "basis": ("Basis encoding", "median", 1, _basis),
}


def column_stats(X) -> list[dict]:
    X = np.asarray(X, dtype=float)
    return [{"min": float(c.min()), "max": float(c.max()), "median": float(np.median(c))} for c in X.T]


def prepare(encoding: str, x, stats) -> list[float]:
    """Turn one row's numbers into what the circuit uses (angles, strengths, bits...)."""
    _, rule, top, _ = ENCODINGS[encoding]
    if rule == "median":
        return [1 if v > s["median"] else 0 for v, s in zip(x, stats)]
    out = [rescale(v, s, top) for v, s in zip(x, stats)]
    if rule == "minmax_floor":
        # Amplitude needs a non-zero row, so every number keeps a small floor.
        out = [0.1 + 0.9 * v for v in out]
    return out


def n_qubits(encoding: str, n_features: int) -> int:
    return qubits_for_amplitude(n_features) if encoding == "amplitude" else n_features


def circuit(encoding: str, x, stats) -> QuantumCircuit:
    return ENCODINGS[encoding][3](prepare(encoding, x, stats))
