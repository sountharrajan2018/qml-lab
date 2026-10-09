"""Kernels for the pipeline builder: how alike two encoded rows are."""

from __future__ import annotations

import numpy as np

from ..core import statevector
from . import featuremaps

SHOTS = 1024


def states(encoding: str, X, stats) -> np.ndarray:
    """Statevectors in Qiskit's order (q0 = lowest bit)."""
    return np.array([statevector(featuremaps.circuit(encoding, x, stats)).data for x in X])


def fidelity(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    return np.abs(A.conj() @ B.T) ** 2


def fidelity_shots(A: np.ndarray, B: np.ndarray, seed: int = 42) -> np.ndarray:
    """What a real device would estimate: the |0...0> count out of 1024 runs."""
    exact = fidelity(A, B)
    est = np.random.default_rng(seed).binomial(SHOTS, np.clip(exact, 0, 1)) / SHOTS
    if A is B:  # keep the square table symmetric with 1s on the diagonal
        est = np.triu(est, 1)
        est = est + est.T + np.eye(len(A))
    return est


def bloch_vectors(S: np.ndarray) -> np.ndarray:
    """(rows, qubits, 3) Bloch vectors of each qubit on its own."""
    n = int(np.log2(S.shape[1]))
    out = np.zeros((len(S), n, 3))
    for r, psi in enumerate(S):
        t = psi.reshape([2] * n)
        for q in range(n):
            m = np.moveaxis(t, n - 1 - q, 0).reshape(2, -1)
            rho = m @ m.conj().T
            out[r, q] = [2 * rho[0, 1].real, -2 * rho[0, 1].imag, (rho[0, 0] - rho[1, 1]).real]
    return out


def projected(A: np.ndarray, B: np.ndarray, gamma: float) -> np.ndarray:
    """Compare qubit by qubit: exp(-gamma * sum of squared Bloch-vector distances)."""
    a, b = bloch_vectors(A), bloch_vectors(B)
    d2 = ((a[:, None] - b[None]) ** 2).sum(axis=(2, 3))
    return np.exp(-gamma * d2)


def projected_gamma(A: np.ndarray) -> float:
    """Width from the median distance between training rows (the 'median rule')."""
    a = bloch_vectors(A)
    d2 = ((a[:, None] - a[None]) ** 2).sum(axis=(2, 3))
    med = np.median(d2[np.triu_indices(len(A), 1)])
    return 1.0 / med if med > 0 else 1.0


KERNELS = {
    "fidelity": "Fidelity kernel (exact)",
    "fidelity_shots": "Fidelity kernel (1024 shots, like real hardware)",
    "projected": "Projected quantum kernel",
}


def build(kernel: str, S_train: np.ndarray, S_test: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if kernel == "fidelity":
        return fidelity(S_train, S_train), fidelity(S_test, S_train)
    if kernel == "fidelity_shots":
        return fidelity_shots(S_train, S_train, 42), fidelity_shots(S_test, S_train, 7)
    g = projected_gamma(S_train)
    return projected(S_train, S_train, g), projected(S_test, S_train, g)
