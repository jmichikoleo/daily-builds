# backend/app/connectors/base.py: the connector contract and the shared write path for records.
# Every connector declares what it is (identity, auth, permissions, data types, schedule, privacy) and
# implements discover() and sync(). sync() writes only through Ctx.put(), which hashes content so a
# second run with the same data changes nothing (idempotent, incremental).
import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from .. import db
from ..redact import is_forbidden, redact


@dataclass
class Connector:
    id: str
    name: str
    group: str                      # code, projects, conversations, music, google, academic, files, optional
    method: str                     # local, cli, api, oauth, export, upload
    auth: str                       # none, existing gh login, oauth pkce, official export ...
    data_types: list[str]
    permissions: str
    initial: str                    # how the first import works
    incremental: str                # how later syncs avoid reprocessing
    privacy: str = "personal"       # personal, sensitive, third-party
    interval_hours: float = 24
    implemented: bool = True
    validated: str = ""             # what was actually tested, filled honestly
    needs_paths: bool = False       # requires the owner to approve folders first
    suggested_paths: list[str] = field(default_factory=list)
    categories: list[dict] = field(default_factory=list)  # optional sub-permissions, off unless default true
    notes: str = ""

    def discover(self, con) -> dict:
        """return {'status': ..., 'found': str, 'detail': {...}} without importing anything."""
        return {"status": "unsupported", "found": "not built"}

    def sync(self, ctx: "Ctx"):
        raise NotImplementedError

    def info(self) -> dict:
        d = {k: getattr(self, k) for k in ("id", "name", "group", "method", "auth", "data_types", "permissions",
                                            "initial", "incremental", "privacy", "interval_hours", "implemented",
                                            "validated", "needs_paths", "suggested_paths", "categories", "notes")}
        return d


class Ctx:
    def __init__(self, con, source_id: str, log):
        self.con = con
        self.source_id = source_id
        self.log = log
        self.added = self.updated = self.skipped = 0
        row = con.execute("select config, categories from source where id=?", (source_id,)).fetchone()
        self.config = json.loads(row["config"] or "{}") if row else {}
        self.categories = set(json.loads(row["categories"] or "[]")) if row else set()
        self.paths = [Path(r["path"]) for r in con.execute(
            "select path from approved_path where source_id=?", (source_id,))]

    def put(self, ext_id: str, kind: str, ts: str | None, title: str, body: str = "", meta: dict | None = None,
            sensitive: bool = False):
        title = redact(title)[:300]
        body = redact(body)[:12000]
        meta = meta or {}
        h = hashlib.sha256(json.dumps([kind, ts, title, body, meta], sort_keys=True, default=str).encode()).hexdigest()
        old = self.con.execute("select id, content_hash from raw_record where source_id=? and ext_id=?",
                               (self.source_id, ext_id)).fetchone()
        stamp = db.now()
        if old and old["content_hash"] == h:
            self.skipped += 1
            return
        if old:
            self.con.execute("update raw_record set kind=?, ts=?, title=?, body=?, meta=?, content_hash=?, sensitive=?,"
                             " updated_at=?, processing_version=? where id=?",
                             (kind, ts, title, body, json.dumps(meta), h, int(sensitive), stamp, "ingest-1", old["id"]))
            self.updated += 1
        else:
            self.con.execute("insert into raw_record(source_id, ext_id, kind, ts, title, body, meta, content_hash,"
                             " sensitive, imported_at, updated_at, processing_version) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                             (self.source_id, ext_id, kind, ts, title, body, json.dumps(meta), h, int(sensitive),
                              stamp, stamp, "ingest-1"))
            self.added += 1

    # file change detection: (path, mtime, size) first, sha256 only when those moved
    def file_changed(self, path: Path) -> str | None:
        st = path.stat()
        r = self.con.execute("select sha256, mtime, size from file_index where source_id=? and path=?",
                             (self.source_id, str(path))).fetchone()
        if r and r["mtime"] == st.st_mtime and r["size"] == st.st_size:
            return None
        h = sha256_file(path)
        if r and r["sha256"] == h:
            self._mark(path, h, st)
            return None
        return h

    def mark_file(self, path: Path, h: str):
        self._mark(path, h, path.stat())

    def _mark(self, path, h, st):
        self.con.execute("insert into file_index(source_id, path, sha256, mtime, size, imported_at) values (?,?,?,?,?,?)"
                         " on conflict(source_id, path) do update set sha256=excluded.sha256, mtime=excluded.mtime,"
                         " size=excluded.size, imported_at=excluded.imported_at",
                         (self.source_id, str(path), h, st.st_mtime, st.st_size, db.now()))

    def cursor(self, key, default=None):
        return db.get_meta(self.con, f"cursor:{self.source_id}:{key}", default)

    def set_cursor(self, key, value):
        db.set_meta(self.con, f"cursor:{self.source_id}:{key}", value)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def walk(roots: list[Path], max_depth=6, max_files=20000, suffixes: tuple | None = None):
    """read only walk inside approved roots. skips secrets, build output and hidden system folders."""
    seen = 0
    for root in roots:
        root = root.expanduser()
        if not root.exists():
            continue
        base_depth = len(root.parts)
        for dirpath, dirnames, filenames in os.walk(root):
            p = Path(dirpath)
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and not is_forbidden(p / d / "x")]
            if len(p.parts) - base_depth >= max_depth:
                dirnames[:] = []
            for fn in filenames:
                fp = p / fn
                if fn.startswith(".") or is_forbidden(fp):
                    continue
                if suffixes and not fn.lower().endswith(suffixes):
                    continue
                seen += 1
                if seen > max_files:
                    return
                yield fp
