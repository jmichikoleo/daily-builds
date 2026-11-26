# backend/tests/test_core.py: the promises the app makes, checked against throwaway data only.
# run: cd backend && .venv/bin/python -m pytest -q
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

# every test gets its own data dir before the app is imported
@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("ML_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("ML_BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setenv("ML_SCHEDULER", "0")
    monkeypatch.setenv("ML_OWNER_LOGIN", "owner@example.test")
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    from app import config, db, sync  # noqa
    con = db.connect("real")
    sync.ensure_sources(con)
    yield {"tmp": tmp_path, "con": con, "config": config, "db": db, "sync": sync}
    con.close()


def approve(env, sid, paths=(), cats=None):
    con = env["con"]
    for p in paths:
        con.execute("insert or ignore into approved_path values (?,?,?)", (sid, str(p), "now"))
    con.execute("update source set enabled=1 where id=?", (sid,))
    if cats is not None:
        con.execute("update source set categories=? where id=?", (json.dumps(cats), sid))
    con.commit()


def make_repo(path: Path, n=12):
    path.mkdir(parents=True)
    run = lambda *a: subprocess.run(a, cwd=path, check=True, capture_output=True)
    run("git", "init", "-q")
    run("git", "config", "user.email", "t@example.test")
    run("git", "config", "user.name", "t")
    for i in range(n):
        (path / "f.txt").write_text(str(i))
        run("git", "add", ".")
        run("git", "commit", "-qm", f"paper experiment benchmark step {i}")
    (path / "README.md").write_text("# moon\n\na tiny research tool for reading papers.\n\nit is live at nowhere.")
    run("git", "add", ".")
    run("git", "commit", "-qm", "write readme")
    run("git", "tag", "v1.0.0")


def test_redaction_and_forbidden(env):
    from app.redact import is_forbidden, redact
    s = redact("key sk-proj-abcdefghijklmnopqrstuv and ghp_abcdefghijklmnopqrstuvwxyz12 mail a@b.co password=hunter22")
    assert "sk-proj" not in s and "ghp_" not in s and "a@b.co" not in s and "hunter22" not in s
    assert is_forbidden(Path("/x/.env")) and is_forbidden(Path("/x/id_rsa")) and is_forbidden(Path("/x/.git/config"))
    assert not is_forbidden(Path("/x/notes/today.md"))


def test_git_incremental_and_idempotent(env):
    repo = env["tmp"] / "code" / "moon"
    make_repo(repo)
    approve(env, "git_local", [env["tmp"] / "code"])
    r1 = env["sync"].run_sync("real", "git_local")
    assert r1["status"] == "done" and r1["added"] >= 13
    r2 = env["sync"].run_sync("real", "git_local")
    assert r2["added"] == 0, "a second sync with no new commits must not add anything"
    subprocess.run(["git", "commit", "--allow-empty", "-qm", "one more"], cwd=repo, check=True)
    r3 = env["sync"].run_sync("real", "git_local")
    assert r3["added"] == 1
    n = env["con"].execute("select count(*) c from raw_record where kind='commit'").fetchone()["c"]
    assert n == 14


def test_folder_sources_need_approval(env):
    env["con"].execute("update source set enabled=1 where id='documents'")
    env["con"].commit()
    r = env["sync"].run_sync("real", "documents")
    assert r["status"] == "failed" and "approve" in r["error"]


def test_documents_formats(env):
    d = env["tmp"] / "notes"
    d.mkdir()
    (d / "lyrics for spring.md").write_text("verse one, chorus about rain")
    (d / "refs.bib").write_text("@article{k1,\n title = {Reading habits of researchers},\n year = {2024},\n}\n")
    (d / "cal.ics").write_text("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:lab meeting\nDTSTART:20240301T100000Z\nEND:VEVENT\nEND:VCALENDAR\n")
    (d / ".env").write_text("SECRET=1")
    (d / "data.csv").write_text("a,b\n1,2\n")
    approve(env, "documents", [d])
    r = env["sync"].run_sync("real", "documents")
    assert r["status"] == "done"
    kinds = {x["kind"] for x in env["con"].execute("select kind from raw_record")}
    assert {"lyric", "paper", "event", "dataset"} <= kinds
    assert not env["con"].execute("select 1 from raw_record where title like '%env%'").fetchone()


def test_export_importers(env):
    inbox = env["config"].INBOX_DIR
    conv = [{"title": "planning a moon app", "create_time": 1700000000, "update_time": 1700000500, "conversation_id": "c1",
             "mapping": {"a": {"message": {"author": {"role": "user"}, "content": {"parts": ["help me plan moon app"]}, "create_time": 1700000000}, "children": ["b", "c"]},
                         "b": {"message": {"author": {"role": "assistant"}, "content": {"parts": ["sure"]}}, "children": []},
                         "c": {"message": {"author": {"role": "assistant"}, "content": {"parts": ["ok"]}}, "children": []}}}]
    with zipfile.ZipFile(inbox / "chatgpt.zip", "w") as z:
        z.writestr("conversations.json", json.dumps(conv))
    claude = [{"uuid": "u1", "name": "song ideas", "created_at": "2024-02-01T10:00:00Z",
               "chat_messages": [{"sender": "human", "text": "a song about trains"}, {"sender": "assistant", "text": "x"}]}]
    with zipfile.ZipFile(inbox / "claude.zip", "w") as z:
        z.writestr("conversations.json", json.dumps(claude))
    plays = [{"ts": "2024-03-02T10:00:00Z", "master_metadata_album_artist_name": "nadia", "master_metadata_track_name": "t1", "ms_played": 200000},
             {"ts": "2024-03-03T10:00:00Z", "master_metadata_album_artist_name": "nadia", "master_metadata_track_name": "t1", "ms_played": 5000}]
    with zipfile.ZipFile(inbox / "my_spotify_data.zip", "w") as z:
        z.writestr("Spotify Extended Streaming History/Streaming_History_Audio_2024.json", json.dumps(plays))
    with zipfile.ZipFile(inbox / "takeout-1.zip", "w") as z:
        z.writestr("Takeout/YouTube and YouTube Music/history/watch-history.json",
                   json.dumps([{"title": "Watched how stars form", "time": "2024-04-01T00:00:00Z", "subtitles": [{"name": "space channel"}]}]))
        z.writestr("Takeout/My Activity/Search/MyActivity.json", json.dumps([{"title": "Searched for private thing", "time": "2024-04-01T00:00:00Z"}]))
    for sid in ("chatgpt_export", "claude_export", "spotify_export", "google_takeout"):
        approve(env, sid)
        assert env["sync"].run_sync("real", sid)["status"] == "done"
    rows = {r["source_id"]: dict(r) for r in env["con"].execute("select * from raw_record")}
    c = rows["chatgpt_export"]
    assert c["title"] == "planning a moon app" and "help me plan" in c["body"] and json.loads(c["meta"])["branches"] == 1
    assert "trains" in rows["claude_export"]["body"]
    sp = json.loads(rows["spotify_export"]["meta"])
    assert sp["plays"] == 1, "plays under 30 seconds are skips"
    assert rows["google_takeout"]["kind"] == "watching"
    assert not env["con"].execute("select 1 from raw_record where kind='search'").fetchone(), "search history is off by default"
    # same archives again: nothing new
    assert env["sync"].run_sync("real", "chatgpt_export")["added"] == 0


def test_pipeline_delete_and_owner_edits(env, tmp_path):
    repo = env["tmp"] / "code" / "moon"
    make_repo(repo, n=30)
    make_repo(env["tmp"] / "code" / "sun", n=20)
    approve(env, "git_local", [env["tmp"] / "code"])
    approve(env, "project_docs", [env["tmp"] / "code"])
    env["sync"].run_sync("real", "git_local")
    env["sync"].run_sync("real", "project_docs")
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    h = {"x-ml": "1"}
    assert c.post("/api/rebuild", headers=h).status_code == 200
    u = c.get("/api/universe").json()
    assert u["stats"]["projects"] >= 2
    lib = c.get("/api/library").json()
    key = lib["volumes"][0]["chapters"][0]["key"]
    assert c.put(f"/api/chapters/{key}", json={"title": "my title", "body": "my own words"}, headers=h).status_code == 200
    c.post("/api/rebuild", headers=h)
    ch = c.get(f"/api/chapters/{key}").json()["chapter"]
    assert ch["user_body"] == "my own words" and ch["title"] == "my title", "rebuild must never overwrite owner text"
    arts = c.get("/api/museum").json()["artifacts"]
    a = next(iter(arts))
    c.post("/api/annotate", json={"target": f"artifact:{a}", "field": "description", "value": "mine"}, headers=h)
    c.post("/api/rebuild", headers=h)
    assert c.get(f"/api/artifacts/{a}").json()["artifact"]["description"] == "mine"
    # every discovery and artifact points at records that exist
    for d in c.get("/api/discoveries").json()["discoveries"]:
        ids = [i for i in d["evidence"] if i > 0]
        if ids:
            got = c.get(f"/api/evidence?ids={','.join(map(str, ids))}").json()["records"]
            assert len(got) == len(ids)
    # reject a discovery and it stays gone
    ds = c.get("/api/discoveries").json()["discoveries"]
    if ds:
        c.post(f"/api/discoveries/{ds[0]['key']}", json={"state": "rejected"}, headers=h)
        c.post("/api/rebuild", headers=h)
        assert ds[0]["key"] not in [d["key"] for d in c.get("/api/discoveries").json()["discoveries"]]
    # delete the git source: its records and everything derived from them disappear
    c.delete("/api/sources/git_local/data", headers=h)
    left = env["con"].execute("select count(*) c from raw_record where source_id='git_local'").fetchone()["c"]
    assert left == 0
    projects = c.get("/api/observatory").json()["nodes"]
    assert all("git_local" not in json.dumps(n) for n in projects)
    assert not [r for r in c.get("/api/search?q=step").json()["results"] if r["kind"] == "commit"]


def test_guard(env):
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    assert c.post("/api/visit", json={"place": "museum"}).status_code == 403, "writes need x-ml"
    assert c.get("/api/universe", headers={"x-forwarded-for": "1.2.3.4"}).status_code == 403
    assert c.get("/api/universe", headers={"x-forwarded-for": "1.2.3.4", "tailscale-user-login": "someone@else"}).status_code == 403
    assert c.get("/api/universe", headers={"x-forwarded-for": "1.2.3.4", "tailscale-user-login": "owner@example.test"}).status_code == 200
    r = c.post("/api/sources/documents/approve", json={"paths": ["~"]}, headers={"x-ml": "1"})
    assert r.status_code == 400
    r = c.post("/api/sources/documents/approve", json={"paths": ["~/.ssh"]}, headers={"x-ml": "1"})
    assert r.status_code == 400


def test_backup_restore(env):
    from app import backup
    env["con"].execute("insert into memory(body, created_at) values ('before', 'now')")
    env["con"].commit()
    b = backup.backup("manual")
    env["con"].execute("delete from memory")
    env["con"].commit()
    backup.restore(b.name)
    from app import db
    con = db.connect("real")
    assert con.execute("select body from memory").fetchone()["body"] == "before"
    assert any(x["name"].startswith("universe-before-restore") for x in backup.list_backups())


def test_demo_is_separate(env):
    from app.demo import seed
    seed()
    real = env["con"].execute("select count(*) c from raw_record").fetchone()["c"]
    assert real == 0, "the demo universe must never write into the real one"
    from app import db
    assert db.connect("demo").execute("select count(*) c from raw_record").fetchone()["c"] > 100
