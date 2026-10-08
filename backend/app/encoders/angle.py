"""Angle encoding: each number tilts one qubit.

Picture it as each number turning a dial. Numbers are scaled to 0..pi using
their column's min and max, then each one rotates its own qubit with RY.
"""

import math

from qiskit import QuantumCircuit

from ..core import check_qubits, fmt, rescale

# Fixed setting: numbers are scaled onto 0..pi.
SCALE_TOP = math.pi


def n_qubits(n_numbers: int) -> int:
    return n_numbers


def scale(row: list[float], stats: list[dict]) -> list[float]:
    return [rescale(x, s, SCALE_TOP) for x, s in zip(row, stats)]


def build(row: list[float], stats: list[dict]) -> QuantumCircuit:
    check_qubits(n_qubits(len(row)), len(row))
    angles = scale(row, stats)
    qc = QuantumCircuit(len(angles))
    for q, theta in enumerate(angles):
        qc.ry(theta, q)
    return qc


def formula(row: list[float], stats: list[dict]) -> str:
    lines = []
    for q, theta in enumerate(scale(row, stats)):
        c, s = math.cos(theta / 2), math.sin(theta / 2)
        lines.append(
            f"q_{q}:\\ R_Y({fmt(theta)})|0\\rangle &= \\cos\\tfrac{{{fmt(theta)}}}{{2}}\\,|0\\rangle"
            f" + \\sin\\tfrac{{{fmt(theta)}}}{{2}}\\,|1\\rangle = {fmt(c)}\\,|0\\rangle + {fmt(s)}\\,|1\\rangle"
        )
    return "\\begin{aligned}" + " \\\\ ".join(lines) + "\\end{aligned}"
