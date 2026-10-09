// What each drop-down choice means, in one plain sentence plus a formula,
// and the code pieces that "Show code" stitches into one runnable script.

export type EncodingId = "angle" | "zz" | "iqp" | "amplitude" | "hamiltonian" | "basis";
export type KernelId = "fidelity" | "fidelity_shots" | "projected";
export type AlgorithmId = "qsvm" | "qknn" | "qclustering" | "qnn";

interface Choice<T> {
  id: T;
  name: string;
  sentence: string;
  formula: string;
}

export const ENCODING_CHOICES: Choice<EncodingId>[] = [
  {
    id: "angle",
    name: "Angle encoding",
    sentence: "Each number tilts its own qubit, from 0 to half a turn (π).",
    formula: String.raw`|x\rangle = \bigotimes_i R_Y(x_i)\,|0\rangle`,
  },
  {
    id: "zz",
    name: "ZZ feature map",
    sentence: "Each number turns a qubit, and every pair of qubits is linked by both their numbers (Qiskit's ZZFeatureMap, repeated twice).",
    formula: String.raw`U(x) = \Big(e^{\,i\sum_i x_i Z_i + i\sum_{i<j}(\pi-x_i)(\pi-x_j)Z_iZ_j}\,H^{\otimes n}\Big)^2`,
  },
  {
    id: "iqp",
    name: "IQP encoding",
    sentence: "Like the ZZ feature map, but only neighbouring qubits are linked.",
    formula: String.raw`U(x) = \Big(e^{\,i\sum_i x_i Z_i + i\sum_{i}(\pi-x_i)(\pi-x_{i+1})Z_iZ_{i+1}}\,H^{\otimes n}\Big)^2`,
  },
  {
    id: "amplitude",
    name: "Amplitude encoding",
    sentence: "All the numbers are packed into the state itself, so 4 numbers need only 2 qubits.",
    formula: String.raw`|x\rangle = \frac{1}{\lVert x\rVert}\sum_i x_i\,|i\rangle`,
  },
  {
    id: "hamiltonian",
    name: "Hamiltonian encoding",
    sentence: "The numbers set the rules of a tiny physical system, which then runs for one second.",
    formula: String.raw`|x\rangle = e^{-iH(x)}|+\rangle^{\otimes n},\quad H(x) = \sum_i x_i Z_i + \sum_i x_i x_{i+1} X_i X_{i+1}`,
  },
  {
    id: "basis",
    name: "Basis encoding",
    sentence: "Each number becomes 0 or 1: is it above its column's middle value?",
    formula: String.raw`x \rightarrow |b_1 b_2 \dots b_n\rangle,\quad b_i = 1 \text{ if } x_i > \text{median}_i`,
  },
];

export const KERNEL_CHOICES: Choice<KernelId>[] = [
  {
    id: "fidelity",
    name: "Fidelity kernel",
    sentence: "How alike two rows are = the overlap of their quantum states, computed exactly. 1 = identical, 0 = completely different.",
    formula: String.raw`k(x, x') = |\langle x | x' \rangle|^2`,
  },
  {
    id: "fidelity_shots",
    name: "Fidelity kernel, 1024 shots",
    sentence: "The same overlap, but estimated from 1024 measurements, the way a real quantum computer would. The numbers are slightly noisy.",
    formula: String.raw`k(x, x') \approx \frac{\#\,|0\dots0\rangle}{1024}`,
  },
  {
    id: "projected",
    name: "Projected quantum kernel",
    sentence: "Compares the two rows qubit by qubit instead of the whole state at once. This helps when there are many qubits.",
    formula: String.raw`k(x, x') = e^{-\gamma \sum_q \lVert \vec r_q(x) - \vec r_q(x') \rVert^2}`,
  },
];

