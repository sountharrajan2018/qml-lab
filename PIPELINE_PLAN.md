# QML Pipeline: Build Plan (add-on to the Encoding Lab)

Oct 9, 2026 · draft for review · lecture in 2 days

## Overview

A new **Pipeline** tab in the same app. It walks beginners through one full quantum machine
learning run, left to right, one step per click:

```
1 Your data → 2 Prepare → 3 Encode → 4 Compare pairs (kernel) → 5 Learn → 6 Result
```

Three algorithms, picked at the top. Each one uses the dataset it works best on, so every
picture on screen is easy to read:

| Algorithm | Dataset | What students see at the end |
| --- | --- | --- |
| **Quantum SVM** | Two half-moons (40 dots for learning, 20 held back for testing, 2 numbers each) | The dots on a 2D plot, the dividing line the QSVM drew, and its score on the 20 unseen dots |
| **Quantum clustering** | Three blobs (30 dots, 2 numbers each), labels hidden | The dots coloured by the group the computer found, with no answers given |
| **Quantum CNN** | 48 4x4 line pictures (lines of length 2 to 4): lying down or standing up | The training curve going down, then its guesses on unseen pictures |

QSVM and clustering share steps 1 to 6. The QCNN has **no kernel**: step 4 says
"No pair comparison here: this circuit learns by turning its own dials" and shows the trainable circuit instead.

## The six steps

Same look as the encoding screens: one plain sentence on top, one picture, a formula,
**Show details** (the maths) and **Show code** (Qiskit + PennyLane text).
Explain mode (E) walks the steps; arrows move between them.

| Step | Sentence on screen | Picture |
| --- | --- | --- |
| 1 Your data | "Here are the dots we want the computer to sort." | Scatter plot (pictures for QCNN) |
| 2 Prepare | "We stretch every number onto a dial between 0 and π/2." | Before/after numbers for one dot |
| 3 Encode | "Each dot becomes a quantum state." | The encoding circuit for the highlighted dot (reuses the Encoding Lab) |
| 4 Compare pairs | "The kernel measures how alike two quantum states are." | Coloured grid: bright = alike. Click a square to see the two dots |
| 5 Learn | QSVM: "The SVM finds the line that best separates the two groups." Clustering: "Similar dots are grouped together." QCNN: "The circuit adjusts its dials until its guesses improve." | Boundary, groups, or the training curve |
| 6 Result | "Here is how well it did on dots it has never seen." | Score + quantum vs classical side by side |

**Quantum vs classical, side by side** in step 6: normal SVM, k-means, and a small classical
neural network. On small data the classical methods usually match or beat the quantum ones,
and the screen says so plainly.

## Fixed settings (checked here before planning)

| | Setting | Result measured in this sandbox |
| --- | --- | --- |
| QSVM | IQP encoding on 2 qubits, numbers scaled to 0..π/2 using the training dots only, kernel = overlap² of states, scikit-learn SVM on the kernel | 18 of 20 unseen dots (90%; classical SVM: 20 of 20). At 0..π: 16 of 20 |
| Clustering | Same IQP kernel, spectral clustering into 3 groups | Perfect grouping (same as k-means) |
| QCNN | Amplitude-encode 16 pixels into 4 qubits, conv + pool layers (4 → 2 → 1 qubits), 22 dials, trained with COBYLA (48 line pictures, 33 for learning) | 14 of 15 unseen pictures (classical neural network: 12 of 15), about 25 s of training |

Lines vs crosses was tried first and failed (53%, a coin toss): amplitude encoding divides by
the total length, which erases the pixel count that tells a cross from a line. Horizontal vs
vertical works because a lying line and a standing line load into the qubits in clearly different ways.

Note: the full 0..π range used in the Encoding Lab makes a poor kernel (75% for QSVM), so the
pipeline uses 0..π/2. This is a good teaching point: "how you encode decides how well you learn".

**QCNN is trained ahead of time** (about 25 s per run) and saved to a file; in class the
training curve replays as an animation. QSVM and clustering are computed live.

## Build

- Backend: `backend/app/pipeline/` with `datasets.py`, `kernel.py`, `qsvm.py`, `clustering.py`,
  `qcnn.py`; one new endpoint `POST /api/pipeline` (`algorithm`, `step`); scikit-learn added and pinned.
- Frontend: `Pipeline.tsx` plus one file per step; Recharts for plots and the kernel grid.
- Notebook: `notebooks/qml_pipeline.ipynb`, the same three runs with the same numbers, runnable
  in Google Colab with one install cell. Executed here before shipping.
- Tests: accuracy floors, kernel symmetric with 1s on the diagonal, notebook runs end to end.

**Out of scope:** real hardware, noise, logins, mobile layout, students changing settings
(only the professor picks the algorithm).

## Order (2 days)

1. Backend pipeline + tests (day 1 morning)
2. Notebook (day 1 afternoon)
3. Pipeline screen (day 2 morning)
4. Full click-through, screenshots, push (day 2 afternoon), then redeploy Render and Vercel
