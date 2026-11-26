# backend/app/main.py: the http api and the static frontend, one process on 127.0.0.1.
# Private by design: it only listens on loopback. Tailscale serve forwards tailnet requests and adds the
# Tailscale-User-Login header, which must match ML_OWNER_LOGIN. Every write needs the x-ml header,
# which a cross site form cannot send.
import html
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import backup as bk
from . import config, db, sync
from .connectors import BY_ID, PLANNED, REGISTRY
from .connectors.media import SpotifyApi
from .redact import is_forbidden
from .search import search as do_search


@asynccontextmanager
async def lifespan(app):
    for u in ("real", "demo"):
        con = db.connect(u)
        sync.ensure_sources(con)
        con.close()
    stop = sync.start_scheduler()
    yield
    stop.set()


app = FastAPI(title="the many lives of me", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def guard(request: Request, call_next):
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "testclient"):
        return JSONResponse({"error": "local only"}, status_code=403)
    login = (request.headers.get("tailscale-user-login") or "").lower()
    via_proxy = "x-forwarded-for" in request.headers
    if via_proxy and (not config.OWNER_LOGIN or login != config.OWNER_LOGIN):
        return JSONResponse({"error": "this universe is private"}, status_code=403)
    if request.method in ("POST", "PUT", "DELETE", "PATCH") and request.url.path.startswith("/api/") \
            and request.headers.get("x-ml") != "1" and not request.url.path.startswith("/api/spotify/callback"):
        return JSONResponse({"error": "missing x-ml header"}, status_code=403)
    resp = await call_next(request)
    resp.headers["x-content-type-options"] = "nosniff"
    resp.headers["referrer-policy"] = "no-referrer"
    resp.headers["x-frame-options"] = "DENY"
    resp.headers["content-security-policy"] = ("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' "
                                               "https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; "
                                               "connect-src 'self'; frame-ancestors 'none'")
    if request.url.path.startswith("/api/"):
        resp.headers["cache-control"] = "no-store"
    return resp


def U(request: Request) -> str:
    return "demo" if request.headers.get("x-universe") == "demo" or request.query_params.get("universe") == "demo" else "real"


def con_for(request: Request):
    return db.connect(U(request))


def apply_ann(con, type_, objs, fields=("name", "title", "description", "favorite", "hidden", "note")):
    ann = db.annotations(con, f"{type_}:")
    for o in objs:
        a = ann.get(f"{type_}:{o['key']}", {})
        o["edited"] = {}
        for f in fields:
            if f in a:
                o["edited"][f] = True
                if f == "favorite" or f == "hidden":
                    o[f] = a[f] == "1"
                else:
                    o["generated_" + f] = o.get(f)
                    o[f] = a[f]
    return objs


def states(con):
    return {r["key"]: dict(r) for r in con.execute("select * from discovery_state")}


# ---------------- universe ----------------
@app.get("/api/universe")
def universe(request: Request):
    con = con_for(request)
    stats = db.get_meta(con, "stats", {}) or {}
    st = states(con)
    disc = db.derived(con, "discovery")
    new = [d for d in disc if st.get(d["key"], {}).get("state") == "new"]
    place_new = {}
    for d in new:
        for l in d.get("links", []):
            place_new[l["place"]] = place_new.get(l["place"], 0) + 1
    visits = [r["place"] for r in con.execute("select distinct place from visit")]
    selves = apply_ann(con, "self", db.derived(con, "self"))
    interests = db.derived(con, "interest")
    projects = db.derived(con, "project")
    eras = apply_ann(con, "era", db.derived(con, "era"), fields=("title",))
    snaps = db.rows(con, "select id, at, kind, label from snapshot order by id desc limit 30")
    answered = con.execute("select count(*) c from memory where question_key is not null").fetchone()["c"]
    unknown_open = len({"multiverse", "museum", "archive", "library", "observatory"} & set(visits)) >= 3 or "unknown" in visits
    res = {
        "universe": U(request), "stats": stats,
        "origin": {"current_era": eras[-1] if eras else None,
                   "active_selves": [s for s in selves if s["status"] == "active"][:6],
                   "emerging": [i["label"] for i in interests if i["status"] == "emerging"][:5],
                   "active_projects": [p["name"] for p in projects if p["status"] == "active"][:8]},
        "places": {
            "multiverse": {"count": len(selves), "new": place_new.get("multiverse", 0), "preview": [s["name"] for s in selves[:5]]},
            "museum": {"count": len(db.derived(con, "artifact")), "new": place_new.get("museum", 0),
                       "preview": [e["title"] for e in db.derived(con, "exhibition")[:4]]},
            "archive": {"count": len(db.derived(con, "report")), "new": place_new.get("archive", 0)},
            "library": {"count": len(db.derived(con, "chapter")), "new": place_new.get("library", 0)},
            "observatory": {"count": len(interests), "new": place_new.get("observatory", 0)},
            "unknown": {"count": len(db.derived(con, "question")), "new": place_new.get("unknown", 0),
                        "open": unknown_open, "answered": answered},
        },
        "eras": eras, "new_discoveries": len(new), "visits": visits, "snapshots": snaps,
        "satellites": sorted([{"key": p["key"], "name": p["name"], "status": p["status"], "commits": p["commits"]} for p in projects],
                             key=lambda p: -p["commits"])[:24],
        "paused_all": db.get_meta(con, "paused_all", False),
    }
    con.close()
    return res