export const ALGORITHM_CHOICES: Choice<AlgorithmId>[] = [
  {
    id: "qsvm",
    name: "Quantum SVM",
    sentence: "Finds the boundary that best separates the labels, looking only at the kernel table.",
    formula: String.raw`\text{label}(x) = \operatorname{sign}\Big(\sum_i \alpha_i y_i\, k(x_i, x) + b\Big)`,
  },
  {
    id: "qknn",
    name: "Quantum k-nearest neighbours",
    sentence: "Gives each new row the label that most of its 3 most alike training rows have.",
    formula: String.raw`\text{label}(x) = \text{most common label among the 3 rows with largest } k(x_i, x)`,
  },
  {
    id: "qclustering",
    name: "Quantum clustering",
    sentence: "Puts alike rows into groups using the kernel, without looking at the labels at all.",
    formula: String.raw`\text{groups} = \text{spectral clustering of the kernel table}`,
  },
  {
    id: "qnn",
    name: "Quantum neural network (QNN)",
    sentence: "A trainable circuit: after the encoding, layers of turns and links are adjusted until the answers match the labels. It uses no kernel.",
    formula: String.raw`f(x) = \langle x |\, U(\theta)^\dagger Z_0\, U(\theta)\, | x \rangle,\quad \text{label} = 1 \text{ if } f(x) < 0`,
  },
];

export const pick = <T extends string>(list: Choice<T>[], id: T) => list.find((c) => c.id === id)!;

// ---------- Show code: one runnable Python script for the chosen pipeline ----------

const ENCODE_CODE: Record<EncodingId, string> = {
  angle: `TOP = np.pi
def encode(x):                                  # x = one row, scaled to 0..TOP
    qc = QuantumCircuit(len(x))
    for q, a in enumerate(x):
        qc.ry(a, q)
    return qc`,
  zz: `TOP = np.pi / 4                                 # a quarter turn works best with 4+ numbers
def encode(x):
    n = len(x); qc = QuantumCircuit(n)
    for repeat in range(2):
        qc.h(range(n))
        for q in range(n):
            qc.p(2 * x[q], q)
        for a in range(n):
            for b in range(a + 1, n):              # every pair of qubits
                qc.cx(a, b); qc.p(2 * (np.pi - x[a]) * (np.pi - x[b]), b); qc.cx(a, b)
    return qc
# (Qiskit's ready-made version: from qiskit.circuit.library import ZZFeatureMap)`,
  iqp: `TOP = np.pi / 4
def encode(x):
    n = len(x); qc = QuantumCircuit(n)
    for repeat in range(2):
        qc.h(range(n))
        for q in range(n):
            qc.rz(-2 * x[q], q)
        for q in range(n - 1):                      # neighbours only
            qc.rzz(-2 * (np.pi - x[q]) * (np.pi - x[q + 1]), q, q + 1)
    return qc`,
  amplitude: `TOP = 1.0
from qiskit.circuit.library import StatePreparation
def encode(x):
    v = 0.1 + 0.9 * np.asarray(x)                   # keep every number above zero
    n = max(1, int(np.ceil(np.log2(len(v)))))
    v = np.pad(v, (0, 2**n - len(v))); v = v / np.linalg.norm(v)
    qc = QuantumCircuit(n)
    qc.append(StatePreparation(v), range(n))
    return qc`,
  hamiltonian: `TOP = 1.0
def encode(x):
    n = len(x); qc = QuantumCircuit(n); dt = 0.5
    qc.h(range(n))                                  # start in |+> on every qubit
    for step in range(2):                           # two Trotter steps of t = 1
        for q in range(n):
            qc.rz(2 * x[q] * dt, q)
        for q in range(n - 1):
            qc.rxx(2 * x[q] * x[q + 1] * dt, q, q + 1)
    return qc`,
  basis: `MEDIAN = np.median(X_train, axis=0)
def encode(row):                                # basis uses the raw row, not the scaled one
    qc = QuantumCircuit(len(row))
    for q, v in enumerate(row):
        if v > MEDIAN[q]:
            qc.x(q)
    return qc`,
};

const KERNEL_CODE: Record<KernelId, string> = {
  fidelity: `def kernel(A, B):
    return np.abs(A.conj() @ B.T) ** 2              # |<x|x'>|^2`,
  fidelity_shots: `def kernel(A, B, shots=1024):
    exact = np.abs(A.conj() @ B.T) ** 2
    return np.random.default_rng(42).binomial(shots, np.clip(exact, 0, 1)) / shots   # like counting on hardware`,
  projected: `def bloch(S):                                    # each qubit's arrow (x, y, z)
    n = int(np.log2(S.shape[1])); out = np.zeros((len(S), n, 3))
    for r, psi in enumerate(S):
        t = psi.reshape([2] * n)
        for q in range(n):
            m = np.moveaxis(t, n - 1 - q, 0).reshape(2, -1); rho = m @ m.conj().T
            out[r, q] = [2 * rho[0, 1].real, -2 * rho[0, 1].imag, (rho[0, 0] - rho[1, 1]).real]
    return out
def kernel(A, B):
    a, b = bloch(A), bloch(B)
    d2 = ((a[:, None] - b[None]) ** 2).sum(axis=(2, 3))
    gamma = 1 / np.median(((a[:, None] - a[None]) ** 2).sum(axis=(2, 3)))
    return np.exp(-gamma * d2)`,
};

