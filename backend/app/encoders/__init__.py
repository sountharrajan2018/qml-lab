"""The five encodings, one file each. Every module has build(row, stats)."""

from . import amplitude, angle, basis, hamiltonian, iqp

ENCODERS = {
    "basis": basis,
    "angle": angle,
    "amplitude": amplitude,
    "iqp": iqp,
    "hamiltonian": hamiltonian,
}