@app.post("/api/visit")
def visit(request: Request, body: dict = Body(...)):
    con = con_for(request)
    con.execute("insert into visit(place, at) values (?,?)", (str(body.get("place"))[:40], db.now()))
    con.commit()
    return {"ok": True}


@app.get("/api/history")
def history(request: Request):
    con = con_for(request)
    return {"visits": db.rows(con, "select place, at from visit order by id desc limit 200")}


# ---------------- evidence ----------------
@app.get("/api/evidence")
def evidence(request: Request, ids: str = ""):
    con = con_for(request)
    want = [int(x) for x in ids.split(",") if re.fullmatch(r"-?\d+", x)][:80]
    out = []
    pos = [i for i in want if i > 0]
    if pos:
        q = ",".join("?" * len(pos))
        for r in con.execute(f"select id, source_id, ext_id, kind, ts, title, substr(body,1,700) body, meta, imported_at, sensitive, hidden "
                             f"from raw_record where id in ({q})", pos):
            d = dict(r)
            d["meta"] = json.loads(d["meta"] or "{}")
            d["meta"].pop("path", None) if d["sensitive"] else None
            if d["sensitive"]:
                d["body"] = "[sensitive, open the studio preview to see it]"
            out.append(d)
    for i in [i for i in want if i < 0]:
        m = con.execute("select * from memory where id=?", (-i,)).fetchone()
        if m:
            out.append({"id": i, "source_id": "owner", "kind": "memory", "ts": m["date"], "title": m["title"], "body": m["body"], "meta": {}})
    return {"records": out}


@app.post("/api/records/{rid}/hide")
def hide_record(rid: int, request: Request, body: dict = Body(default={})):
    con = con_for(request)
    con.execute("update raw_record set hidden=? where id=?", (1 if body.get("hidden", True) else 0, rid))
    db.audit(con, "hide record", {"id": rid})
    db.set_meta(con, "dirty", True)
    con.commit()
    return {"ok": True}


# ---------------- multiverse ----------------
@app.get("/api/selves")
def selves(request: Request):
    con = con_for(request)
    return {"selves": apply_ann(con, "self", db.derived(con, "self"))}


@app.get("/api/selves/{key}")
def self_one(key: str, request: Request):
    con = con_for(request)
    s = db.derived_one(con, "self", key)
    if not s:
        raise HTTPException(404)
    apply_ann(con, "self", [s])
    arts = [a for a in db.derived(con, "artifact") if key in a.get("selves", [])][:24]
    projects = [p for p in db.derived(con, "project") if p["key"] in s["projects"]]
    disc = [d for d in db.derived(con, "discovery") if f"self:{key}" in d.get("entities", [])]
    chapters = [c for c in db.derived(con, "chapter") if key in c.get("selves", [])]
    others = {o["key"]: o["name"] for o in apply_ann(con, "self", db.derived(con, "self"))}
    return {"self": s, "artifacts": apply_ann(con, "artifact", arts), "projects": projects, "discoveries": disc,
            "chapters": [{"key": c["key"], "title": c["title"]} for c in chapters], "names": others}


# ---------------- museum ----------------
def exhibitions(con):
    auto = db.derived(con, "exhibition")
    cur = {r["key"]: dict(r) for r in con.execute("select * from exhibition_curation")}
    out = []
    for e in auto:
        c = cur.pop(e["key"], None)
        if c:
            e["generated_title"] = e["title"]
            e["title"] = c["title"] or e["title"]
            e["intro"] = c["intro"] or e["intro"]
            if c["artifact_keys"]:
                e["artifacts"] = json.loads(c["artifact_keys"])
            e["curated"] = True
        out.append(e)
    for k, c in cur.items():  # exhibitions the owner made from scratch
        out.append({"key": k, "title": c["title"], "intro": c["intro"] or "", "artifacts": json.loads(c["artifact_keys"] or "[]"),
                    "auto": False, "curated": True})
    return out


