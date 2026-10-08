import os
import tempfile

# Serverless hosts (e.g. Vercel) only allow writes under /tmp; Matplotlib needs a cache dir.
os.environ.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "matplotlib"))
