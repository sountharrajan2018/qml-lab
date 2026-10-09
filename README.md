# QML Encoding Lab

A one-screen teaching demo that answers one question: **how do my numbers become qubits?**
It shows five encodings (basis, angle, amplitude, IQP, Hamiltonian) with three panels:
**Your numbers → The circuit → The qubits**. The full spec is in [PLAN.md](PLAN.md).

- **Backend:** FastAPI + Qiskit (exact results, no noise), hosted on **Render** (free).
- **Frontend:** React + Vite + Tailwind, hosted on **Vercel** (free).

Everything below happens in a web browser. You do not need to install anything.

---

## Deploy (about 15 minutes, browser only)

### 1. Render: start the backend

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign in with GitHub.
2. Click **New** (top right) → **Blueprint**.
3. Find this repository in the list and click **Connect**.
   If it is not listed, click **Configure account** and give Render access to the repository.
4. Render reads `render.yaml` and shows one service, `qml-encoding-lab-api`.
   If it asks for a value for **FRONTEND_ORIGIN**, leave it **empty** for now.
5. Click **Deploy Blueprint** (or **Apply**). The first build takes about 5 minutes.
6. When the service shows **Live**, click its name and **copy the URL** at the top,
   for example `https://qml-encoding-lab-api.onrender.com`.
7. Check it: open that URL followed by `/api/health` in a new tab. You should see `{"ok":true}`.

### 2. Vercel: start the website

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub.
2. Under **Import Git Repository**, click **Import** next to this repository.
3. Next to **Root Directory**, click **Edit**, choose the **`frontend`** folder and click **Continue**.
   Vercel should now show **Framework Preset: Vite**.
4. Open **Environment Variables** and add one:
   - **Key:** `VITE_API_BASE`
   - **Value:** the Render URL from step 1.6, with no slash at the end
     (for example `https://qml-encoding-lab-api.onrender.com`)
5. Click **Deploy**. When it finishes, click **Continue to Dashboard** and **copy the domain**,
   for example `https://qml-encoding-lab.vercel.app`.

### 3. Render: allow the website to talk to the backend

1. Back in Render, open the `qml-encoding-lab-api` service → **Environment**.
2. Set **FRONTEND_ORIGIN** to the Vercel URL from step 2.5, with no slash at the end.
   (If you use more than one Vercel address, separate them with commas.)
3. Click **Save, rebuild, and deploy** (or **Save Changes**, then **Manual Deploy → Deploy latest commit**).
4. When it shows **Live** again, open the Vercel URL. The basis encoding of Row 1 should appear.

If you ever change `VITE_API_BASE` in Vercel, open **Deployments**, click **⋯** on the
latest one and choose **Redeploy**, because Vercel bakes it in at build time.

### 4. Lecture day

- **Open the Vercel site 10 minutes before the lecture.** The free Render server sleeps after
  15 idle minutes, and the first visit wakes it (this can take about a minute). The page wakes
  it automatically as soon as it opens.
- If the screen says *"Cannot reach the server"*, wait 30 seconds and click **Try again**.
- Keep a phone hotspot ready in case the venue Wi-Fi blocks the site.

---

## Using it in class

| Do this | How |
| --- | --- |
| Change encoding | Click a tab, or press **1** to **5** |
| Change row | Click **Row 1, Row 2, …**, or press the **arrow keys** |
| Walk through the three panels | Click **Explain** (or press **E**) four times: numbers, circuit, qubits, formula |
| Bigger text for the back row | Press **P** (press again to go back) |
| All five encodings side by side | Click **Compare** |
| See the code | Click **Show code** (Qiskit and PennyLane) |
| Use your own data | Click **Upload CSV** |

**Suggested 20-minute flow:** `toy_2d` Row 1 → Basis → Angle → switch to `pixels_16d` for
Amplitude ("16 pixels fit in only 4 qubits") → back to `toy_2d` or `iris_4d` for IQP and
Hamiltonian → **Compare**.

**Upload rules:** a header row, numbers only (plus an optional `label` column), at most 50
rows and 16 number columns. The file is read in your browser and never stored.

### Fixed settings (in `backend/app/encoders/`)