@app.get("/api/museum")
def museum(request: Request):
    con = con_for(request)
    arts = apply_ann(con, "artifact", db.derived(con, "artifact"))
    arts = [a for a in arts if not a.get("hidden")]
    return {"exhibitions": exhibitions(con), "artifacts": {a["key"]: a for a in arts}}


@app.get("/api/artifacts/{key}")
def artifact(key: str, request: Request):
    con = con_for(request)
    a = db.derived_one(con, "artifact", key)
    if not a:
        raise HTTPException(404)
    apply_ann(con, "artifact", [a])
    rel = [db.derived_one(con, "artifact", k) for k in a.get("related", [])]
    ch = db.derived_one(con, "chapter", a["era"]) if a.get("era") else None
    selves = {s["key"]: s["name"] for s in apply_ann(con, "self", db.derived(con, "self"))}
    return {"artifact": a, "related": [r for r in rel if r], "chapter": {"key": ch["key"], "title": ch["title"]} if ch else None,
            "selves": selves}


@app.post("/api/exhibitions/{key}")
def curate(key: str, request: Request, body: dict = Body(...)):
    con = con_for(request)
    con.execute("insert into exhibition_curation(key, title, intro, artifact_keys, updated_at) values (?,?,?,?,?) "
                "on conflict(key) do update set title=excluded.title, intro=excluded.intro, artifact_keys=excluded.artifact_keys, updated_at=excluded.updated_at",
                (key[:80], body.get("title"), body.get("intro"), json.dumps(body.get("artifacts")) if body.get("artifacts") is not None else None, db.now()))
    db.audit(con, "curate exhibition", {"key": key})
    con.commit()
    return {"ok": True}


@app.delete("/api/exhibitions/{key}")
def uncurate(key: str, request: Request):
    con = con_for(request)
    con.execute("delete from exhibition_curation where key=?", (key,))
    con.commit()
    return {"ok": True}


# ---------------- annotations and corrections ----------------
@app.post("/api/annotate")
def annotate(request: Request, body: dict = Body(...)):
    target, field = str(body.get("target", ""))[:200], str(body.get("field", ""))[:40]
    if not re.fullmatch(r"(self|artifact|era|project|interest|chapter|discovery):[\w\-.@:%]+", target):
        raise HTTPException(400, "bad target")
    con = con_for(request)
    if body.get("value") is None:
        con.execute("delete from annotation where target=? and field=?", (target, field))
    else:
        con.execute("insert into annotation(target, field, value, updated_at) values (?,?,?,?) on conflict(target, field) "
                    "do update set value=excluded.value, updated_at=excluded.updated_at", (target, field, str(body["value"])[:20000], db.now()))
    db.audit(con, "annotate", {"target": target, "field": field})
    con.commit()
    return {"ok": True}


@app.post("/api/corrections")
def correct(request: Request, body: dict = Body(...)):
    con = con_for(request)
    con.execute("insert into correction(target, verdict, note, created_at) values (?,?,?,?)",
                (str(body.get("target"))[:200], str(body.get("verdict"))[:20], str(body.get("note") or "")[:4000], db.now()))
    db.set_meta(con, "dirty", True)
    db.audit(con, "correction", body)
    con.commit()
    return {"ok": True}


@app.get("/api/corrections")
def corrections(request: Request):
    con = con_for(request)
    return {"corrections": db.rows(con, "select * from correction order by id desc")}


# ---------------- archive ----------------
@app.get("/api/archive")
def archive(request: Request):
    con = con_for(request)
    return {"reports": db.derived(con, "report"), "gaps": db.derived(con, "gap")}


# ---------------- library ----------------
def chapter_full(con, c):
    t = con.execute("select * from chapter_text where key=?", (c["key"],)).fetchone()
    ann = db.annotations(con, f"era:{c['key']}").get(f"era:{c['key']}", {})
    c["generated_title"] = c["title"]
    if ann.get("title"):
        c["title"] = ann["title"]
    if t:
        c["user_title"] = t["user_title"]
        c["user_body"] = t["user_body"]
        c["user_updated"] = t["updated_at"]
        if t["user_title"]:
            c["title"] = t["user_title"]
        last_gen = con.execute("select created_at from chapter_version where key=? and author='biographer' order by id desc limit 1", (c["key"],)).fetchone()
        c["draft_changed_since_edit"] = bool(last_gen and last_gen["created_at"] > (t["updated_at"] or ""))
    return c


