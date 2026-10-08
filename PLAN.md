# QML Encoding Lab: Build Plan

Oct 7, 2026 · @Sarvan Kumar

## Overview

QML Encoding Lab is a one-screen FastAPI + React demo that answers a single question: "how do my numbers become qubits?" It shows five encodings (basis, angle, amplitude, IQP, Hamiltonian) for a guest lecture, projected on a desktop, with no login.

**How to use this plan.** Everything happens in the browser; nothing is installed on the professor's laptop. Create an empty GitHub repo, upload this file as `PLAN.md`, open Claude Code on the web (claude.ai/code), select the repo, and ask it to build phase by phase. Claude works in Anthropic's cloud sandbox, runs the tests there, and pushes to GitHub. Render and Vercel then deploy straight from the GitHub repo through their websites.

### Simplicity rules (Claude Code must follow these)

1. One encoding on screen at a time, picked from five tabs.
2. Exactly three panels, read left to right: **Your numbers → The circuit → The qubits**.
3. Every panel has one plain-English sentence on top. No jargon in labels: "chance of seeing this result", not "probability amplitude".
4. The only control a student sees is "pick a data row". Every encoding parameter is fixed in code.
5. Default demos use 2 to 4 qubits, so every bar and gate is readable from the back row. The 7-qubit cap exists only for uploaded data.
6. An **Explain** button walks through the three panels one at a time, so the professor can talk while clicking.

### Suggested lecture flow (about 20 minutes)

1. Pick one row of `toy_2d.csv`, two numbers on screen.
2. Basis: "we can only store yes or no."
3. Angle: "each number tilts one qubit."
4. Amplitude: "16 pixels fit in only 4 qubits," using `pixels_16d.csv`.
5. IQP: "qubits now talk to each other."
6. Hamiltonian: "the data controls how the system evolves."
7. Open Compare to see all five side by side for the same row.

**Out of scope:** training models, kernels, real hardware, noise, logins, and mobile layouts. The app is standalone and can be mounted inside Qrious later.

## Key decisions

The frontend deploys to Vercel; the FastAPI backend does not. It runs as a plain Python web service on Render (free tier), connected straight to the GitHub repo, and the frontend calls it through one environment variable. No Docker is used anywhere.

The backend stays off Vercel because Qiskit and its simulator are too heavy for Vercel's Python functions, and a cold start would stall the first click in class.

| Decision | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite + Tailwind, on Vercel |
| Backend | FastAPI on Render as a plain Python service (no Docker) |
| Simulation | Qiskit `Statevector`, exact results only (no shots, no noise) |
| PennyLane | Shown as code only, in a "Show code" drawer next to the Qiskit code |
| Qubits | 2 to 4 in bundled demos; hard cap of 7 |
| Login | None |
| Look | Dark `bg-black`, large type, desktop only |

**Why PennyLane is code-only.** Running two engines doubles what can break and adds a toggle that changes nothing on screen, because both produce the same state. Showing the PennyLane code next to the Qiskit code teaches the same lesson with zero extra moving parts.

## The five encodings

Each encoding tab shows one headline sentence, one picture-it analogy, and one formula. All settings are fixed in code, so nothing on screen needs explaining except the data.

| Encoding | Headline sentence on screen | Qubits for n numbers | The qubits panel shows |
| --- | --- | --- | --- |
| Basis | "Each number becomes a 0 or a 1." | n | Bars + Bloch spheres |
| Angle | "Each number tilts one qubit." | n | Bars + Bloch spheres |
| Amplitude | "All numbers share the qubits together." | log2 of n, rounded up | Bars only |
| IQP | "Qubits tilt, then talk to each other." | n | Bars only |
| Hamiltonian | "The numbers control how the qubits evolve." | n | Bars only |

Bloch spheres appear only for basis and angle, the two encodings where each qubit can be drawn on its own. For the other three, qubits are linked, so a per-qubit sphere would mislead students.

### Basis

**Picture it as:** a row of light switches. Each number is compared with its column's middle value: above is 1, otherwise 0. Fixed rule: median threshold, built with X gates.

```latex
(x_1, x_2) \rightarrow |b_1 b_2\rangle, \quad b_i = 1 \text{ if } x_i > \text{median}
```

On screen: exactly one bar at 100 percent. Explain-mode line: "Simple, but we threw away the detail in each number."

### Angle

**Picture it as:** each number turns a dial. Numbers are scaled to 0 to π, and each one rotates its own qubit with an RY gate.

