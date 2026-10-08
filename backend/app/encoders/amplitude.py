"""Amplitude encoding: all numbers share the qubits together.

Picture it as packing numbers into a suitcase. The numbers are divided by
their total length so they fit, then stored as the state itself: number i
becomes the amplitude of result |i>. 16 numbers need only 4 qubits.
"""

import math

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import StatePreparation

from ..core import CannotEncode, big_endian_label, check_qubits, fmt, qubits_for_amplitude

# Fixed setting: missing slots are padded with zeros.
PAD_VALUE = 0.0


def n_qubits(n_numbers: int) -> int:
    return qubits_for_amplitude(n_numbers)


def scale(row: list[float], stats: list[dict] | None = None) -> list[float]:
    """The numbers divided by their length, padded to a power of two."""
    size = 2 ** n_qubits(len(row))
    padded = np.array(list(row) + [PAD_VALUE] * (size - len(row)), dtype=float)
    norm = float(np.linalg.norm(padded))
    if norm == 0:
        raise CannotEncode("All the numbers are zero, so there is nothing to pack.")
    return [float(v) for v in padded / norm]


def build(row: list[float], stats: list[dict] | None = None) -> QuantumCircuit:
    n = n_qubits(len(row))
    check_qubits(n, len(row))
    amplitudes = scale(row, stats)
    # Number i goes on the big-endian result |i> (q0 = leftmost bit). Qiskit
    # counts q0 as the rightmost bit, so reorder before loading.
    state = np.zeros(2**n)
    for i, a in enumerate(amplitudes):
        state[int(big_endian_label(i, n), 2)] = a
    qc = QuantumCircuit(n)
    qc.append(StatePreparation(state), range(n))
    return qc


def formula(row: list[float], stats: list[dict] | None = None) -> str:
    n = n_qubits(len(row))
    size = 2**n
    padded = list(row) + [PAD_VALUE] * (size - len(row))
    norm = math.sqrt(sum(x * x for x in padded))
    terms = [f"{fmt(x)}\\,|{format(i, f'0{n}b')}\\rangle" for i, x in enumerate(padded)]
    if len(terms) > 4:
        terms = terms[:3] + ["\\cdots"] + terms[-1:]
    return f"|x\\rangle = \\frac{{1}}{{{fmt(norm)}}}\\big(" + " + ".join(terms) + "\\big)"