@app.get("/api/library")
def library(request: Request):
    con = con_for(request)
    chs = [chapter_full(con, c) for c in db.derived(con, "chapter")]
    vols = {}
    for c in chs:
        vols.setdefault(c["volume"], []).append({k: c.get(k) for k in ("key", "title", "start", "end", "kind", "user_body")})
    return {"volumes": [{"year": y, "chapters": v} for y, v in sorted(vols.items())],
            "retros": db.get_meta(con, "retros", []), "stories": [{"key": s["key"], "name": s["name"], "lore": s["lore"]} for s in apply_ann(con, "self", db.derived(con, "self"))]}


@app.get("/api/chapters/{key}")
def chapter(key: str, request: Request):
    con = con_for(request)
    c = db.derived_one(con, "chapter", key)
    if not c:
        raise HTTPException(404)
    chapter_full(con, c)
    versions = db.rows(con, "select id, author, title, created_at, length(body) size from chapter_version where key=? order by id desc", (key,))
    arts = [a for a in db.derived(con, "artifact") if a.get("era") == key][:12]
    return {"chapter": c, "versions": versions, "artifacts": arts}


@app.get("/api/chapters/{key}/versions/{vid}")
def chapter_version(key: str, vid: int, request: Request):
    con = con_for(request)
    r = con.execute("select * from chapter_version where key=? and id=?", (key, vid)).fetchone()
    if not r:
        raise HTTPException(404)
    return dict(r)


@app.put("/api/chapters/{key}")
def edit_chapter(key: str, request: Request, body: dict = Body(...)):
    con = con_for(request)
    title, text = body.get("title"), body.get("body")
    con.execute("insert into chapter_text(key, user_title, user_body, updated_at) values (?,?,?,?) on conflict(key) do update set "
                "user_title=excluded.user_title, user_body=excluded.user_body, updated_at=excluded.updated_at", (key, title, text, db.now()))
    con.execute("insert into chapter_version(key, author, title, body, created_at) values (?,?,?,?,?)", (key, "owner", title, text or "", db.now()))
    db.audit(con, "edit chapter", {"key": key})
    con.commit()
    return {"ok": True}


def book_markdown(con) -> str:
    out = ["# the many lives of me", "", "_a book made from records. facts, interpretations and fiction are marked._", ""]
    for c in sorted([chapter_full(con, c) for c in db.derived(con, "chapter")], key=lambda c: (c["volume"], c["kind"] != "era", c["start"])):
        out += [f"## {c['title']}", f"_{c['start']} to {c['end']}_", ""]
        if c.get("user_body"):
            out += [c["user_body"], ""]
        else:
            for b in c["blocks"]:
                tag = {"interpretation": "*interpretation.* ", "owner": "", "discovery": "*discovery.* "}.get(b["kind"], "")
                out.append(tag + b["text"])
                out.append("")
    return "\n".join(out)


@app.get("/api/library/export")
def export(request: Request, fmt: str = "md"):
    con = con_for(request)
    md = book_markdown(con)
    db.audit(con, "export", {"fmt": fmt})
    con.commit()
    if fmt == "md":
        return PlainTextResponse(md, headers={"content-disposition": "attachment; filename=many-lives.md"})
    body = []
    for line in md.splitlines():
        e = html.escape(line)
        e = re.sub(r"\*(.+?)\*", r"<em>\1</em>", e)
        e = re.sub(r"_(.+?)_", r"<em>\1</em>", e)
        if line.startswith("## "):
            body.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("# "):
            body.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.strip():
            body.append(f"<p>{e}</p>")
    page = ("<!doctype html><meta charset=utf-8><title>the many lives of me</title><style>body{font:17px/1.6 Georgia,serif;max-width:38em;margin:3em auto;"
            "color:#40364D;background:#FFFDF8;padding:0 1em}h2{page-break-before:always;font-weight:normal;font-size:1.8em}h1{font-weight:normal;font-size:2.6em}"
            "@media print{body{margin:0}}</style>" + "\n".join(body))
    return HTMLResponse(page, headers={"content-disposition": "attachment; filename=many-lives.html"} if fmt == "html" else {})


