"""Code shown in the "Show code" drawer: one Qiskit and one PennyLane template
per encoding, with this row's numbers filled in. PennyLane is never run here."""

from .pennylane_code import TEMPLATES as PENNYLANE
from .qiskit_code import TEMPLATES as QISKIT


def number_list(values) -> str:
    return "[" + ", ".join(f"{round(float(v), 4):g}" for v in values) + "]"


def render(encoding: str, row: list[float], scaled: list[float], n_qubits: int) -> dict:
    fields = {
        "n": n_qubits,
        "row": number_list(row),
        "values": number_list(scaled),
        "bits": "[" + ", ".join(str(int(b)) for b in scaled) + "]",
        "size": 2**n_qubits,
    }
    return {
        "qiskit": QISKIT[encoding].format(**fields).strip() + "\n",
        "pennylane": PENNYLANE[encoding].format(**fields).strip() + "\n",
    }