```latex
R_Y(x)|0\rangle = \cos\tfrac{x}{2}\,|0\rangle + \sin\tfrac{x}{2}\,|1\rangle
```

On screen: each Bloch arrow tilts by its number. Explain-mode line: "Bigger number, bigger tilt, one qubit per number."

### Amplitude

**Picture it as:** packing numbers into a suitcase. The numbers are divided by their total length so they fit, then stored as the state itself. 16 numbers need only 4 qubits.

```latex
|x\rangle = \frac{1}{\lVert x \rVert} \sum_i x_i \, |i\rangle
```

On screen: the bars match the shape of the input numbers, and for `pixels_16d.csv` the input shows as a 4x4 image. Explain-mode line: "Very few qubits, but the circuit to load them is long." The circuit panel shows its gate count to prove it.

### IQP

**Picture it as:** angle encoding, plus neighbours whispering to each other. Fixed settings: Hadamards, then data-driven Z and ZZ phases between neighbouring qubits, repeated twice.

```latex
U(x) = \big( e^{\,i\sum_i x_i Z_i \,+\, i\sum_{i} (\pi - x_i)(\pi - x_{i+1}) Z_i Z_{i+1}}\; H^{\otimes n} \big)^2
```

On screen: a bar pattern no single-qubit encoding can make. Explain-mode line: "The qubits are now entangled, which is where quantum advantage is hoped to come from."

### Hamiltonian

**Picture it as:** the numbers set the rules of a tiny physical system, then we let it run for one second. Fixed settings: start in |+⟩ on every qubit, time t = 1, two Trotter steps.

```latex
H(x) = \sum_i x_i Z_i + \sum_i x_i x_{i+1} X_i X_{i+1}, \qquad |x\rangle = e^{-iH(x)}|+\rangle^{\otimes n}
```

On screen: bars that shift smoothly as the row changes. Explain-mode line: "This is how physicists naturally put data into a quantum system."

## Datasets and CSV upload

Claude Code writes three tiny CSVs by hand-picked values or a seeded script (seed 42), and ships them in `frontend/public/datasets/`. They are small on purpose: a student should be able to read every number on screen.

| File | Rows | Numbers per row | Used for |
| --- | --- | --- | --- |
| `toy_2d.csv` | 8 | 2 (round values like 0.2, 0.8) | The opening demo; every encoding on 1 to 2 qubits |
| `iris_4d.csv` | 9 | 4 (3 per flower species) | Angle, IQP, Hamiltonian on 4 qubits |
| `pixels_16d.csv` | 6 | 16, a 4x4 black-and-white picture (lines and crosses) | Amplitude encoding into 4 qubits |

When a dataset has more numbers than an encoding can take, that tab shows a single sentence instead of an error: "16 numbers would need 16 qubits here. Try Amplitude."

**Upload (professor only, no login):** a small "Upload CSV" button in the header. Rules: header row, numbers only, optional `label` column, at most 50 rows and 16 columns. A file that breaks a rule shows one sentence naming the rule. Parsing happens in the browser and the file is never stored.

## Frontend

The whole app is one screen plus one Compare view. Libraries: Recharts for bars, KaTeX for formulas, PapaParse for CSV. No state library; React state is enough.

### The main screen

- **Top bar:** five encoding tabs, a dataset dropdown, "Compare", and "Upload CSV".
- **Row picker:** a row of numbered chips (Row 1, Row 2, ...) under the tabs. Clicking one updates everything.
- **Three panels, left to right:**
  1. **Your numbers.** The row's raw values, then the scaled values with an arrow between them. Pixels data renders as a 4x4 image.
  2. **The circuit.** The circuit drawing from Qiskit, with one caption: "3 gates, 2 qubits."
  3. **The qubits.** Bars titled "Chance of seeing each result", labelled |00⟩, |01⟩ and so on. Basis and angle also show one small Bloch sphere per qubit.
- **Below the panels:** the headline sentence, the formula with this row's numbers filled in, and a "Show code" drawer with Qiskit and PennyLane tabs.

### Explain button

Clicking **Explain** dims everything except panel 1 and shows its one-line caption; clicking again moves to panel 2, then panel 3, then the formula. The captions are the Explain-mode lines from the encodings section. This is the professor's main teaching tool.

### Compare view

A five-column table for the current row: encoding, qubits used, gate count, and a small bar chart of the result. It answers "which encoding costs what" in one look, and nothing else.

### Presenter mode

Press P for larger text. Arrow keys change the row, keys 1 to 5 switch the encoding, and E starts Explain. That is the full list of shortcuts.

## Backend

