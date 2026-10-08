"""IQP encoding: qubits tilt, then talk to each other.

Picture it as angle encoding plus neighbours whispering to each other:
Hadamards, then data-driven Z phases and ZZ phases between neighbouring
qubits, all repeated twice.

U(x) = ( exp(i sum x_i Z_i + i sum (pi - x_i)(pi - x_{i+1}) Z_i Z_{i+1}) H^n )^2
"""

import math

from qiskit import QuantumCircuit

from ..core import check_qubits, fmt, rescale

# Fixed settings.
SCALE_TOP = math.pi  # numbers are scaled onto 0..pi
REPS = 2  # the block is repeated twice


def n_qubits(n_numbers: int) -> int:
    return n_numbers


def scale(row: list[float], stats: list[dict]) -> list[float]:
    return [rescale(x, s, SCALE_TOP) for x, s in zip(row, stats)]


def pair_strength(a: float, b: float) -> float:
    return (math.pi - a) * (math.pi - b)


def build(row: list[float], stats: list[dict]) -> QuantumCircuit:
    check_qubits(n_qubits(len(row)), len(row))
    x = scale(row, stats)
    n = len(x)
    qc = QuantumCircuit(n)
    for rep in range(REPS):
        if rep:
            qc.barrier()
        qc.h(range(n))
        # exp(i x Z) = RZ(-2x) and exp(i phi ZZ) = RZZ(-2 phi), up to global phase.
        for q in range(n):
            qc.rz(-2 * x[q], q)
        for q in range(n - 1):
            qc.rzz(-2 * pair_strength(x[q], x[q + 1]), q, q + 1)
    return qc


def formula(row: list[float], stats: list[dict]) -> str:
    x = scale(row, stats)
    n = len(x)
    singles = " + ".join(f"{fmt(v)}\\,Z_{q}" for q, v in enumerate(x))
    pairs = " + ".join(
        f"{fmt(pair_strength(x[q], x[q + 1]))}\\,Z_{q}Z_{q + 1}" for q in range(n - 1)
    )
    exponent = f"i({singles})" + (f" + i({pairs})" if pairs else "")
    return f"U(x) = \\big( e^{{\\,{exponent}}}\; H^{{\\otimes {n}}} \\big)^{REPS}"
