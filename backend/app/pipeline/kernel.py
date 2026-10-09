"""The quantum kernel: how alike two encoded dots are.

Each dot is IQP-encoded into a quantum state |x>. The kernel of two dots is
the squared overlap |<x|x'>|^2: 1 for identical states, near 0 for very
different ones.
"""

from __future__ import annotations

import math

import numpy as np

from ..core import column_stats, statevector
from ..encoders import iqp

# Fixed setting: numbers are scaled onto 0..pi/2. The full 0..pi range used in
# the Encoding Lab makes every pair of dots look different and the SVM drops
# from 95% to 75% on the moons.
SCALE_TOP = math.pi / 2


def stats_for(X: list[list[float]]) -> list[dict]:
    return column_stats(X)


def circuit(x: list[float], stats: list[dict]):
    return iqp.build(list(x), stats, scale_top=SCALE_TOP)


def scaled(x: list[float], stats: list[dict]) -> list[float]:
    return iqp.scale(list(x), stats, scale_top=SCALE_TOP)


def states(X, stats: list[dict]) -> np.ndarray:
    return np.array([statevector(circuit(x, stats)).data for x in X])


def matrix(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    """Squared overlaps between every state in A and every state in B."""
    return np.abs(A.conj() @ B.T) ** 2
