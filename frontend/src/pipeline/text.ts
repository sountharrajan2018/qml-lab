// Every sentence, formula and code snippet the Pipeline screen shows.
import type { Algorithm } from "./types";

export interface Code {
  qiskit?: string;
  pennylane?: string;
  python?: string;
}

export interface StepText {
  title: string;
  sentence: string;
  /** Extra line under the picture: what to look at. */
  look: string;
  formula?: string;
  /** "Show details": a few short paragraphs; $$...$$ lines are drawn as formulas. */
  details: string[];
  code: Code;
}

export const STEP_NAMES = ["Your data", "Prepare", "Encode", "Compare pairs", "Learn", "Result"];

export const ALGORITHMS: { id: Algorithm; tab: string; headline: string }[] = [
  { id: "qsvm", tab: "Quantum SVM", headline: "Teach the computer to tell two groups apart." },
  { id: "clustering", tab: "Quantum clustering", headline: "Let the computer find groups on its own." },
  { id: "qcnn", tab: "Quantum CNN", headline: "A circuit that learns to recognise pictures." },
];

// ---------- shared steps for the two kernel algorithms ----------

const PREPARE_CODE = `import numpy as np

lo, hi = X.min(axis=0), X.max(axis=0)          # each column's smallest and largest value

def prepare(x):
    return (np.clip(x, lo, hi) - lo) / (hi - lo) * np.pi / 2   # a dial from 0 to pi/2`;

const PREPARE: StepText = {
  title: "Prepare",
  sentence: "We stretch every number onto a dial between 0 and π/2.",
  look: "The ringed dot is the one we follow through the next two steps.",
  formula: String.raw`\tilde{x}_i = \frac{x_i - \min_i}{\max_i - \min_i}\cdot\frac{\pi}{2}`,
  details: [
    "Quantum gates turn qubits by an angle, so every number has to become an angle first.",
    "The smallest value in a column becomes 0 and the largest becomes π/2. Only the dots we learn from set this range; dots we test on later are squeezed into it.",
    "Why π/2 and not π? With bigger angles every dot ends up looking different from every other dot, and the SVM drops from 18 to 16 correct out of 20. How you encode decides how well you learn.",
  ],
  code: { python: PREPARE_CODE },
};

const ENCODE_QISKIT = `from qiskit import QuantumCircuit
import numpy as np

def encode(x):                       # x = the prepared numbers of one dot
    qc = QuantumCircuit(2)
    for repeat in range(2):
        qc.h([0, 1])                                   # spread both qubits out
        qc.rz(-2 * x[0], 0)                            # turn by number 1
        qc.rz(-2 * x[1], 1)                            # turn by number 2
        qc.rzz(-2 * (np.pi - x[0]) * (np.pi - x[1]), 0, 1)   # the two qubits talk
    return qc`;

const ENCODE_PENNYLANE = `import pennylane as qml
import numpy as np

def encode(x):
    for repeat in range(2):
        qml.Hadamard(0); qml.Hadamard(1)
        qml.RZ(-2 * x[0], wires=0)
        qml.RZ(-2 * x[1], wires=1)
        qml.IsingZZ(-2 * (np.pi - x[0]) * (np.pi - x[1]), wires=[0, 1])`;

const ENCODE: StepText = {
  title: "Encode",
  sentence: "Each dot becomes a quantum state.",
  look: "This is the circuit for the ringed dot. Every dot gets its own circuit like this, with its own angles.",
  formula: String.raw`U(x) = \big(e^{\,i(\tilde x_1 Z_1 + \tilde x_2 Z_2) + i(\pi-\tilde x_1)(\pi-\tilde x_2) Z_1 Z_2}\; H^{\otimes 2}\big)^2`,
  details: [
    "This is IQP encoding, the same as the IQP tab in the Encoding Lab: each number turns its own qubit (RZ), and the ZZ gate lets the two qubits talk, so the state depends on both numbers together.",
    "The block runs twice. One qubit per number, so 2 numbers need 2 qubits.",
  ],
  code: { qiskit: ENCODE_QISKIT, pennylane: ENCODE_PENNYLANE },
};

const KERNEL_QISKIT = `from qiskit.quantum_info import Statevector
import numpy as np

states = np.array([Statevector.from_instruction(encode(prepare(x))).data for x in X])
K = np.abs(states.conj() @ states.T) ** 2       # K[i, j] = how alike dot i and dot j are`;

const KERNEL_PENNYLANE = `import pennylane as qml

dev = qml.device("default.qubit", wires=2)

@qml.qnode(dev)
def overlap(a, b):
    encode(a)
    qml.adjoint(encode)(b)          # undo b: if a and b are alike we get back to |00>
    return qml.probs(wires=[0, 1])

def k(a, b):
    return overlap(a, b)[0]         # chance of |00> = |<a|b>|^2`;

