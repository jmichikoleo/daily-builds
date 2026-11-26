# backend/app/backup.py: consistent sqlite backups (online backup api) and restore.
# Backups go to ~/Backups/many-lives (outside the repo). Restore keeps a copy of the current file first.
import shutil
import sqlite3
import time
from pathlib import Path

from . import config, db


def backup(label="manual", universe="real") -> Path:
    config.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.BACKUP_DIR / f"universe-{label}-{time.strftime('%Y%m%d-%H%M%S')}.sqlite"
    src = sqlite3.connect(db.db_path(universe))
    out = sqlite3.connect(dest)
    src.backup(out)
    ok = out.execute("pragma integrity_check").fetchone()[0]
    out.close()
    src.close()
    if ok != "ok":
        raise RuntimeError(f"backup integrity check failed: {ok}")
    keep = sorted(config.BACKUP_DIR.glob("universe-scheduled-*.sqlite"))
    for old in keep[:-14]:  # 14 scheduled backups kept. manual ones are never deleted
        old.unlink()
    return dest


def list_backups():
    if not config.BACKUP_DIR.exists():
        return []
    return [{"name": p.name, "size": p.stat().st_size, "at": time.strftime("%Y-%m-%d %H:%M", time.localtime(p.stat().st_mtime))}
            for p in sorted(config.BACKUP_DIR.glob("universe-*.sqlite"), reverse=True)]


def restore(name: str, universe="real") -> Path:
    src = config.BACKUP_DIR / Path(name).name
    if not src.exists():
        raise FileNotFoundError(name)
    chk = sqlite3.connect(src)
    if chk.execute("pragma integrity_check").fetchone()[0] != "ok":
        raise RuntimeError("that backup failed its integrity check")
    before = backup("before-restore", universe)
    target = sqlite3.connect(db.db_path(universe))
    chk.backup(target)  # page by page copy into the live file, safe with wal and open readers
    target.close()
    chk.close()
    return before