# ---------------- observatory ----------------
@app.get("/api/observatory")
def observatory(request: Request, at: str | None = None):
    con = con_for(request)
    interests = db.derived(con, "interest")
    projects = db.derived(con, "project")
    selves = apply_ann(con, "self", db.derived(con, "self"))
    eras = apply_ann(con, "era", db.derived(con, "era"), fields=("title",))
    favs = {k.split(":", 1)[1] for k, v in db.annotations(con, "artifact:").items() if v.get("favorite") == "1"}
    arts = [a for a in db.derived(con, "artifact") if a["key"] in favs or a["kind"] in ("first", "milestone")]
    nodes = []
    iann = db.annotations(con, "interest:")

    def alive(first, last):
        if not at:
            return True
        return (first or "0000") <= at

    for i in interests:
        if alive(i["first_seen"], i["last_seen"]):
            w = sum(v for m, v in i["monthly"].items() if not at or m <= at)
            dist = "far" if (i["status"] == "dormant" or (at and i["last_seen"] and i["last_seen"] < at[:4] + "-00")) else "near"
            nodes.append({"id": f"interest:{i['key']}", "type": "interest", "label": iann.get(f"interest:{i['key']}", {}).get("name", i["label"]), "size": w, "status": i["status"],
                          "first": i["first_seen"], "last": i["last_seen"], "distance": dist, "monthly": i["monthly"]})
    for p in projects:
        if alive((p["created"] or "")[:7], None):
            nodes.append({"id": f"project:{p['key']}", "type": "project", "label": p["name"], "size": p["commits"], "status": p["status"],
                          "first": (p["created"] or "")[:7], "last": (p["last_activity"] or "")[:7]})
    for s in selves:
        if alive(s["first_seen"], s["last_seen"]):
            nodes.append({"id": f"self:{s['key']}", "type": "self", "label": s["name"], "size": len(s["interests"]) + 1, "status": s["status"],
                          "first": s["first_seen"], "last": s["last_seen"], "palette": s["palette"]})
    for a in arts:
        if alive(a.get("period"), None):
            nodes.append({"id": f"artifact:{a['key']}", "type": "star", "label": a["title"], "size": 1, "first": a.get("period"), "status": "star",
                          "link": a.get("project")})
    ids = {n["id"] for n in nodes}
    edges = [dict(r) for r in con.execute("select a, b, kind, weight, why from edge") if r["a"] in ids and r["b"] in ids]
    for n in nodes:
        if n["type"] == "star" and n.get("link") and f"project:{n['link']}" in ids:
            edges.append({"a": n["id"], "b": f"project:{n['link']}", "kind": "remembered", "weight": 0.4, "why": "a museum artifact from this project."})
    galaxies = [e for e in eras if not at or e["start"] <= at]
    return {"nodes": nodes, "edges": edges, "constellations": db.derived(con, "constellation"), "galaxies": galaxies, "at": at,
            "reconstructed": bool(at), "note": "a reconstruction from today's records, not a snapshot taken at the time" if at else None}


@app.get("/api/edge")
def edge_detail(request: Request, a: str, b: str):
    con = con_for(request)
    r = con.execute("select * from edge where (a=? and b=?) or (a=? and b=?)", (a, b, b, a)).fetchall()
    ev = []
    t1, k1 = a.split(":", 1)
    t2, k2 = b.split(":", 1)
    o1, o2 = db.derived_one(con, t1, k1), db.derived_one(con, t2, k2)
    if o1 and o2:
        ev = sorted(set(o1.get("evidence", [])) & set(o2.get("evidence", [])))[:20] or (o1.get("evidence", [])[:6] + o2.get("evidence", [])[:6])
    return {"edges": [dict(x) for x in r], "evidence": ev,
            "a": {"title": (o1 or {}).get("label") or (o1 or {}).get("name"), "type": t1},
            "b": {"title": (o2 or {}).get("label") or (o2 or {}).get("name"), "type": t2}}


@app.get("/api/node/{ref}")
def node(ref: str, request: Request):
    con = con_for(request)
    t, k = ref.split(":", 1)
    o = db.derived_one(con, t if t != "star" else "artifact", k)
    if not o:
        raise HTTPException(404)
    links = db.rows(con, "select a, b, kind, why from edge where a=? or b=? order by weight desc limit 30", (ref, ref))
    return {"node": o, "links": links}


# ---------------- discoveries ----------------
@app.get("/api/discoveries")
def discoveries(request: Request):
    con = con_for(request)
    st = states(con)
    out = []
    for d in db.derived(con, "discovery"):
        s = st.get(d["key"], {})
        d["state"] = s.get("state", "new")
        d["note"] = s.get("note")
        d["first_seen"] = s.get("updated_at")
        out.append(d)
    out.sort(key=lambda d: (d["state"] != "new", -(d["confidence"]["score"])))
    return {"discoveries": [d for d in out if d["state"] != "hidden"], "hidden": len([d for d in out if d["state"] == "hidden"])}