const KERNEL_DETAILS = [
  "The kernel is a table of similarities. Row i, column j says how alike the quantum states of dot i and dot j are: 1 means identical, 0 means completely different.",
  "$$k(x, x') = |\\langle x | x' \\rangle|^2$$",
  "On a real quantum computer you estimate it by running encode(x) followed by encode(x') backwards and counting how often you get back to |00⟩. Here we compute it exactly.",
  "The algorithm in the next step never looks at the dots themselves, only at this table.",
];

// ---------- per algorithm ----------

export const STEPS: Record<Algorithm, StepText[]> = {
  qsvm: [
    {
      title: "Your data",
      sentence: "Here are the dots we want the computer to sort into two groups.",
      look: "40 dots to learn from. The two moons hook into each other, so no straight line can split them.",
      details: [
        "Each dot has 2 numbers: its position x and y. Each dot also has a label: moon A or moon B.",
        "There are 40 dots to learn from. 20 more dots are kept aside to test on at the end, so we can check the computer really learned and did not just memorise.",
        "This is the scikit-learn make_moons dataset with a little noise, seed 42. Download it from datasets/pipeline/moons_train.csv.",
      ],
      code: {
        python: `from sklearn.datasets import make_moons

X, y = make_moons(40, noise=0.1, random_state=42)            # 40 dots to learn from
X_test, y_test = make_moons(20, noise=0.1, random_state=7)   # 20 unseen dots`,
      },
    },
    PREPARE,
    ENCODE,
    {
      title: "Compare pairs",
      sentence: "The kernel measures how alike every pair of dots is, using their quantum states.",
      look: "Bright = alike, dark = different. Dots are sorted by moon, so the two bright squares are the two moons. Click any square.",
      formula: String.raw`k(x, x') = |\langle x | x' \rangle|^2`,
      details: KERNEL_DETAILS,
      code: { qiskit: KERNEL_QISKIT, pennylane: KERNEL_PENNYLANE },
    },
    {
      title: "Learn",
      sentence: "The SVM uses the kernel to find the boundary that best separates the two moons.",
      look: "The background shows which moon the SVM would pick for any point. Ringed dots are the ones that decide the boundary.",
      formula: String.raw`\text{group}(x) = \operatorname{sign}\Big(\sum_i \alpha_i\, y_i\, k(x_i, x) + b\Big)`,
      details: [
        "A support vector machine (SVM) draws the widest possible gap between the two groups. It only needs to know how alike dots are, which is exactly what the kernel gives it.",
        "Only a few dots, the support vectors (ringed), end up deciding where the boundary goes. The weights α say how much each one counts.",
        "Because the kernel was computed from quantum states, this is called a quantum SVM. The SVM itself is ordinary classical code.",
      ],
      code: {
        python: `from sklearn.svm import SVC

qsvm = SVC(kernel="precomputed").fit(K, y)     # learn from the 40 x 40 kernel table`,
      },
    },
    {
      title: "Result",
      sentence: "Here is how well it does on 20 dots it has never seen.",
      look: "✓ = put in the right moon, ✗ = wrong. The classical SVM uses an ordinary kernel on the same data.",
      formula: String.raw`\text{score} = \frac{\text{correct guesses}}{\text{unseen dots}}`,
      details: [
        "We encode each unseen dot, compare it with the 40 learning dots using the kernel, and ask the SVM which moon it belongs to.",
        "The classical SVM does as well or better here. That is normal: on small, easy data, classical methods are hard to beat. Quantum kernels are being researched for data where classical similarity measures struggle.",
      ],
      code: {
        python: `states_test = np.array([Statevector.from_instruction(encode(prepare(x))).data for x in X_test])
K_test = np.abs(states_test.conj() @ states.T) ** 2      # unseen dots vs learning dots
guess = qsvm.predict(K_test)
print((guess == y_test).sum(), "of", len(y_test), "correct")`,
      },
    },
  ],

  clustering: [
    {
      title: "Your data",
      sentence: "Here are 30 dots. This time there are no labels: the computer must find the groups on its own.",
      look: "All dots are grey because the computer is not told which cloud each one belongs to.",
      details: [
        "Each dot has 2 numbers: its position x and y.",
        "Learning without labels is called unsupervised learning. We keep the true clouds aside only to check the answer at the end.",
        "This is the scikit-learn make_blobs dataset, 3 clouds, seed 42. Download it from datasets/pipeline/blobs.csv.",
      ],
      code: {
        python: `from sklearn.datasets import make_blobs

X, true_clouds = make_blobs(30, centers=3, cluster_std=0.8, random_state=42)
# true_clouds is never shown to the algorithm`,
      },
    },
    PREPARE,
    ENCODE,
    {
      title: "Compare pairs",
      sentence: "The kernel measures how alike every pair of dots is, using their quantum states.",
      look: "Bright = alike, dark = different. The dots are in the file's order, so no pattern is visible yet. Click any square.",
      formula: String.raw`k(x, x') = |\langle x | x' \rangle|^2`,
      details: KERNEL_DETAILS,
      code: { qiskit: KERNEL_QISKIT, pennylane: KERNEL_PENNYLANE },
    },
    {
      title: "Learn",
      sentence: "Dots that the kernel says are alike are put into the same group.",
      look: "The same table, re-sorted by the groups found: three bright squares appear. Right: the dots coloured by group.",
      details: [
        "Spectral clustering treats the kernel as a map of who is close to whom, then cuts it into the requested number of groups (3) so that alike dots stay together.",
        "The group numbers it gives are arbitrary, so for the colours we rename them to line up with the true clouds.",
      ],
      code: {
        python: `from sklearn.cluster import SpectralClustering

groups = SpectralClustering(3, affinity="precomputed", random_state=42).fit_predict(K)`,
      },
    },
    {
      title: "Result",
      sentence: "Here is how many dots ended up in their true cloud.",
      look: "✓ = in the right cloud. Classical k-means groups the same dots by plain distance.",
      formula: String.raw`\text{score} = \frac{\text{dots in their true cloud}}{30}`,
      details: [
        "Both methods find the three clouds perfectly: the clouds are well separated, so this is an easy task.",
        "The point is the pipeline: exactly the same kernel that powered the SVM also powers clustering. Only the last step changed.",
      ],
      code: {
        python: `from sklearn.cluster import KMeans

classical = KMeans(3, n_init=10, random_state=42).fit_predict(X)`,
      },
    },
  ],

  qcnn: [
    {
      title: "Your data",
      sentence: "Here are 33 pictures to learn from: is the line lying down or standing up?",
      look: "Each picture is 4 × 4 pixels with one straight line, 2 to 4 pixels long. 15 more pictures are kept aside to test on.",
      details: [
        "Each picture is 16 numbers: 1 for a white pixel, 0 for black. Its label is lying down or standing up.",
        "There are 48 pictures: every row and column, with lines of length 4, 3 and 2 at different positions. They are shuffled with seed 42: 33 to learn from, 15 to test.",
        "Download them from datasets/pipeline/lines_train.csv and lines_test.csv.",
      ],
      code: {
        python: `import numpy as np

pictures, labels = [], []
for orientation in (0, 1):                      # 0 = lying down, 1 = standing up
    for r in range(4):
        for length, start in [(4, 0), (3, 0), (3, 1), (2, 0), (2, 1), (2, 2)]:
            a = np.zeros((4, 4))
            if orientation == 0: a[r, start:start + length] = 1
            else:                a[start:start + length, r] = 1
            pictures.append(a.flatten()); labels.append(orientation)`,
      },
    },
    {
      title: "Prepare",
      sentence: "We divide the 16 pixels by their total length, so they fit into the qubits.",
      look: "The picture we follow, and its 16 numbers after dividing. Their squares add up to 1.",
      formula: String.raw`|x\rangle = \frac{1}{\lVert x \rVert}\sum_{i=0}^{15} x_i\,|i\rangle`,
      details: [
        "This is amplitude encoding, the same as the Amplitude tab in the Encoding Lab.",
        "A quantum state's numbers must have squares that add up to 1, so we divide by the total length.",
      ],
      code: {
        python: `amplitudes = picture / np.linalg.norm(picture)     # squares now add up to 1`,
      },
    },
    {
      title: "Encode",
      sentence: "16 pixels fit into only 4 qubits.",
      look: "One box loads the whole picture. Unpacked into basic gates it is much longer: see the count.",
      formula: String.raw`16 \text{ pixels} = 2^4 \;\Rightarrow\; 4 \text{ qubits}`,
      details: [
        "Pixel i becomes the weight of result |i⟩: pixel 1 is |0000⟩, pixel 2 is |0001⟩, …, pixel 16 is |1111⟩.",
        "A lying line and a standing line load into the qubits in clearly different ways: a lying line spreads over the last two qubits, a standing line over the first two. That is what the circuit will learn to notice.",
      ],
      code: {
        qiskit: `from qiskit import QuantumCircuit
from qiskit.circuit.library import StatePreparation

qc = QuantumCircuit(4)
qc.append(StatePreparation(amplitudes), range(4))`,
        pennylane: `import pennylane as qml

qml.AmplitudeEmbedding(picture, wires=range(4), normalize=True)`,
      },
    },
    {
      title: "No kernel here",
      sentence: "A QCNN does not compare pairs. It is a circuit with 22 dials that it learns to turn.",
      look: "Conv boxes let two neighbouring qubits look at each other. Pool boxes squeeze two qubits into one: 4 → 2 → 1. The last qubit gives the answer.",
      formula: String.raw`f(x) = \langle x |\, U(\theta)^\dagger\, Z\, U(\theta)\, | x \rangle \qquad (\theta = 22 \text{ dials})`,
      details: [
        "A classical CNN (convolutional neural network) slides small filters over an image, then shrinks it (pooling). A quantum CNN copies that idea with small two-qubit blocks.",
        "Each Conv block has 4 dials (RY turns and a CNOT); each Pool block has 2 dials (controlled turns) and passes what it learned onto one qubit.",
        "At the end we read qubit q2: Z near +1 means lying down, near −1 means standing up.",
      ],
      code: {
        qiskit: `def conv(qc, p, a, b):
    qc.ry(p[0], a); qc.ry(p[1], b); qc.cx(a, b); qc.ry(p[2], a); qc.ry(p[3], b)

def pool(qc, p, src, dst):
    qc.crz(p[0], src, dst); qc.crx(p[1], src, dst)

def qcnn(p):
    qc = QuantumCircuit(4)
    conv(qc, p[0:4], 0, 1); conv(qc, p[4:8], 2, 3); conv(qc, p[8:12], 1, 2)
    pool(qc, p[12:14], 0, 1); pool(qc, p[14:16], 3, 2)        # 4 qubits -> 2
    conv(qc, p[16:20], 1, 2); pool(qc, p[20:22], 1, 2)        # 2 qubits -> 1 (q2)
    return qc`,
        pennylane: `def conv(p, a, b):
    qml.RY(p[0], a); qml.RY(p[1], b); qml.CNOT([a, b]); qml.RY(p[2], a); qml.RY(p[3], b)

def pool(p, src, dst):
    qml.CRZ(p[0], [src, dst]); qml.CRX(p[1], [src, dst])

@qml.qnode(qml.device("default.qubit", wires=4))
def qcnn(picture, p):
    qml.AmplitudeEmbedding(picture, wires=range(4), normalize=True)
    conv(p[0:4], 0, 1); conv(p[4:8], 2, 3); conv(p[8:12], 1, 2)
    pool(p[12:14], 0, 1); pool(p[14:16], 3, 2)
    conv(p[16:20], 1, 2); pool(p[20:22], 1, 2)
    return qml.expval(qml.PauliZ(2))`,
      },
    },
    {
      title: "Learn",
      sentence: "The circuit turns its dials, step by step, until its guesses improve.",
      look: "Lower is better. Press Replay to watch it learn. This run was done ahead of time; it takes about 25 seconds.",
      formula: String.raw`\text{how wrong} = \frac{1}{33}\sum_{j=1}^{33}\big(f(x_j) - t_j\big)^2, \quad t = \begin{cases}+1 & \text{lying}\\ -1 & \text{standing}\end{cases}`,
      details: [
        "We start with random dials. At each step the optimiser (COBYLA) tries small changes and keeps the ones that make the answers closer to the targets.",
        "300 steps, 22 dials. This is the same idea as training a classical neural network, but each guess is made by a quantum circuit.",
      ],
      code: {
        python: `from scipy.optimize import minimize

def how_wrong(p):
    return np.mean([(answer(x, p) - t) ** 2 for x, t in zip(pictures, targets)])

start = np.random.default_rng(42).uniform(0, 2 * np.pi, 22)
trained = minimize(how_wrong, start, method="COBYLA", options={"maxiter": 300})`,
      },
    },
    {
      title: "Result",
      sentence: "Here are its guesses on 15 pictures it has never seen.",
      look: "Under each picture: the guess and how sure it is. A small classical neural network is shown for comparison.",
      formula: String.raw`\text{chance of standing} = \frac{1 - f(x)}{2}`,
      details: [
        "Here the quantum CNN does a little better than a small classical neural network. With only 15 test pictures that is a small difference, not proof of a quantum advantage.",
        "Notice how few dials it needed: 22. That is one reason QCNNs are studied.",
      ],
      code: {
        python: `guess = ["standing" if answer(x, trained.x) < 0 else "lying" for x in test_pictures]`,
      },
    },
  ],
};
