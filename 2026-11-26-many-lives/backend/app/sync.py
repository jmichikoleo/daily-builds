# backend/app/sync.py: running connector jobs, the background scheduler and per source bookkeeping.
# One job at a time (a lock), so the sqlite file and the machine stay calm while you explore.
import json
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone

from . import config, db
from .connectors import BY_ID, REGISTRY
from .connectors.base import Ctx

job_lock = threading.Lock()


def ensure_sources(con):
    for c in REGISTRY:
        defaults = [x["id"] for x in c.categories if x.get("default")]
        con.execute("insert or ignore into source(id, categories) values (?, ?)", (c.id, json.dumps(defaults)))
    con.commit()


def refresh_stats(con, source_id):
    r = con.execute("select count(*) n, min(ts) a, max(ts) b from raw_record where source_id=?", (source_id,)).fetchone()
    con.execute("update source set records=?, earliest=?, latest=? where id=?", (r["n"], r["a"], r["b"], source_id))


def discover_all(con) -> list[dict]:
    ensure_sources(con)
    out = []
    for c in REGISTRY:
        try:
            d = c.discover(con)
        except Exception as e:
            d = {"status": "unsupported", "found": f"discovery failed: {e}"}
        row = con.execute("select * from source where id=?", (c.id,)).fetchone()
        if not row["enabled"]:
            con.execute("update source set status=?, coverage=? where id=?", (d["status"], d.get("found"), c.id))
        out.append({"id": c.id, **d})
    con.commit()
    return out


def run_sync(universe: str, source_id: str, reason="manual") -> dict:
    c = BY_ID[source_id]
    with job_lock:
        con = db.connect(universe)
        started = db.now()
        lines: list[str] = []
        jid = con.execute("insert into sync_job(source_id, kind, status, started) values (?,?,?,?)",
                          (source_id, reason, "running", started)).lastrowid
        con.execute("update source set status='importing' where id=?", (source_id,))
        con.commit()
        ctx = Ctx(con, source_id, lambda m: lines.append(m))
        status, err = "done", None
        try:
            if c.needs_paths and not ctx.paths:
                raise RuntimeError("no folder approved yet. approve at least one folder for this source")
            c.sync(ctx)
            con.commit()
        except Exception as e:
            con.rollback()
            status, err = "failed", str(e)[:500]
            lines.append(traceback.format_exc(limit=3)[-800:])
        nxt = (datetime.now(timezone.utc) + timedelta(hours=c.interval_hours)).isoformat()
        refresh_stats(con, source_id)
        con.execute("update sync_job set status=?, finished=?, added=?, updated=?, skipped=?, error=?, log=? where id=?",
                    (status, db.now(), ctx.added, ctx.updated, ctx.skipped, err, "\n".join(lines[-80:]), jid))
        recs = con.execute("select records from source where id=?", (source_id,)).fetchone()["records"]
        new_status = "synchronization failed" if err else ("connected" if recs else "connected")
        con.execute("update source set last_sync=?, next_sync=?, last_error=?, status=? where id=?",
                    (db.now(), nxt, err, new_status, source_id))
        if ctx.added or ctx.updated:
            db.set_meta(con, "dirty", True)
        db.audit(con, "sync", {"source": source_id, "status": status, "added": ctx.added, "updated": ctx.updated}, actor=reason)
        con.commit()
        con.close()
        return {"job": jid, "status": status, "error": err, "added": ctx.added, "updated": ctx.updated, "skipped": ctx.skipped}


def rebuild_if_dirty(universe: str, force=False):
    from .pipeline import build
    con = db.connect(universe)
    try:
        if force or db.get_meta(con, "dirty", True):
            with job_lock:
                build(con)
                db.set_meta(con, "dirty", False)
                con.commit()
                return True
    finally:
        con.close()
    return False


def due_sources(con):
    now = datetime.now(timezone.utc).isoformat()
    return [r["id"] for r in con.execute(
        "select id from source where enabled=1 and paused=0 and (next_sync is null or next_sync <= ?)", (now,))]


def scheduler_loop(stop: threading.Event):
    last_backup = None
    while not stop.wait(60):
        try:
            con = db.connect("real")
            paused = db.get_meta(con, "paused_all", False)
            ids = [] if paused else due_sources(con)
            con.close()
            for sid in ids:
                if sid in BY_ID:
                    run_sync("real", sid, reason="scheduled")
            rebuild_if_dirty("real")
            today = time.strftime("%Y-%m-%d")
            if time.strftime("%H") == "04" and last_backup != today:
                from .backup import backup
                backup("scheduled")
                last_backup = today
        except Exception:
            traceback.print_exc()


def start_scheduler() -> threading.Event:
    stop = threading.Event()
    if config.SCHEDULER_ON:
        threading.Thread(target=scheduler_loop, args=(stop,), daemon=True, name="ml-scheduler").start()
    return stop