@app.post("/api/discoveries/{key}")
def discovery_set(key: str, request: Request, body: dict = Body(...)):
    state = body.get("state")
    if state not in (None, "new", "seen", "confirmed", "rejected", "saved", "hidden", "corrected"):
        raise HTTPException(400)
    con = con_for(request)
    cur = con.execute("select * from discovery_state where key=?", (key,)).fetchone()
    con.execute("insert into discovery_state(key, state, note, updated_at) values (?,?,?,?) on conflict(key) do update set "
                "state=coalesce(?, discovery_state.state), note=coalesce(?, discovery_state.note), updated_at=discovery_state.updated_at",
                (key, state or "seen", body.get("note"), db.now(), state, body.get("note")))
    if state in ("rejected", "corrected"):
        con.execute("insert into correction(target, verdict, note, created_at) values (?,?,?,?)",
                    (f"discovery:{key}", state, body.get("note") or "", db.now()))
    db.audit(con, "discovery", {"key": key, "state": state})
    con.commit()
    return {"ok": True}


# ---------------- unknown room ----------------
@app.get("/api/unknown")
def unknown(request: Request):
    con = con_for(request)
    mem = db.rows(con, "select * from memory order by coalesce(date, created_at) desc")
    answered = {m["question_key"]: m for m in mem if m["question_key"]}
    qs = db.derived(con, "question")
    for q in qs:
        q["answer"] = answered.get(q["key"])
    return {"questions": qs, "memories": mem, "gaps": db.derived(con, "gap")}


@app.post("/api/memories")
def add_memory(request: Request, body: dict = Body(...)):
    con = con_for(request)
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(400, "empty")
    date = body.get("date") or None
    if date and not re.fullmatch(r"\d{4}-\d{2}(-\d{2})?", date):
        raise HTTPException(400, "date must be yyyy-mm or yyyy-mm-dd")
    if date and len(date) == 7:
        date += "-15"
    mid = con.execute("insert into memory(title, body, date, question_key, created_at, updated_at) values (?,?,?,?,?,?)",
                      (str(body.get("title") or "")[:200], text[:20000], date, body.get("question_key"), db.now(), db.now())).lastrowid
    db.set_meta(con, "dirty", True)
    db.audit(con, "memory", {"id": mid})
    con.commit()
    return {"id": mid}


@app.put("/api/memories/{mid}")
def edit_memory(mid: int, request: Request, body: dict = Body(...)):
    con = con_for(request)
    con.execute("update memory set title=coalesce(?, title), body=coalesce(?, body), date=coalesce(?, date), updated_at=? where id=?",
                (body.get("title"), body.get("body"), body.get("date"), db.now(), mid))
    db.set_meta(con, "dirty", True)
    con.commit()
    return {"ok": True}


@app.delete("/api/memories/{mid}")
def del_memory(mid: int, request: Request):
    con = con_for(request)
    con.execute("delete from memory where id=?", (mid,))
    db.set_meta(con, "dirty", True)
    db.audit(con, "delete memory", {"id": mid})
    con.commit()
    return {"ok": True}


# ---------------- time travel ----------------
@app.get("/api/snapshots/{sid}")
def snapshot(sid: int, request: Request):
    con = con_for(request)
    r = con.execute("select * from snapshot where id=?", (sid,)).fetchone()
    if not r:
        raise HTTPException(404)
    d = dict(r)
    d["data"] = json.loads(d["data"])
    return d


@app.get("/api/timetravel")
def timetravel(request: Request, at: str):
    """the universe as it looked at the end of a month, reconstructed from today's records."""
    con = con_for(request)
    selves = apply_ann(con, "self", db.derived(con, "self"))
    interests = db.derived(con, "interest")
    projects = db.derived(con, "project")
    eras = db.derived(con, "era")
    era = next((e for e in eras if e["start"] <= at <= e["end"]), None)
    return {"at": at, "kind": "reconstructed", "era": era,
            "selves": [{"name": s["name"], "key": s["key"]} for s in selves if (s["first_seen"] or "9") <= at],
            "interests": sorted([{"label": i["label"], "n": sum(v for m, v in i["monthly"].items() if m <= at),
                                  "recent": sum(v for m, v in i["monthly"].items() if m <= at and m >= at[:4] + "-01")}
                                 for i in interests if (i["first_seen"] or "9") <= at], key=lambda x: -x["recent"])[:12],
            "projects": [p["name"] for p in projects if (p["created"] or "9")[:7] <= at],
            "note": "reconstructed from records that exist now. sources connected later may fill in this month more than it was ever recorded at the time."}


