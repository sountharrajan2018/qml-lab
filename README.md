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

## The QML Pipeline (second screen)

Click **Pipeline →** in the top bar (or open `<your-vercel-link>/#pipeline`). It walks one full
quantum machine learning run in six steps:

**1 Your data → 2 Prepare → 3 Encode → 4 Compare pairs (kernel) → 5 Learn → 6 Result**

| Tab (key) | Data | Result on unseen data (quantum vs classical) |
| --- | --- | --- |
| Quantum SVM (**1**) | two half-moons, 40 dots + 20 unseen | 18/20 vs classical SVM 20/20 |
| Quantum clustering (**2**) | three blobs, 30 dots, no labels | 30/30 vs k-means 30/30 |
| Quantum CNN (**3**) | 4×4 line pictures, lying vs standing, 33 + 15 unseen | 14/15 vs small neural network 12/15 |

Use **→** / **←** (or **E**) to move between steps. Every step has **Show details** (the maths)
and **Show code** (Qiskit and PennyLane). The QCNN has no kernel: step 4 shows its trainable
circuit instead, and step 5 replays its training curve (it was trained ahead of time).

**Datasets** (all generated from fixed seeds) are in
[`frontend/public/datasets/pipeline/`](frontend/public/datasets/pipeline/) and download from
`<your-vercel-link>/datasets/pipeline/moons_train.csv` (also `moons_test.csv`, `blobs.csv`,
`lines_train.csv`, `lines_test.csv`).

**Notebook for students:** [`notebooks/qml_pipeline.ipynb`](notebooks/qml_pipeline.ipynb) runs the
same three pipelines with the same numbers. To run it in Google Colab, open
[colab.research.google.com](https://colab.research.google.com), choose **GitHub**, paste this
repository's URL and pick the notebook (the repository must be public), or download the file and
use **File → Upload notebook**. Then **Runtime → Run all** (about a minute for installs, then 40 s).

The plan behind it is in [PIPELINE_PLAN.md](PIPELINE_PLAN.md).

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
`backend/app/pipeline/` and `frontend/src/pipeline/` (the Pipeline screen, `POST /api/pipeline`).
Retrain the QCNN with `cd backend && python -m app.pipeline.qcnn`.
