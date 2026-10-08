"""Turns one row into everything the screen shows for one encoding."""

from __future__ import annotations

import io
import threading

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from qiskit import QuantumCircuit, transpile  # noqa: E402
from qiskit.circuit import Gate  # noqa: E402
from qiskit.circuit.library import StatePreparation  # noqa: E402

from . import snippets  # noqa: E402
from .core import CannotEncode, bloch_vectors, gate_count, probabilities  # noqa: E402
from .encoders import ENCODERS  # noqa: E402

# Per-qubit Bloch spheres only make sense where every qubit stands on its own.
BLOCH_ENCODINGS = {"basis", "angle"}

DRAW_STYLE = {
    "name": "iqp-dark",
    "backgroundcolor": "#000000",
    "fontsize": 18,
    "subfontsize": 14,
}

# Matplotlib is not thread-safe and FastAPI runs requests on a thread pool.
_draw_lock = threading.Lock()


def for_drawing(qc: QuantumCircuit) -> QuantumCircuit:
    """Show StatePreparation as one plain box, without its long list of numbers."""
    out = QuantumCircuit(qc.num_qubits)
    for inst in qc.data:
        op = inst.operation
        if isinstance(op, StatePreparation):
            op = Gate("State Preparation", op.num_qubits, [])
        out.append(op, inst.qubits, inst.clbits)
    return out


def circuit_svg(qc: QuantumCircuit) -> str:
    with _draw_lock:
        fig = for_drawing(qc).draw("mpl", style=DRAW_STYLE, fold=-1)
        buf = io.StringIO()
        fig.savefig(buf, format="svg", bbox_inches="tight", facecolor="#000000")
        plt.close(fig)
    svg = buf.getvalue()
    return svg[svg.index("<svg") :]  # drop the XML prolog so it can be inlined


def loading_cost(encoding: str, qc: QuantumCircuit) -> int:
    """Gates on screen; amplitude counts its box after unpacking into basic gates."""
    if encoding == "amplitude":
        return gate_count(transpile(qc, basis_gates=["u", "cx"], optimization_level=0))
    return gate_count(qc)


def encode(encoding: str, row: list[float], stats: list[dict], draw: bool = True) -> dict:
    enc = ENCODERS[encoding]
    result = {
        "encoding": encoding,
        "n_qubits": enc.n_qubits(len(row)),
        "scaled": None,
        "circuit_svg": None,
        "gate_count": None,
        "probabilities": None,
        "bloch": None,
        "formula_latex": None,
        "code": None,
        "message": None,
    }
    try:
        qc = enc.build(row, stats)
        scaled = enc.scale(row, stats)
    except CannotEncode as e:
        result["message"] = str(e)
        return result
    result.update(
        scaled=[float(v) for v in scaled],
        gate_count=loading_cost(encoding, qc),
        probabilities=[{"label": p["label"], "p": round(p["p"], 6)} for p in probabilities(qc)],
    )
    if draw:
        result.update(
            circuit_svg=circuit_svg(qc),
            bloch=bloch_vectors(qc) if encoding in BLOCH_ENCODINGS else None,
            formula_latex=enc.formula(row, stats),
            code=snippets.render(encoding, row, scaled, qc.num_qubits),
        )
    return result


def compare(row: list[float], stats: list[dict]) -> list[dict]:
    keep = ("encoding", "n_qubits", "gate_count", "probabilities", "message")
    return [
        {k: v for k, v in encode(name, row, stats, draw=False).items() if k in keep}
        for name in ENCODERS
    ]


def warm_up() -> None:
    """Run every encoding once so the first click in class is fast."""
    stats = [{"min": 0.0, "max": 1.0, "median": 0.5}] * 2
    for name in ENCODERS:
        encode(name, [0.2, 0.8], stats)