# ---------------- search ----------------
@app.get("/api/search")
def search(request: Request, q: str):
    con = con_for(request)
    return do_search(con, q[:200])


# ---------------- studio ----------------
@app.get("/api/sources")
def sources(request: Request):
    con = con_for(request)
    sync.ensure_sources(con)
    rows = {r["id"]: dict(r) for r in con.execute("select * from source")}
    paths = {}
    for r in con.execute("select * from approved_path"):
        paths.setdefault(r["source_id"], []).append(r["path"])
    out = []
    for c in REGISTRY:
        r = rows.get(c.id, {})
        r["categories"] = json.loads(r.get("categories") or "[]")
        last = con.execute("select * from sync_job where source_id=? order by id desc limit 1", (c.id,)).fetchone()
        out.append({**c.info(), "state": r, "paths": paths.get(c.id, []), "last_job": dict(last) if last else None})
    return {"sources": out, "planned": [{"id": i, "name": n, "group": g, "notes": t} for i, n, g, t in PLANNED],
            "inbox": str(config.INBOX_DIR), "paused_all": db.get_meta(con, "paused_all", False),
            "stats": db.get_meta(con, "stats", {}), "universe": U(request)}


@app.post("/api/sources/discover")
def discover(request: Request):
    con = con_for(request)
    return {"found": sync.discover_all(con)}


def check_path(p: str) -> Path:
    path = Path(p).expanduser().resolve()
    home = Path.home().resolve()
    if path == home or home not in path.parents and path != home:
        raise HTTPException(400, f"{p} must be a folder inside your home folder, and not the whole home folder")
    if is_forbidden(path / "x") or any(x in path.parts for x in (".ssh", ".gnupg", "Keychains")) or \
            (path.is_relative_to(home / "Library") and not path.is_relative_to(home / "Library/Application Support/many-lives")):
        raise HTTPException(400, f"{p} is a system or secrets folder and is never read")
    if not path.exists():
        raise HTTPException(400, f"{p} does not exist")
    return path


@app.post("/api/sources/{sid}/approve")
def approve(sid: str, request: Request, body: dict = Body(default={})):
    if sid not in BY_ID:
        raise HTTPException(404)
    c = BY_ID[sid]
    con = con_for(request)
    paths = [str(check_path(p)) for p in body.get("paths", [])]
    if c.needs_paths and not paths and not con.execute("select 1 from approved_path where source_id=?", (sid,)).fetchone():
        raise HTTPException(400, "approve at least one folder")
    for p in paths:
        con.execute("insert or ignore into approved_path(source_id, path, approved_at) values (?,?,?)", (sid, p, db.now()))
    if "categories" in body:
        allowed = {x["id"] for x in c.categories}
        con.execute("update source set categories=? where id=?", (json.dumps([x for x in body["categories"] if x in allowed]), sid))
    con.execute("update source set enabled=1, paused=0, approved_at=coalesce(approved_at, ?), status='connected', next_sync=null where id=?", (db.now(), sid))
    db.audit(con, "approve source", {"source": sid, "paths": paths, "categories": body.get("categories")})
    con.commit()
    return {"ok": True}


@app.post("/api/sources/{sid}/unapprove-path")
def unapprove_path(sid: str, request: Request, body: dict = Body(...)):
    con = con_for(request)
    con.execute("delete from approved_path where source_id=? and path=?", (sid, body.get("path")))
    db.audit(con, "remove folder", {"source": sid, "path": body.get("path")})
    con.commit()
    return {"ok": True}


@app.post("/api/sources/{sid}/sync")
def sync_now(sid: str, request: Request):
    if sid not in BY_ID:
        raise HTTPException(404)
    con = con_for(request)
    row = con.execute("select enabled from source where id=?", (sid,)).fetchone()
    if not row or not row["enabled"]:
        raise HTTPException(400, "connect this source first")
    con.close()
    res = sync.run_sync(U(request), sid)
    sync.rebuild_if_dirty(U(request))
    return res


