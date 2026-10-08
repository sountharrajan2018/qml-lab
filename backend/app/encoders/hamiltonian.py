"""Hamiltonian encoding: the numbers control how the qubits evolve.

Picture it as the numbers setting the rules of a tiny physical system, then
letting it run for one second. Start in |+> on every qubit, evolve under

H(x) = sum x_i Z_i + sum x_i x_{i+1} X_i X_{i+1}

for time t = 1, approximated with two Trotter steps.
"""

from qiskit import QuantumCircuit

from ..core import check_qubits, fmt, rescale

# Fixed settings.
SCALE_TOP = 1.0  # numbers are scaled onto 0..1, so they read as strengths
TIME = 1.0
TROTTER_STEPS = 2


def n_qubits(n_numbers: int) -> int:
    return n_numbers


def scale(row: list[float], stats: list[dict]) -> list[float]:
    return [rescale(x, s, SCALE_TOP) for x, s in zip(row, stats)]


def build(row: list[float], stats: list[dict]) -> QuantumCircuit:
    check_qubits(n_qubits(len(row)), len(row))
    x = scale(row, stats)
    n = len(x)
    dt = TIME / TROTTER_STEPS
    qc = QuantumCircuit(n)
    qc.h(range(n))  # start in |+> on every qubit
    for step in range(TROTTER_STEPS):
        qc.barrier()
        # exp(-i a dt Z) = RZ(2 a dt) and exp(-i b dt XX) = RXX(2 b dt).
        for q in range(n):
            qc.rz(2 * x[q] * dt, q)
        for q in range(n - 1):
            qc.rxx(2 * x[q] * x[q + 1] * dt, q, q + 1)
    return qc


def formula(row: list[float], stats: list[dict]) -> str:
    x = scale(row, stats)
    n = len(x)
    singles = " + ".join(f"{fmt(v)}\\,Z_{q}" for q, v in enumerate(x))
    pairs = " + ".join(f"{fmt(x[q] * x[q + 1])}\\,X_{q}X_{q + 1}" for q in range(n - 1))
    h = singles + (f" + {pairs}" if pairs else "")
    return (
        f"H(x) = {h}, \\qquad |x\\rangle = e^{{-iH(x)}}\\,|+\\rangle^{{\\otimes {n}}}"
    )
