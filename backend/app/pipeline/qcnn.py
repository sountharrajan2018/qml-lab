"""Quantum CNN: a small trainable circuit that sorts 4x4 line pictures.

The 16 pixels are amplitude-encoded into 4 qubits. "Conv" blocks let two
neighbouring qubits look at each other; "Pool" blocks squeeze two qubits'
information into one. After two rounds one qubit is left, and its Z value
gives the answer: positive means lying down, negative means standing up.

There is no kernel here: the circuit learns by turning its 22 dials.
Training takes about 25 s, so it is done once ahead of time:

    python -m app.pipeline.qcnn        (rewrites qcnn_trained.json)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import SparsePauliOp
from scipy.optimize import minimize
from sklearn.neural_network import MLPClassifier

from ..core import statevector
from ..encoders import amplitude
from .datasets import SEED, lines

# Fixed settings.
N_QUBITS = 4
OUTPUT_QUBIT = 2
TRAIN_STEPS = 300
# (block, qubits): three Conv blocks, two Pools (4 -> 2 qubits), one Conv, one Pool (2 -> 1).
LAYERS = [
    ("Conv", (0, 1)),
    ("Conv", (2, 3)),
    ("Conv", (1, 2)),
    ("Pool", (0, 1)),
    ("Pool", (3, 2)),
    ("Conv", (1, 2)),
    ("Pool", (1, 2)),
]
N_DIALS = sum(4 if kind == "Conv" else 2 for kind, _ in LAYERS)  # 22
TRAINED_FILE = Path(__file__).with_name("qcnn_trained.json")

READOUT = SparsePauliOp.from_sparse_list([("Z", [OUTPUT_QUBIT], 1.0)], num_qubits=N_QUBITS)


def conv(qc: QuantumCircuit, p, a: int, b: int) -> None:
    qc.ry(p[0], a)
    qc.ry(p[1], b)
    qc.cx(a, b)
    qc.ry(p[2], a)
    qc.ry(p[3], b)


def pool(qc: QuantumCircuit, p, src: int, dst: int) -> None:
    qc.crz(p[0], src, dst)
    qc.crx(p[1], src, dst)


def model(params, boxed: bool = False) -> QuantumCircuit:
    """The trainable circuit. boxed=True draws each block as one labelled box."""
    qc = QuantumCircuit(N_QUBITS)
    i = 0
    for step, (kind, (a, b)) in enumerate(LAYERS):
        n = 4 if kind == "Conv" else 2
        p, i = params[i : i + n], i + n
        block = conv if kind == "Conv" else pool
        if boxed:
            if step in (3, 5):
                qc.barrier()
            sub = QuantumCircuit(2)
            block(sub, p, 0, 1)
            qc.append(sub.to_gate(label=kind), [a, b])
        else:
            block(qc, p, a, b)
    return qc


def start_states(X):
    return [statevector(amplitude.build(list(map(float, x)))) for x in X]


def readout(params, states) -> np.ndarray:
    """Z of the last qubit for each picture: +1 lying down, -1 standing up."""
    circuit = model(params)
    return np.array([np.real(s.evolve(circuit).expectation_value(READOUT)) for s in states])


def chance_standing(z: np.ndarray) -> np.ndarray:
    return (1 - z) / 2


def train() -> dict:
    X, y = lines()["train"]
    states = start_states(X)
    target = 1 - 2 * np.array(y)
    history: list[float] = []

    def loss(p):
        value = float(np.mean((readout(p, states) - target) ** 2))
        history.append(round(value, 4))
        return value

    start = np.random.default_rng(SEED).uniform(0, 2 * np.pi, N_DIALS)
    res = minimize(loss, start, method="COBYLA", options={"maxiter": TRAIN_STEPS})
    return {"seed": SEED, "steps": TRAIN_STEPS, "params": [float(v) for v in res.x], "loss": history}


def load_trained() -> dict:
    return json.loads(TRAINED_FILE.read_text())


def run() -> dict:
    data = lines()
    X, y = data["train"]
    Xt, yt = data["test"]
    trained = load_trained()
    params = trained["params"]
    z_test = readout(params, start_states(Xt))
    z_train = readout(params, start_states(X))
    mlp = MLPClassifier((8,), max_iter=2000, random_state=SEED).fit(X, y)
    return {
        "model": model(params, boxed=True),
        "learn": {
            "loss": trained["loss"],
            "train_correct": int(np.sum((z_train < 0).astype(int) == np.array(y))),
        },
        "predictions": [int(z < 0) for z in z_test],
        "chances": [round(float(c), 3) for c in chance_standing(z_test)],
        "classical_predictions": [int(p) for p in mlp.predict(Xt)],
        "classical_name": "Classical neural network",
    }


if __name__ == "__main__":
    result = train()
    TRAINED_FILE.write_text(json.dumps(result))
    print(f"trained {len(result['loss'])} steps, loss {result['loss'][0]} -> {result['loss'][-1]}")
