# backend/app/db.py: sqlite schema and small helpers.
# Layers are kept apart on purpose:
#   raw_record          imported evidence (one row per source item, provenance in source_id + ext_id)
#   interest/project/.. derived observations, rebuilt by the pipeline, keyed by a stable `key`
#   annotation/memory/  things the owner wrote. the pipeline never touches these tables.
#   chapter.user_body
import json
import sqlite3
import threading
import time
from pathlib import Path

from . import config

SCHEMA = """
create table if not exists meta (k text primary key, v text);

create table if not exists source (
  id text primary key, enabled integer default 0, paused integer default 0,
  approved_at text, config text default '{}', categories text default '[]',
  last_sync text, next_sync text, last_error text, status text default 'discovered',
  records integer default 0, earliest text, latest text, coverage text
);
create table if not exists approved_path (
  source_id text, path text, approved_at text, primary key (source_id, path)
);
create table if not exists raw_record (
  id integer primary key, source_id text not null, ext_id text not null, kind text not null,
  ts text, title text, body text, meta text default '{}', content_hash text,
  sensitive integer default 0, hidden integer default 0, imported_at text, updated_at text,
  processing_version text, unique (source_id, ext_id)
);
create index if not exists raw_source on raw_record(source_id);
create index if not exists raw_ts on raw_record(ts);
create table if not exists file_index (
  source_id text, path text, sha256 text, mtime real, size integer, imported_at text,
  primary key (source_id, path)
);
create table if not exists sync_job (
  id integer primary key, source_id text, kind text, status text, started text, finished text,
  added integer default 0, updated integer default 0, skipped integer default 0, error text, log text
);

-- derived (rebuilt). `data` holds the full object as json, columns are for filtering.
create table if not exists derived (
  type text, key text, title text, ts_start text, ts_end text, data text,
  primary key (type, key)
);
create table if not exists edge (
  a text, b text, kind text, weight real, why text, evidence text, primary key (a, b, kind)
);
create table if not exists accession (key text primary key, number text);

-- owner layer, never rebuilt
create table if not exists annotation (
  target text, field text, value text, updated_at text, primary key (target, field)
);
create table if not exists discovery_state (
  key text primary key, state text default 'new', note text, updated_at text
);
create table if not exists correction (
  id integer primary key, target text, verdict text, note text, created_at text
);
create table if not exists memory (
  id integer primary key, title text, body text, date text, question_key text, created_at text, updated_at text
);
create table if not exists chapter_text (
  key text primary key, user_title text, user_body text, updated_at text
);
create table if not exists chapter_version (
  id integer primary key, key text, author text, title text, body text, created_at text
);
create table if not exists exhibition_curation (
  key text primary key, title text, intro text, artifact_keys text, updated_at text
);
create table if not exists collection (
  id integer primary key, title text, note text, items text default '[]', created_at text
);
create table if not exists snapshot (
  id integer primary key, at text, kind text, label text, data text
);
create table if not exists visit (id integer primary key, place text, at text);
create table if not exists audit (id integer primary key, at text, actor text, action text, detail text);

create virtual table if not exists search_index using fts5(
  ref, kind, title, body, ts unindexed, tokenize = 'unicode61 remove_diacritics 2'
);
"""

_lock = threading.Lock()


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def db_path(universe: str = "real") -> Path:
    return (config.DEMO_DIR if universe == "demo" else config.DATA_DIR) / "universe.sqlite"


def connect(universe: str = "real") -> sqlite3.Connection:
    con = sqlite3.connect(db_path(universe), timeout=30, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("pragma journal_mode=wal")
    con.execute("pragma foreign_keys=on")
    with _lock:
        con.executescript(SCHEMA)
    return con


def audit(con, action: str, detail="", actor="owner"):
    con.execute("insert into audit(at, actor, action, detail) values (?,?,?,?)",
                (now(), actor, action, detail if isinstance(detail, str) else json.dumps(detail)))


def get_meta(con, k, default=None):
    r = con.execute("select v from meta where k=?", (k,)).fetchone()
    return json.loads(r["v"]) if r else default


def set_meta(con, k, v):
    con.execute("insert into meta(k,v) values(?,?) on conflict(k) do update set v=excluded.v", (k, json.dumps(v)))


def rows(con, sql, args=()):
    return [dict(r) for r in con.execute(sql, args).fetchall()]


def derived(con, type_: str):
    out = []
    for r in con.execute("select key, data from derived where type=? order by ts_start, key", (type_,)):
        out.append(json.loads(r["data"]))
    return out


def derived_one(con, type_: str, key: str):
    r = con.execute("select data from derived where type=? and key=?", (type_, key)).fetchone()
    return json.loads(r["data"]) if r else None


def annotations(con, prefix: str = "") -> dict:
    out: dict = {}
    for r in con.execute("select target, field, value from annotation where target like ?", (prefix + "%",)):
        out.setdefault(r["target"], {})[r["field"]] = r["value"]
    return out
