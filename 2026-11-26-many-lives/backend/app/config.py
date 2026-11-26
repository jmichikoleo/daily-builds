# backend/app/config.py: paths and settings, all from env with safe defaults.
# Real personal data lives OUTSIDE the repo (ML_DATA_DIR). The demo universe has its own folder.
import os
from pathlib import Path

HOME = Path.home()
DATA_DIR = Path(os.environ.get("ML_DATA_DIR", HOME / "Library/Application Support/many-lives-dev")).expanduser()
DEMO_DIR = DATA_DIR / "demo"
INBOX_DIR = DATA_DIR / "inbox"          # drop official export zips here, the export importers watch it
BACKUP_DIR = Path(os.environ.get("ML_BACKUP_DIR", HOME / "Backups/many-lives")).expanduser()
STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

# tailscale serve sets Tailscale-User-Login. when set, only this login may use the app over the tailnet.
OWNER_LOGIN = os.environ.get("ML_OWNER_LOGIN", "").strip().lower()
SCHEDULER_ON = os.environ.get("ML_SCHEDULER", "1") == "1"
GITHUB_USER = os.environ.get("ML_GITHUB_USER", "")  # empty = whoever gh is logged in as
SPOTIFY_CLIENT_ID = os.environ.get("ML_SPOTIFY_CLIENT_ID", "")
SPOTIFY_REDIRECT = os.environ.get("ML_SPOTIFY_REDIRECT", "http://127.0.0.1:4686/api/spotify/callback")
LOCAL_TZ = os.environ.get("ML_TZ", "Asia/Seoul")
PROCESSING_VERSION = "pipeline-1"

for d in (DATA_DIR, DEMO_DIR, INBOX_DIR):
    d.mkdir(parents=True, exist_ok=True)
