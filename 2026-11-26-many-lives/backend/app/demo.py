# backend/app/demo.py: a clearly fictional demo universe ("pip"), stored in its own database file.
# It runs through the same pipeline as real data so every place has something to show before you connect sources.
import json
import random
from datetime import datetime, timedelta, timezone

from . import db
from .connectors.base import Ctx
from .pipeline import build

PROJECTS = [
    ("moonjar", "a tiny app for logging the moon phase over your tea", "2024-02-03", 140,
     ["moon phase widget", "tea timer animation", "pastel night theme", "share card design", "release notes"]),
    ("paper-garden", "a reading tracker that grows a plant per research paper", "2024-05-10", 210,
     ["citation parser", "paper import from bibtex", "literature map view", "experiment notes", "benchmark table export"]),
    ("hum-box", "a pocket songwriting toy that turns humming into melody", "2024-09-01", 95,
     ["pitch detection", "melody grid", "lyric editor", "drum loop", "song export midi"]),
    ("bus-stop-arcade", "six microgames about waiting for the bus", "2025-01-12", 60,
     ["game loop", "score board", "level two puzzle", "party mode", "sound effects"]),
    ("shelf-server", "a home server that backs up everything twice", "2025-03-20", 180,
     ["backup schedule", "restore drill", "sqlite migration", "deploy script", "server health check"]),
    ("stamp-diary", "a travel journal made of stamps", "2025-07-02", 45,
     ["stamp collage", "passport layout", "travel map", "photo strip", "journal export"]),
]
ARTISTS = ["the paper lanterns", "nadia sol", "midnight bakery", "kuro & the kites", "hana park", "the slow trains"]


def seed():
    con = db.connect("demo")
    for t in ("raw_record", "derived", "edge", "accession", "file_index", "snapshot", "discovery_state", "memory",
              "annotation", "chapter_text", "chapter_version", "exhibition_curation", "visit", "correction"):
        con.execute(f"delete from {t}")
    rnd = random.Random(42)
    con.execute("insert or replace into source(id, enabled, status, approved_at) values ('git_local',1,'connected',?)", (db.now(),))
    ctx = Ctx(con, "git_local", print)
    for name, desc, start, n, msgs in PROJECTS:
        t0 = datetime.fromisoformat(start + "T10:00:00+09:00")
        span = 120 if name != "bus-stop-arcade" else 40
        for i in range(n):
            ts = t0 + timedelta(days=rnd.random() * span, hours=rnd.choice([1, 2, 3, 10, 14, 15, 20, 22, 23]))
            ctx.put(f"{name}:{i}", "commit", ts.isoformat(), f"{rnd.choice(msgs)} {rnd.choice(['tweak', 'pass', 'polish', 'draft', 'cleanup'])}",
                    "", {"repo": name, "author": "pip"})
        last = t0 + timedelta(days=span)
        tags = [] if name in ("bus-stop-arcade", "stamp-diary") else [{"tag": "v1.0.0", "date": (t0 + timedelta(days=span * 0.8)).isoformat()}]
        ctx.put(f"repo:{name}", "repo", t0.isoformat(), name, "", {"repo": name, "commits": n, "last_commit": last.isoformat(), "tags": tags})
        for tg in tags:
            ctx.put(f"{name}:tag:{tg['tag']}", "release", tg["date"], f"{name} {tg['tag']}", "", {"repo": name, "tag": tg["tag"]})
        ctx.put(f"doc:{name}", "doc", t0.isoformat(), f"{name} / README.md", f"# {name}\n\n{desc}.\n\n" + " ".join(msgs),
                {"repo": name})
    ctx2 = Ctx(con, "claude_code", print)
    for name, desc, start, n, msgs in PROJECTS:
        t0 = datetime.fromisoformat(start + "T21:00:00+09:00") - timedelta(days=rnd.randint(9, 40))
        ctx2.put(f"s:{name}", "session", t0.isoformat(), f"thinking about {name}",
                 f"i want to build {name}, {desc}. " + " ".join(msgs[:3]), {"project": "pip-workspace", "prompts": rnd.randint(5, 60), "tool": "claude code"})
    ctx3 = Ctx(con, "spotify_export", print)
    m = datetime(2024, 1, 1, tzinfo=timezone.utc)
    while m < datetime(2025, 11, 1, tzinfo=timezone.utc):
        for a in rnd.sample(ARTISTS, 3):
            mins = rnd.randint(40, 900) + (600 if a == "midnight bakery" and m.year == 2024 else 0)
            ctx3.put(f"sp:{m:%Y-%m}:{a}", "listening", m.isoformat(), f"{a} in {m:%Y-%m}", "song one song two",
                     {"artist": a, "month": f"{m:%Y-%m}", "plays": mins // 3, "minutes": mins})
        m = (m + timedelta(days=32)).replace(day=1)
    ctx4 = Ctx(con, "documents", print)
    notes = [("lyric", "bus window lyric", "2024-10-02", "verse one the bus window fogs, chorus i hum the song anyway"),
             ("journal", "first day at the lab", "2024-05-02", "journal. the research lab smells like coffee and printer paper"),
             ("wishlist", "things i want 2025", "2025-01-01", "a film camera, a red bicycle, a quieter week"),
             ("idea", "idea for a moon game", "2024-03-12", "idea a puzzle game where the moon phase changes the level"),
             ("research", "draft abstract on reading habits", "2024-06-20", "abstract. we study how students read research papers. introduction related work references")]
    for kind, title, d, body in notes:
        ctx4.put(f"f:{title}", kind, d + "T12:00:00+09:00", title, body, {"folder": "pip notes"})
    db.set_meta(con, "demo", True)
    con.commit()
    stats = build(con)
    con.commit()
    con.close()
    return stats
