"""Basis encoding: each number becomes a 0 or a 1.

Picture it as a row of light switches. Each number is compared with its
column's middle value (median): above it is 1, otherwise 0. A 1 is an X gate.
"""

from qiskit import QuantumCircuit

from ..core import check_qubits, fmt

# Fixed setting: a number above its column's median becomes 1.
THRESHOLD = "median"


def n_qubits(n_numbers: int) -> int:
    return n_numbers


def scale(row: list[float], stats: list[dict]) -> list[int]:
    return [1 if x > s[THRESHOLD] else 0 for x, s in zip(row, stats)]


def build(row: list[float], stats: list[dict]) -> QuantumCircuit:
    check_qubits(n_qubits(len(row)), len(row))
    bits = scale(row, stats)
    qc = QuantumCircuit(len(bits))
    for q, bit in enumerate(bits):
        if bit:
            qc.x(q)
    return qc


def formula(row: list[float], stats: list[dict]) -> str:
    bits = "".join(str(b) for b in scale(row, stats))
    numbers = ",\\ ".join(fmt(x) for x in row)
    middles = ",\\ ".join(fmt(s[THRESHOLD]) for s in stats)
    return (
        f"({numbers}) \\rightarrow |{bits}\\rangle"
        f"\\qquad b_i = 1 \\text{{ if }} x_i > \\text{{median}} = ({middles})"
    )
