"""PennyLane code templates (shown as text only; PennyLane is not installed).
Same fields as qiskit_code.py. Literal braces are doubled."""

HEADER = """
import pennylane as qml

dev = qml.device("default.qubit", wires={n})
"""

FOOTER = """
print(circuit())  # PennyLane already writes wire 0 as the leftmost bit
"""

TEMPLATES = {
    "basis": HEADER + """
bits = {bits}  # 1 if the number is above its column's median

@qml.qnode(dev)
def circuit():
    qml.BasisEmbedding(bits, wires=range({n}))
    return qml.probs(wires=range({n}))
""" + FOOTER,
    "angle": HEADER + """
angles = {values}  # each number scaled to 0..pi

@qml.qnode(dev)
def circuit():
    qml.AngleEmbedding(angles, wires=range({n}), rotation="Y")
    return qml.probs(wires=range({n}))
""" + FOOTER,
    "amplitude": HEADER + """
numbers = {row}

@qml.qnode(dev)
def circuit():
    qml.AmplitudeEmbedding(numbers, wires=range({n}), pad_with=0.0, normalize=True)
    return qml.probs(wires=range({n}))
""" + FOOTER,
    "iqp": "import numpy as np\n" + HEADER + """
x = {values}  # each number scaled to 0..pi

@qml.qnode(dev)
def circuit():
    for repeat in range(2):
        for q in range({n}):
            qml.Hadamard(wires=q)
        for q in range({n}):
            qml.RZ(-2 * x[q], wires=q)  # exp(i x Z)
        for q in range({n} - 1):
            qml.IsingZZ(-2 * (np.pi - x[q]) * (np.pi - x[q + 1]), wires=[q, q + 1])
    return qml.probs(wires=range({n}))
""" + FOOTER,
    "hamiltonian": HEADER + """
x = {values}  # each number scaled to 0..1
t, steps = 1.0, 2
dt = t / steps

@qml.qnode(dev)
def circuit():
    for q in range({n}):
        qml.Hadamard(wires=q)  # start in |+> on every qubit
    for step in range(steps):
        for q in range({n}):
            qml.RZ(2 * x[q] * dt, wires=q)  # x_i Z_i
        for q in range({n} - 1):
            qml.IsingXX(2 * x[q] * x[q + 1] * dt, wires=[q, q + 1])
    return qml.probs(wires=range({n}))
""" + FOOTER,
}