| Encoding | How each number is prepared | Circuit |
| --- | --- | --- |
| Basis | 1 if above its column's median, else 0 | X gates |
| Angle | scaled to 0…π by its column's min and max | one RY per qubit |
| Amplitude | divided by the row's total length, padded with zeros | one `StatePreparation` box (gate count measured after unpacking) |
| IQP | scaled to 0…π | (H, RZ, ZZ between neighbours) × 2 |
| Hamiltonian | scaled to 0…1 | start in \|+⟩, two Trotter steps of RZ + XX, t = 1 |

All results are exact (Qiskit `Statevector`). Labels read left to right: in |01⟩, q0 = 0 and q1 = 1.

---

## The QML Pipeline Builder

Click **Pipeline →** in the top bar (or open `<your-vercel-link>/#pipeline`). Students build their own
quantum machine learning pipeline from four menus, one after the other, then press **Run the pipeline ▶**:

| Menu | Choices |
| --- | --- |
| 1 Data | Sample datasets (Students: will they pass? · Healthcare: diabetes risk · Finance: loan approval · Two moons), or **Upload your own CSV** |
| 2 Encoding | Angle · ZZ feature map · IQP · Amplitude · Hamiltonian · Basis |
| 3 Quantum kernel | Fidelity (exact) · Fidelity with 1024 shots (like real hardware) · Projected quantum kernel |
| 4 Algorithm | Quantum SVM · Quantum k-nearest neighbours · Quantum clustering · Quantum neural network (QNN, uses no kernel) |

The right side shows each step: the data table, the encoding circuit for row 1, the kernel table
(coloured grid) and the result: quantum vs classical score on rows kept aside for testing, a plot,
a ✓/✗ table per row, and the QNN's training curve. **Show code** gives the whole chosen pipeline as
one runnable Python script (Qiskit + scikit-learn).

**Upload rules:** a CSV with a header row, up to **10 number columns** and **60 rows**, plus one label
column (called `label`, or any single text column such as `result` = pass/fail). A file that breaks a
rule shows one sentence. Clustering also works without a label column.

**Speed:** with the 4-column samples every combination answers in under 2 seconds. The slowest case
(10 columns = 10 qubits) takes about 5 seconds, or about 12 seconds for the QNN.

The sample CSVs are in [`frontend/public/datasets/samples/`](frontend/public/datasets/samples/) (all synthetic,
no real people). Each has a **Download this sample** link in the app.

### Guided demo

The **Guided demo** button opens the fixed six-step lecture walkthrough (data → prepare → encode →
compare pairs → learn → result) for a Quantum SVM on two moons, quantum clustering on three blobs, and a
Quantum CNN on 4×4 line pictures. Keys: **1**–**3** pick the algorithm, **→** / **←** move between steps.
Its datasets are in [`frontend/public/datasets/pipeline/`](frontend/public/datasets/pipeline/).

**Notebook for students:** [`notebooks/qml_pipeline.ipynb`](notebooks/qml_pipeline.ipynb) runs the
guided demo's three pipelines with the same numbers. To run it in Google Colab, open
[colab.research.google.com](https://colab.research.google.com), choose **GitHub**, paste this
repository's URL and pick the notebook (the repository must be public), or download the file and
use **File → Upload notebook**. Then **Runtime → Run all**.

---

## For developers (optional)

Not needed for anything above. With Python 3.11+ and Node 20.19+:

```bash
pip install -r backend/requirements.txt
python start.py            # builds the frontend once, then serves everything on http://localhost:8000
```

Tests: `pip install -r backend/requirements-dev.txt` then `cd backend && pytest`.

Layout: `backend/app/main.py` (FastAPI app, one `APIRouter` under `/api`), `backend/app/encoders/`
(one file per encoding), `backend/app/snippets/` (code shown in the drawer),
`frontend/src/EncodingLab.tsx` (the whole app as one `<EncodingLab />` component),
`backend/app/pipeline/` and `frontend/src/pipeline/` (the Pipeline Builder: `POST /api/builder/encode` and
`/api/builder/run`; the Guided demo: `POST /api/pipeline`).
Retrain the QCNN with `cd backend && python -m app.pipeline.qcnn`.