The backend has three endpoints and no storage. Every request carries the row and its dataset's column stats; every response is computed fresh.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `ok`, used to wake the server |
| POST | `/api/encode` | Everything the main screen shows for one encoding and one row |
| POST | `/api/compare` | Qubits, gate count and result bars for all five encodings on one row |

**`/api/encode` request:** `encoding`, `row` (list of numbers), `column_stats` (min, max, median per column). **Response:** `scaled`, `n_qubits`, `circuit_svg`, `gate_count`, `probabilities` (labelled), `bloch` (basis and angle only), `formula_latex` (with numbers filled in), `code` (Qiskit and PennyLane text), `message` (plain sentence when the encoding cannot take this row).

**Rules for Claude Code:**

- One file per encoding in `encoders/`, each with a `build(row, stats)` function returning a Qiskit circuit. Settings are constants at the top of the file.
- Use `Statevector.from_instruction` for results. Return probabilities in big-endian order (q0 is the leftmost bit) so labels read left to right.
- Draw circuits with Qiskit's Matplotlib drawer, dark style, as SVG. Amplitude shows the `StatePreparation` box, not its decomposition, but its gate count is measured after decomposing into basic gates so the real loading cost shows.
- PennyLane code is a text template per encoding with the numbers filled in. PennyLane is not installed on the server.
- Reject more than 7 qubits with a plain message, not a stack trace.

## Repo structure

Two folders, about 20 files. For Qrious later, the backend exposes one `APIRouter` and the frontend one `<EncodingLab />` component.

```
qml-encoding-lab/
  PLAN.md
  README.md                 deploy steps written for a browser-only user
  render.yaml               one-click Render setup for the backend
  start.py                  optional local run: serves API + built frontend on :8000
  backend/
    requirements.txt        fastapi, uvicorn, qiskit, matplotlib, pinned
    app/
      main.py               app + CORS + router
      encoders/             basis.py angle.py amplitude.py iqp.py hamiltonian.py
      snippets/             qiskit and pennylane code templates
    tests/test_encoders.py
  frontend/
    vercel.json
    public/datasets/        toy_2d.csv iris_4d.csv pixels_16d.csv
    src/
      EncodingLab.tsx       the whole app
      panels/               Numbers.tsx Circuit.tsx Qubits.tsx
      Compare.tsx
      explain.ts            Explain-mode captions
      api.ts
```

## Build order and checks

Four phases, each finished before the next starts.

1. **Encoders + tests.** Three CSVs, the five encoder files, and `test_encoders.py` passing.
2. **API.** `/api/health`, `/api/encode`, `/api/compare`, started and tested inside the Claude Code cloud session.
3. **Screen.** Three panels, row picker, Explain button, Compare, presenter mode.
4. **Deploy.** Backend to Render as a Python web service, frontend to Vercel with `VITE_API_BASE` set.

### Correctness checks

- [ ] Every result's probabilities add up to 1 for every row of every bundled CSV.
- [ ] Basis gives exactly one bar at 100 percent.
- [ ] Angle on `toy_2d.csv` matches the cos and sin formula by hand.
- [ ] Amplitude bars for a pixels row match the squared, normalized pixel values.
- [ ] A 2-qubit case confirms |01⟩ means q0 = 0, q1 = 1 (left to right).

### Simplicity checks (the professor ticks these)

- [ ] A student at the back can read every bar label and gate on the projector.
- [ ] No label on screen uses a word the headline sentences do not explain.
- [ ] Explain mode walks all three panels in four clicks.
- [ ] Switching row or encoding updates the screen in under a second.

## Lecture-day risks

The biggest risk is a sleeping or slow backend in front of the class, so the plan includes a full local backup that runs with one command.

| Risk | Fallback |
| --- | --- |
| Free Render service has gone to sleep after 15 idle minutes | Open the site 10 minutes before the lecture; the frontend calls `/api/health` on load to wake it |
| Venue Wi-Fi fails or is blocked | Keep a phone hotspot ready; as a second backup, anyone with Python and Node can run `python start.py` to serve the whole app at localhost:8000 |
| First request is slow while Qiskit imports | Backend imports all libraries at startup, not per request |
| Qiskit API changes during the build | Exact versions pinned in `requirements.txt`; the pytest suite catches drift |
| Faint colors on the projector | Bars and Bloch arrows use saturated colors on black; check once on the real projector |
| An uploaded 7-qubit row makes circuits too wide to read | Teach with the bundled 2 to 4 qubit datasets; the circuit panel scrolls sideways for uploads, and amplitude always shows the compact `StatePreparation` box |