const ALGORITHM_CODE: Record<AlgorithmId, string> = {
  qsvm: `from sklearn.svm import SVC
model = SVC(kernel="precomputed").fit(kernel(S_train, S_train), y_train)
guess = model.predict(kernel(S_test, S_train))
print("Quantum SVM:", (guess == y_test).sum(), "of", len(y_test), "correct")`,
  qknn: `from sklearn.neighbors import KNeighborsClassifier
distance = lambda A, B: np.clip(1 - kernel(A, B), 0, None)   # distance = 1 - similarity
model = KNeighborsClassifier(3, metric="precomputed").fit(distance(S_train, S_train), y_train)
guess = model.predict(distance(S_test, S_train))
print("Quantum kNN:", (guess == y_test).sum(), "of", len(y_test), "correct")`,
  qclustering: `from sklearn.cluster import SpectralClustering
S_all = states(X)                                     # clustering uses every row, no labels
groups = SpectralClustering(len(set(labels)), affinity="precomputed", random_state=42).fit_predict(kernel(S_all, S_all))
print("Groups found:", groups.tolist())`,
  qnn: `from qiskit.circuit.library import RealAmplitudes   # RY turns + CX links, the same layers
from qiskit.quantum_info import SparsePauliOp
from scipy.optimize import minimize
n = int(np.log2(S_train.shape[1]))
ansatz = RealAmplitudes(n, entanglement="linear", reps=2)
Z0 = SparsePauliOp.from_sparse_list([("Z", [0], 1)], n)
def answers(theta, S):
    U = ansatz.assign_parameters(theta)
    return np.array([Statevector(s).evolve(U).expectation_value(Z0).real for s in S])
how_wrong = lambda t: np.mean((answers(t, S_train) - (1 - 2 * y_train)) ** 2)
start = np.random.default_rng(42).uniform(0, 2 * np.pi, ansatz.num_parameters)
theta = minimize(how_wrong, start, method="COBYLA", options={"maxiter": 120}).x
guess = (answers(theta, S_test) < 0).astype(int)
print("QNN:", (guess == y_test).sum(), "of", len(y_test), "correct")`,
};

export function pipelineCode(
  csvName: string,
  encoding: EncodingId,
  kernel: KernelId,
  algorithm: AlgorithmId,
): string {
  const usesKernel = algorithm !== "qnn";
  return `# QML pipeline: ${csvName} -> ${pick(ENCODING_CHOICES, encoding).name} -> ${
    usesKernel ? pick(KERNEL_CHOICES, kernel).name + " -> " : ""
  }${pick(ALGORITHM_CHOICES, algorithm).name}
# pip install qiskit==1.4.6 scikit-learn==1.9.1 pandas
import numpy as np, pandas as pd
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from sklearn.model_selection import train_test_split

# 1. Data: number columns + one label column
data = pd.read_csv("${csvName}")
labels = data.pop("label").astype(str)
classes = sorted(labels.unique())
X = data.to_numpy(float)
y = np.array([classes.index(c) for c in labels])
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

# 2. Encoding
${ENCODE_CODE[encoding]}

lo, hi = X_train.min(axis=0), X_train.max(axis=0)
def scale(row):                                   # each column onto 0..TOP
    return (np.clip(row, lo, hi) - lo) / np.where(hi > lo, hi - lo, 1) * ${encoding === "basis" ? "1" : "TOP"}

def states(rows):
    return np.array([Statevector.from_instruction(encode(${encoding === "basis" ? "r" : "scale(r)"})).data for r in rows])

S_train, S_test = states(X_train), states(X_test)
${usesKernel ? `\n# 3. Kernel\n${KERNEL_CODE[kernel]}\n` : "\n# 3. No kernel: the QNN learns its own dials\n"}
# 4. Algorithm and result
${ALGORITHM_CODE[algorithm]}
`;
}