@app.post("/api/sources/{sid}/{action}")
def source_action(sid: str, action: str, request: Request):
    if sid not in BY_ID or action not in ("pause", "resume", "disconnect"):
        raise HTTPException(404)
    con = con_for(request)
    if action == "pause":
        con.execute("update source set paused=1 where id=?", (sid,))
    elif action == "resume":
        con.execute("update source set paused=0 where id=?", (sid,))
    else:
        con.execute("update source set enabled=0, paused=0, status='discovered', next_sync=null where id=?", (sid,))
        con.execute("delete from approved_path where source_id=?", (sid,))
        if sid == "spotify_api":
            db.set_meta(con, "spotify_token", None)
    db.audit(con, action, {"source": sid})
    con.commit()
    return {"ok": True}


@app.delete("/api/sources/{sid}/data")
def delete_data(sid: str, request: Request):
    """removes every imported record of a source, its file index and cursors, then rebuilds everything derived."""
    con = con_for(request)
    n = con.execute("delete from raw_record where source_id=?", (sid,)).rowcount
    con.execute("delete from file_index where source_id=?", (sid,))
    con.execute("delete from meta where k like ?", (f"cursor:{sid}:%",))
    sync.refresh_stats(con, sid)
    db.audit(con, "delete source data", {"source": sid, "records": n})
    con.commit()
    con.close()
    sync.rebuild_if_dirty(U(request), force=True)
    return {"deleted": n}


@app.get("/api/sources/{sid}/preview")
def preview(sid: str, request: Request, limit: int = 30):
    con = con_for(request)
    rs = db.rows(con, "select id, kind, ts, title, substr(body,1,300) body, sensitive, hidden from raw_record where source_id=? order by ts desc limit ?",
                 (sid, min(limit, 200)))
    kinds = db.rows(con, "select kind, count(*) n from raw_record where source_id=? group by kind", (sid,))
    return {"records": rs, "kinds": kinds}


@app.post("/api/discover-preview/{sid}")
def discover_preview(sid: str, request: Request):
    """what a source would see, before any approval. lists folders or counts only, reads no content."""
    c = BY_ID.get(sid)
    if not c:
        raise HTTPException(404)
    con = con_for(request)
    return c.discover(con)


@app.get("/api/jobs")
def jobs(request: Request):
    con = con_for(request)
    return {"jobs": db.rows(con, "select * from sync_job order by id desc limit 60")}


@app.post("/api/rebuild")
def rebuild(request: Request):
    sync.rebuild_if_dirty(U(request), force=True)
    con = con_for(request)
    return {"stats": db.get_meta(con, "stats")}


@app.post("/api/pause-all")
def pause_all(request: Request, body: dict = Body(...)):
    con = con_for(request)
    db.set_meta(con, "paused_all", bool(body.get("paused")))
    db.audit(con, "pause all", {"paused": bool(body.get("paused"))})
    con.commit()
    return {"ok": True}


@app.get("/api/audit")
def audit(request: Request):
    con = con_for(request)
    return {"audit": db.rows(con, "select * from audit order by id desc limit 200")}


@app.get("/api/backups")
def backups(request: Request):
    return {"backups": bk.list_backups(), "dir": str(config.BACKUP_DIR)}


@app.post("/api/backups")
def make_backup(request: Request):
    if U(request) == "demo":
        raise HTTPException(400, "the demo universe is not backed up")
    p = bk.backup("manual")
    return {"file": p.name}


@app.post("/api/backups/restore")
def restore_backup(request: Request, body: dict = Body(...)):
    if U(request) == "demo":
        raise HTTPException(400)
    before = bk.restore(str(body.get("name")))
    return {"ok": True, "safety_copy": before.name}


@app.get("/api/spotify/login")
def spotify_login(request: Request):
    con = con_for(request)
    if not config.SPOTIFY_CLIENT_ID:
        raise HTTPException(400, "set ML_SPOTIFY_CLIENT_ID first")
    url = SpotifyApi.auth_url(con)
    con.commit()
    return RedirectResponse(url)


@app.get("/api/spotify/callback")
def spotify_callback(request: Request, code: str = "", state: str = ""):
    con = db.connect("real")
    SpotifyApi.finish(con, code, state)
    con.execute("update source set enabled=1, status='connected', approved_at=? where id='spotify_api'", (db.now(),))
    db.audit(con, "spotify authorized")
    con.commit()
    return RedirectResponse("/#/studio")


@app.post("/api/demo/reset")
def demo_reset(request: Request):
    from .demo import seed
    return seed()


# ---------------- frontend ----------------
if config.STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = (config.STATIC_DIR / path).resolve()
        if path and f.is_file() and config.STATIC_DIR in f.parents:
            return FileResponse(f)
        return FileResponse(config.STATIC_DIR / "index.html")
