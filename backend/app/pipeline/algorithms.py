"""Algorithms for the pipeline builder. Kernel algorithms only see the kernel
table; the QNN instead trains its own dials and uses no kernel."""

from __future__ import annotations

import warnings

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit import ParameterVector
from scipy.optimize import minimize
from sklearn.cluster import KMeans, SpectralClustering
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC

SEED = 42
KNN_K = 3
QNN_LAYERS = 2
QNN_STEPS = 120

ALGORITHMS = {
    "qsvm": ("Quantum SVM", True),  # (label, uses a kernel)
    "qknn": ("Quantum k-nearest neighbours", True),
    "qclustering": ("Quantum clustering", True),
    "qnn": ("Quantum neural network (QNN)", False),
}


def qsvm(K_train, y_train, K_test):
    return SVC(kernel="precomputed").fit(K_train, y_train).predict(K_test)


def qknn(K_train, y_train, K_test):
    # Distance = 1 - similarity, so the 3 most alike training rows vote.
    k = min(KNN_K, len(y_train))
    model = KNeighborsClassifier(n_neighbors=k, metric="precomputed")
    model.fit(np.clip(1 - K_train, 0, None), y_train)
    return model.predict(np.clip(1 - K_test, 0, None))


def qclustering(K_all, n_groups):
    with warnings.catch_warnings():
        # Basis encoding gives 0/1 similarities, which scikit-learn warns about; the result is still valid.
        warnings.simplefilter("ignore", UserWarning)
        return SpectralClustering(n_groups, affinity="precomputed", random_state=SEED).fit_predict(K_all)


# ---------- QNN: encoding, then trainable layers, then read qubit 0 ----------


def qnn_ansatz(n: int):
    p = ParameterVector("θ", n * (QNN_LAYERS + 1))
    qc = QuantumCircuit(n)
    i = 0
    for layer in range(QNN_LAYERS + 1):
        for q in range(n):
            qc.ry(p[i], q)
            i += 1
        if layer < QNN_LAYERS:
            for q in range(n - 1):
                qc.cx(q, q + 1)
    return qc, p


def _apply_ansatz(S: np.ndarray, theta: np.ndarray) -> np.ndarray:
    """Apply qnn_ansatz to every row at once, gate by gate, with numpy.

    Same result as Qiskit's Operator(ansatz) (a test checks this), but fast enough to
    train a 10-qubit QNN in seconds: it never builds the 1024 x 1024 matrix.
    """
    N, dim = S.shape
    n = int(np.log2(dim))
    psi = S.reshape((N,) + (2,) * n).astype(complex)
    axis = lambda q: 1 + (n - 1 - q)  # Qiskit puts q0 in the lowest bit, which is the last axis
    i = 0
    for layer in range(QNN_LAYERS + 1):
        for q in range(n):
            c, s_ = np.cos(theta[i] / 2), np.sin(theta[i] / 2)
            ry = np.array([[c, -s_], [s_, c]])
            psi = np.moveaxis(np.moveaxis(psi, axis(q), -1) @ ry.T, -1, axis(q))
            i += 1
        if layer < QNN_LAYERS:
            for q in range(n - 1):  # CX(q, q+1): flip the target where the control is 1
                ctrl, tgt = axis(q), axis(q + 1)
                sl = [slice(None)] * (n + 1)
                sl[ctrl] = 1
                sub = psi[tuple(sl)]
                psi[tuple(sl)] = np.flip(sub, axis=tgt - (1 if tgt > ctrl else 0))
    return psi.reshape(N, dim)


def qnn_readout(theta: np.ndarray, S: np.ndarray) -> np.ndarray:
    """Z of qubit 0 for each row: +1 means label 0, -1 means label 1."""
    sign = 1 - 2 * (np.arange(S.shape[1]) & 1)
    return (np.abs(_apply_ansatz(S, theta)) ** 2) @ sign


def qnn_train(S_train: np.ndarray, y_train: np.ndarray):
    """Binary labels 0/1. Returns (dials, loss history)."""
    n = int(np.log2(S_train.shape[1]))
    n_dials = n * (QNN_LAYERS + 1)
    target = 1 - 2 * y_train
    history: list[float] = []

    def loss(theta):
        v = float(np.mean((qnn_readout(theta, S_train) - target) ** 2))
        history.append(round(v, 4))
        return v

    start = np.random.default_rng(SEED).uniform(0, 2 * np.pi, n_dials)
    res = minimize(loss, start, method="COBYLA", options={"maxiter": QNN_STEPS})
    return res.x, history


def qnn(S_train, y_train, S_test):
    theta, history = qnn_train(S_train, y_train)
    return (qnn_readout(theta, S_test) < 0).astype(int), history, len(theta)


# ---------- classical versions on the same scaled numbers ----------


def classical(algorithm: str, X_train, y_train, X_test, n_groups=2):
    if algorithm == "qsvm":
        return "Classical SVM", SVC(kernel="rbf").fit(X_train, y_train).predict(X_test)
    if algorithm == "qknn":
        k = min(KNN_K, len(y_train))
        return "Classical k-nearest neighbours", KNeighborsClassifier(n_neighbors=k).fit(X_train, y_train).predict(X_test)
    if algorithm == "qclustering":
        return "Classical k-means", KMeans(n_groups, n_init=10, random_state=SEED).fit_predict(X_train)
    mlp = MLPClassifier((8,), max_iter=2000, random_state=SEED).fit(X_train, y_train)
    return "Classical neural network", mlp.predict(X_test)
