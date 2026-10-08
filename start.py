"""Optional local backup: serve the API and the built frontend on http://localhost:8000.

Nothing else depends on this file. It needs Python 3.11+ and Node 20.19+:

    pip install -r backend/requirements.txt
    python start.py

The first run builds the frontend (npm install + npm run build) if frontend/dist
is missing.
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
DIST = FRONTEND / "dist"


def build_frontend() -> None:
    npm = shutil.which("npm")
    if npm is None:
        sys.exit("Node.js is needed once to build the frontend. Install it from nodejs.org and try again.")
    print("Building the frontend (first run only)...")
    subprocess.run([npm, "install"], cwd=FRONTEND, check=True)
    subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)


def main() -> None:
    if not (DIST / "index.html").exists():
        build_frontend()

    sys.path.insert(0, str(ROOT / "backend"))
    try:
        import uvicorn
        from fastapi.staticfiles import StaticFiles

        from app.main import app
    except ImportError:
        sys.exit("Install the backend first: pip install -r backend/requirements.txt")

    # API routes are registered first, so /api/... still reaches FastAPI.
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
    print("QML Encoding Lab: open http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
