"""Qiskit code templates. Fields: {n} qubits, {row} raw numbers, {values}
scaled numbers, {bits} for basis, {size} = 2 ** n. Literal braces are doubled."""

FOOTER = """
state = Statevector.from_instruction(qc)
print(state.probabilities_dict())  # note: Qiskit writes q0 as the rightmost bit
"""

TEMPLATES = {
    "basis": """
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

bits = {bits}  # 1 if the number is above its column's median

qc = QuantumCircuit({n})
for q, bit in enumerate(bits):
    if bit:
        qc.x(q)
""" + FOOTER,
    "angle": """
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

angles = {values}  # each number scaled to 0..pi

qc = QuantumCircuit({n})
for q, angle in enumerate(angles):
    qc.ry(angle, q)
""" + FOOTER,
    "amplitude": """
import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import StatePreparation
from qiskit.quantum_info import Statevector

numbers = np.array({row}, dtype=float)
padded = np.pad(numbers, (0, {size} - len(numbers)))  # fill up to {size} slots
amplitudes = padded / np.linalg.norm(padded)          # divide by total length

qc = QuantumCircuit({n})
qc.append(StatePreparation(amplitudes), range({n}))
""" + FOOTER,
    "iqp": """
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

x = {values}  # each number scaled to 0..pi

qc = QuantumCircuit({n})
for repeat in range(2):
    qc.h(range({n}))
    for q in range({n}):
        qc.rz(-2 * x[q], q)  # exp(i x Z)
    for q in range({n} - 1):
        qc.rzz(-2 * (np.pi - x[q]) * (np.pi - x[q + 1]), q, q + 1)  # neighbours talk
""" + FOOTER,
    "hamiltonian": """
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

x = {values}  # each number scaled to 0..1
t, steps = 1.0, 2
dt = t / steps

qc = QuantumCircuit({n})
qc.h(range({n}))  # start in |+> on every qubit
for step in range(steps):
    for q in range({n}):
        qc.rz(2 * x[q] * dt, q)  # x_i Z_i
    for q in range({n} - 1):
        qc.rxx(2 * x[q] * x[q + 1] * dt, q, q + 1)  # x_i x_(i+1) X_i X_(i+1)
""" + FOOTER,
}
