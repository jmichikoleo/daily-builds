# backend/app/pipeline.py: the personal intelligence engine.
# raw_record -> units -> interests (tf-idf + nmf) -> projects (entity resolution) -> eras (change points)
# -> selves (worldbuilder) -> artifacts + exhibitions (curator) -> edges + constellations (astronomer)
# -> discoveries (investigator) -> dossiers (archivist) -> chapters (biographer) -> questions (unknown room)
# Everything derived is rebuilt from evidence. Every claim carries record ids. Fiction is tagged "lore".
# Nothing here calls a network service. Owner tables (annotation, memory, chapter_text ...) are only read.
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

from . import config, db
from .text import normalize_name, tokens

VERSION = config.PROCESSING_VERSION
EXTRA_STOP = {"mochi", "mochis", Path.home().name.lower(), "users", "desktop", "src", "lib", "app",
              "apps", "project", "projects", "repo", "readme", "todo", "wip", "init", "initial", "version", "release",
              "verified", "verify", "live", "pushed", "push", "local", "step", "steps", "done", "plan", "approved",
              "pass", "passed", "copy", "scratch", "worktree", "feature", "features", "build", "builds", "npm", "node",
              "next", "vite", "react", "typescript", "python", "status", "doc", "accept", "accepted", "checks", "check",
              "report", "pasted", "content", "id", "png", "jpg", "pdf", "zip", "tab", "tabs", "card", "cards"}
TZ = ZoneInfo(config.LOCAL_TZ)

ARCHETYPES = {
    "scholar": dict(title="scholar", words={"research", "paper", "experiment", "benchmark", "patent", "model", "literature",
                    "review", "reviewer", "dataset", "evaluation", "nlp", "analysis", "survey", "venue", "conference", "embedding",
                    "retrieval", "rag", "arr", "emnlp", "acl", "classification", "claim", "claims", "bibtex", "latex"},
                    room="a lamplit study with towers of annotated papers and one very patient desk lamp",
                    palette=["#D8C9EE", "#40364D", "#FFFDF8"], motif="study"),
    "musician": dict(title="musician", words={"music", "song", "lyric", "audio", "melody", "hum", "instrument", "chord",
                     "beat", "drum", "tempo", "midi", "singer", "album", "artist", "track", "piano", "guitar"},
                     room="a small recording booth with egg crate walls and a keyboard missing one key",
                     palette=["#FFD1D3", "#40364D", "#FFE9AE"], motif="booth"),
    "gamemaker": dict(title="game maker", words={"game", "player", "score", "level", "party", "multiplayer", "wordle",
                      "microgame", "gacha", "quiz", "round", "puzzle", "boss"},
                      room="the back room of an arcade where half built cabinets glow in the dark",
                      palette=["#C8DDF2", "#40364D", "#FFD1D3"], motif="arcade"),
    "designer": dict(title="designer", words={"design", "visual", "color", "colour", "palette", "illustration", "font",
                     "layout", "typography", "brand", "identity", "mockup", "logo", "editorial", "pastel", "theme", "dark",
                     "animation", "css", "icon", "icons", "guideline"},
                     room="a sunny studio pinned floor to ceiling with swatches and cut paper",
                     palette=["#FFE9AE", "#40364D", "#FFD1D3"], motif="studio"),
    "builder": dict(title="builder", words={"server", "deploy", "database", "backup", "sqlite", "migration", "schema",
                    "service", "docker", "tunnel", "supervisor", "restore", "auth", "login", "storage", "drive", "cloud",
                    "git", "filesystem", "sync", "api", "endpoint", "cache", "performance"},
                    room="a basement workshop where small machines hum and every cable is labelled",
                    palette=["#C8DDF2", "#40364D", "#FFFDF8"], motif="workshop"),
    "learner": dict(title="learner", words={"study", "course", "exam", "lecture", "grade", "class", "semester", "university",
                    "student", "homework", "assignment", "flashcard", "quiz", "learning", "academic", "academia", "edu",
                    "curriculum", "syllabus", "scholarship"},
                    room="a classroom after hours, chalk dust still floating in the light",
                    palette=["#FFFDF8", "#40364D", "#C8DDF2"], motif="classroom"),
    "tinkerer": dict(title="machine whisperer", words={"ai", "agent", "llm", "prompt", "claude", "chatbot", "assistant",
                     "voice", "whisper", "openai", "codex", "automation", "telegram", "jarvis", "skill", "skills"},
                     room="a lab where small robots sit in a circle and argue politely",
                     palette=["#D8C9EE", "#40364D", "#C8DDF2"], motif="lab"),
    "maker": dict(title="small things maker", words={"recipe", "photo", "booth", "film", "stamp", "passport", "collage",
                  "sticker", "journal", "scrapbook", "gift", "baking", "brownie", "camera", "strip"},
                  room="a craft table covered in stamps, film strips and crumbs",
                  palette=["#FFD1D3", "#40364D", "#FFFDF8"], motif="craft"),
    "founder": dict(title="founder", words={"portfolio", "launch", "store", "users", "product", "pricing", "startup",
                    "customer", "marketing", "brand", "business", "ios", "submission", "shipping"},
                    room="a market stall at dawn, the sign half painted",
                    palette=["#FFE9AE", "#40364D", "#C8DDF2"], motif="stall"),
}
GIVEN = ["Mira", "Juno", "Odile", "Vera", "Sae", "Tula", "Wren", "Ilse", "Noor", "Bea", "Kiko", "Lumi", "Rhea", "Yuna",
         "Dara", "Sol", "Ines", "Mochi", "Fen", "Ama"]
LORE_TRAITS = {
    "scholar": ["keeps a separate notebook just for footnotes", "believes every table needs one more column",
                "has strong opinions about baselines", "reads the appendix first"],
    "musician": ["hums before speaking", "names playlists like diary entries", "keeps voice memos nobody hears"],
    "gamemaker": ["tests every game at two in the morning", "thinks any chore can become a microgame",
                  "keeps a jar of unused high scores"],
    "designer": ["moves things two pixels and feels better", "owns too many pinks and regrets none",
                 "argues with fonts"],
    "builder": ["labels the labels", "trusts a backup only after restoring it", "wakes up at the sound of a failing service"],
    "learner": ["collects syllabi like stamps", "makes flashcards for the flashcards"],
    "tinkerer": ["says please to every model", "keeps a drawer of half trained helpers"],
    "maker": ["turns any afternoon into a small object", "saves every receipt that looks pretty"],
    "founder": ["writes launch copy in the shower", "has a pitch for every tiny app"],
    "nocturnal": ["prefers the hours nobody schedules", "knows what the city sounds like at three"],
    "forgotten": ["keeps the keys to rooms nobody visits", "remembers projects that do not remember back"],
}


# ---------- helpers ----------
def parse_ts(s):
    if not s:
        return None
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        if d.year < 1995:
            return None
        return d
    except Exception:
        return None


def month_of(d):
    return d.astimezone(TZ).strftime("%Y-%m") if d else None


def months_between(a: str, b: str) -> list[str]:
    y, m = map(int, a.split("-"))
    out = []
    while f"{y:04d}-{m:02d}" <= b:
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def pick(seq, seed: str):
    return seq[h(seed) % len(seq)] if seq else None


def nice_month(m: str) -> str:
    if not m:
        return "an unknown month"
    d = datetime.strptime(m, "%Y-%m")
    return d.strftime("%B %Y").lower()


def listify(xs: list[str]) -> str:
    xs = [x for x in xs if x]
    if len(xs) <= 1:
        return "".join(xs)
    return ", ".join(xs[:-1]) + " and " + xs[-1]


SOURCE_GROUP = {"github": "code", "git_local": "code", "project_docs": "projects", "claude_code": "conversations",
                "chatgpt_export": "conversations", "claude_export": "conversations", "spotify_export": "music",
                "spotify_api": "music", "google_takeout": "google", "documents": "files", "zotero": "academic",
                "owner": "owner", "demo": "demo"}


# ---------- step 1: load and group into units ----------
def load(con):
    recs = []
    for r in con.execute("select id, source_id, ext_id, kind, ts, title, body, meta, sensitive from raw_record where hidden=0"):
        d = dict(r)
        d["meta"] = json.loads(d["meta"] or "{}")
        d["dt"] = parse_ts(d["ts"])
        recs.append(d)
    return recs


def build_units(recs):
    """commits group by repo and month, plays and watches by month, everything else stands alone."""
    groups = defaultdict(list)
    seen_sha = set()
    for r in recs:
        k = r["kind"]
        if k == "commit":
            sha = r["ext_id"].split(":")[-1]
            if sha in seen_sha:
                continue  # the same commit in a cloned repo
            seen_sha.add(sha)
        m = month_of(r["dt"]) or "undated"
        if k == "commit":
            groups[("commits", r["meta"].get("repo"), m)].append(r)
        elif k in ("listening", "top_artist", "play"):
            groups[("music", "", m)].append(r)
        elif k == "watching":
            groups[("video", "", m)].append(r)
        elif k in ("contributions", "release"):
            continue
        else:
            groups[("one", r["id"], m)].append(r)
    units = []
    for (g, sub, m), rs in groups.items():
        if g == "commits":
            text = " ".join(r["title"] for r in rs)
            title = f"{sub}, {nice_month(m)}"
        elif g == "music":
            text = "music " + " ".join(r["meta"].get("artist", "") + " " + (r["body"] or "") for r in rs)
            title = f"listening, {nice_month(m)}"
        elif g == "video":
            text = "video " + " ".join(r["title"] + " " + (r["body"] or "") for r in rs)
            title = f"watching, {nice_month(m)}"
        else:
            r = rs[0]
            text = f"{r['title']} {r['body'] or ''} " + " ".join(map(str, r["meta"].get("topics", [])))
            title = r["title"]
        dts = [r["dt"] for r in rs if r["dt"]]
        units.append({"i": len(units), "group": g, "sub": sub, "month": m if m != "undated" else None,
                      "title": title, "text": text, "rids": [r["id"] for r in rs],
                      "sources": sorted({r["source_id"] for r in rs}), "kinds": sorted({r["kind"] for r in rs}),
                      "start": min(dts) if dts else None, "end": max(dts) if dts else None,
                      "repo": sub if g == "commits" else rs[0]["meta"].get("repo") or rs[0]["meta"].get("project")})
    return units


# ---------- step 2: interests ----------
def discover_interests(units, banned: set[str]):
    stop = EXTRA_STOP | banned

    def analyzer(t):
        return [w for w in tokens(t) if w not in stop and len(w) > 1]

    docs = [u["text"] for u in units]
    if len(units) < 6:
        return [], np.zeros((len(units), 0))
    from sklearn.decomposition import NMF
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(analyzer=analyzer, min_df=2, max_df=0.4, max_features=6000, sublinear_tf=True)
    try:
        X = vec.fit_transform(docs)
    except ValueError:
        return [], np.zeros((len(units), 0))
    vocab = np.array(vec.get_feature_names_out())
    k = int(max(4, min(18, round(math.sqrt(len(units) / 3)))))
    k = min(k, X.shape[1] - 1, X.shape[0] - 1)
    if k < 2:
        return [], np.zeros((len(units), 0))
    nmf = NMF(n_components=k, random_state=7, init="nndsvda", max_iter=400)
    W = nmf.fit_transform(X)
    H = nmf.components_
    topics = []
    for t in range(k):
        top = vocab[np.argsort(-H[t])[:8]].tolist()
        topics.append(top)
    return topics, W


def interest_objects(units, topics, W, now_month):
    interests = []
    if W.shape[1] == 0:
        return interests, {}
    rowmax = W.max(axis=1, keepdims=True) + 1e-9
    member = (W >= 0.35 * rowmax) & (W > 0.02)
    unit_topics = defaultdict(list)
    for t, terms in enumerate(topics):
        us = [u for u in units if member[u["i"], t]]
        if len(us) < 2:
            continue
        key = "-".join(sorted(terms[:2]))
        monthly = Counter(u["month"] for u in us if u["month"])
        months = sorted(monthly)
        rids = [rid for u in sorted(us, key=lambda u: -W[u["i"], t]) for rid in u["rids"][:3]]
        srcs = Counter(s for u in us for s in u["sources"])
        recent = sum(v for m, v in monthly.items() if m >= shift_month(now_month, -2)) / 3
        earlier = [v for m, v in monthly.items() if m < shift_month(now_month, -2)]
        avg = sum(earlier) / len(earlier) if earlier else 0
        last = months[-1] if months else None
        if last and last < shift_month(now_month, -4):
            status = "dormant"
        elif not earlier or recent > 1.5 * avg:
            status = "emerging"
        elif recent < 0.5 * avg:
            status = "declining"
        else:
            status = "steady"
        obj = {"key": key, "label": f"{terms[0]} & {terms[1]}", "terms": terms, "weight": round(float(W[:, t].sum()), 3),
               "units": len(us), "records": len({r for u in us for r in u["rids"]}), "first_seen": months[0] if months else None,
               "last_seen": last, "monthly": dict(sorted(monthly.items())), "sources": dict(srcs), "status": status,
               "evidence": rids[:60], "_t": t, "_units": {u["i"] for u in us}}
        if any(i["key"] == key for i in interests):
            continue
        interests.append(obj)
        for u in us:
            unit_topics[u["i"]].append(key)
    return interests, unit_topics


def shift_month(m: str, n: int) -> str:
    y, mm = map(int, m.split("-"))
    mm += n
    while mm < 1:
        y, mm = y - 1, mm + 12
    while mm > 12:
        y, mm = y + 1, mm - 12
    return f"{y:04d}-{mm:02d}"


def archetype_of(terms: list[str]) -> tuple[str | None, int]:
    best, score = None, 0
    for k, a in ARCHETYPES.items():
        s = sum((3 if i < 3 else 1) for i, t in enumerate(terms) if t in a["words"])
        if s > score:
            best, score = k, s
    return best, score


# ---------- step 3: projects ----------
LIVE_WORDS = re.compile(r"(?i)\b(is live|went live|now live|deployed|shipped|released|in production|on the app store|live at)\b")


def build_projects(recs, units, unit_topics, now):
    P = {}
    root_of = {}
    for r in sorted([r for r in recs if r["kind"] == "repo"], key=lambda r: r["ts"] or ""):
        root = r["meta"].get("root")
        if root:
            root_of.setdefault(root, normalize_name(r["meta"].get("repo", "")))
    alias = {}
    for r in recs:
        if r["kind"] == "repo" and r["meta"].get("root"):
            alias[normalize_name(r["meta"].get("repo", ""))] = root_of[r["meta"]["root"]]

    def get(name):
        k = normalize_name(name)
        k = alias.get(k, k)
        if not k:
            return None
        if k not in P:
            P[k] = {"key": k, "name": name, "description": "", "created": None, "last_activity": None, "commits": 0,
                    "languages": [], "url": None, "homepage": None, "private": None, "tags": [], "sources": set(),
                    "evidence": [], "docs": [], "sessions": 0, "live_doc": False, "paths": set(), "aliases": set()}
        P[k]["aliases"].add(name)
        return P[k]

    for r in recs:
        m = r["meta"]
        name = m.get("repo")
        if r["kind"] == "session":
            name = m.get("project")
        if not name:
            continue
        p = get(name)
        if not p:
            continue
        p["sources"].add(r["source_id"])
        if r["kind"] == "repo":
            p["commits"] = max(p["commits"], m.get("commits", 0))
            p["tags"] = m.get("tags", [])
            p["paths"].add(m.get("path"))
            if m.get("remote"):
                p["url"] = p["url"] or m["remote"]
            lc = parse_ts(m.get("last_commit"))
            if lc and (not p["last_activity"] or lc > p["last_activity"]):
                p["last_activity"] = lc
        elif r["kind"] == "gh_repo":
            p["description"] = r["body"] or p["description"]
            p["languages"] = m.get("languages") or p["languages"]
            p["url"] = m.get("url") or p["url"]
            p["homepage"] = m.get("homepage") or p["homepage"]
            p["private"] = m.get("private")
            p["name"] = r["title"] if not p["paths"] else p["name"]
            pushed = parse_ts(m.get("pushed"))
            if pushed and (not p["last_activity"] or pushed > p["last_activity"]):
                p["last_activity"] = pushed
        elif r["kind"] == "doc":
            p["docs"].append(r["id"])
            if LIVE_WORDS.search(r["body"] or ""):
                p["live_doc"] = True
            if not p["description"] and "readme" in r["title"].lower():
                para = [x.strip() for x in re.split(r"\n\s*\n", r["body"] or "") if x.strip() and not x.strip().startswith(("#", "!", "[", "<", "```", "|", "-"))]
                if para:
                    p["description"] = re.sub(r"\s+", " ", para[0])[:400]
        elif r["kind"] == "session":
            p["sessions"] += 1
        elif r["kind"] == "commit":
            if r["dt"] and (not p["last_activity"] or r["dt"] > p["last_activity"]):
                p["last_activity"] = r["dt"]
        if r["dt"] and (not p["created"] or r["dt"] < p["created"]) and r["kind"] in ("commit", "repo", "gh_repo"):
            p["created"] = r["dt"]
        if len(p["evidence"]) < 40 and r["kind"] in ("repo", "gh_repo", "doc", "release"):
            p["evidence"].append(r["id"])
    # sessions run in the home folder or the workspace root are not projects
    for junk in [k for k, p in P.items() if not p["created"] and p["sessions"] and not p["docs"]]:
        del P[junk]
    for p in P.values():
        it = Counter()
        for u in units:
            if u["repo"] and normalize_name(u["repo"]) == p["key"]:
                for t in unit_topics.get(u["i"], []):
                    it[t] += len(u["rids"])
        p["interests"] = [k for k, _ in it.most_common(4)]
        days = (now - p["last_activity"]).days if p["last_activity"] else 9999
        shipped = bool(p["tags"]) or p["live_doc"] or bool(p["homepage"])
        p["shipped"] = shipped
        p["status"] = "active" if days <= 30 else "resting" if days <= 120 else "dormant"
        if p["status"] == "dormant" and not shipped:
            p["status"] = "abandoned"
        p["days_quiet"] = days
        p["sources"] = sorted(p["sources"])
        p["paths"] = sorted(x for x in p["paths"] if x)
        p["aliases"] = sorted(p["aliases"])
        p["created"] = p["created"].isoformat() if p["created"] else None
        p["last_activity"] = p["last_activity"].isoformat() if p["last_activity"] else None
    return [p for p in P.values() if p["created"]]


# ---------- step 4: eras and gaps ----------
def build_eras(units, interests):
    months = sorted({u["month"] for u in units if u["month"]})
    if not months:
        return [], []
    allm = months_between(months[0], months[-1])
    idx = {k["key"]: i for i, k in enumerate(interests)}
    vec = {m: np.zeros(max(1, len(interests))) for m in allm}
    count = Counter()
    for u in units:
        if not u["month"]:
            continue
        count[u["month"]] += len(u["rids"])
        for it in interests:
            if u["i"] in it["_units"]:
                vec[u["month"]][idx[it["key"]]] += 1
    gaps, run = [], []
    for m in allm:
        if count[m] == 0:
            run.append(m)
        else:
            if len(run) >= 2:
                gaps.append({"start": run[0], "end": run[-1], "months": len(run)})
            run = []
    eras, cur = [], None

    def cos(a, b):
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        return float(a @ b / (na * nb)) if na and nb else 0.0

    for m in allm:
        if count[m] == 0:
            if cur and cur["empty"] >= 2:
                eras.append(cur)
                cur = None
            elif cur:
                cur["empty"] += 1
            continue
        if cur and (cos(vec[m], cur["vec"]) < 0.3 and len(cur["months"]) >= 2):
            eras.append(cur)
            cur = None
        if not cur:
            cur = {"months": [], "vec": np.zeros_like(vec[m]), "empty": 0, "n": 0}
        cur["months"].append(m)
        cur["vec"] = cur["vec"] + vec[m]
        cur["n"] += count[m]
        cur["empty"] = 0
    if cur:
        eras.append(cur)
    # tiny eras fold into the previous one
    merged = []
    for e in eras:
        if merged and (len(e["months"]) == 1 and e["n"] < 15):
            merged[-1]["months"] += e["months"]
            merged[-1]["vec"] = merged[-1]["vec"] + e["vec"]
            merged[-1]["n"] += e["n"]
        else:
            merged.append(e)
    out = []
    for i, e in enumerate(merged):
        top = [interests[j] for j in np.argsort(-e["vec"])[:3] if e["vec"][j] > 0] if interests else []
        repos = Counter()
        for u in units:
            if u["month"] in e["months"] and u["repo"]:
                repos[u["repo"]] += len(u["rids"])
        if top:
            a = top[0]["terms"][0]
            b = top[1]["terms"][0] if len(top) > 1 else None
        else:
            names = [k for k, _ in repos.most_common(2)]
            a = names[0] if names else "first light"
            b = names[1] if len(names) > 1 else None
        start, end = e["months"][0], e["months"][-1]
        title = pick([f"the {a} era", f"a season of {a}", f"the {a} and {b} months" if b else f"the {a} months",
                      f"when everything was {a}"], start + a)
        out.append({"key": f"era-{start}", "title": title, "start": start, "end": end, "records": e["n"],
                    "months": len(months_between(start, end)), "dominant": [t["key"] for t in top],
                    "dominant_labels": [t["label"] for t in top], "index": i + 1,
                    "top_projects": [k for k, _ in repos.most_common(5)]})
    return out, gaps


# ---------- step 5: selves ----------
def build_selves(interests, projects, recs, units, now_month):
    groups = defaultdict(list)
    for it in interests:
        a, s = archetype_of(it["terms"])
        it["archetype"] = a if s >= 2 else None
        if it["archetype"]:
            groups[a].append(it)
    # interests with no archetype form a self of their own only when they are substantial
    for it in interests:
        if not it["archetype"] and it["records"] >= 25:
            groups[f"curious-{it['terms'][0]}"].append(it)
            it["archetype"] = f"curious-{it['terms'][0]}"
    selves = []
    for key, its in groups.items():
        base = ARCHETYPES.get(key)
        ikeys = [i["key"] for i in its]
        projs = sorted([p for p in projects if set(p["interests"]) & set(ikeys)], key=lambda p: -p["commits"])
        monthly = Counter()
        for i in its:
            for m, v in i["monthly"].items():
                monthly[m] += v
        months = sorted(monthly)
        ev = [r for i in its for r in i["evidence"][:8]]
        title = base["title"] if base else f"{key.split('-', 1)[1]} enthusiast"
        selves.append(_self_obj(key, title, base, its, projs, monthly, ev, now_month))
    # the nocturnal self, from timestamps only
    hours = [r["dt"].astimezone(TZ).hour for r in recs if r["dt"] and r["kind"] in ("commit", "session", "conversation")]
    if hours:
        night = [x for x in hours if x < 5]
        share = len(night) / len(hours)
        if share >= 0.12 and len(night) >= 20:
            ev = [r["id"] for r in recs if r["dt"] and r["kind"] in ("commit", "session") and r["dt"].astimezone(TZ).hour < 5][:40]
            monthly = Counter(month_of(r["dt"]) for r in recs if r["id"] in set(ev))
            s = _self_obj("nocturnal", "night owl", None, [], [], monthly, ev, now_month)
            s["facts"].append({"kind": "stat", "text": f"{round(share * 100)}% of timestamped commits and sessions happen between midnight and 5 am local time ({len(night)} of {len(hours)})."})
            s["room"] = "a rooftop at three in the morning, one window still lit below"
            s["palette"] = ["#40364D", "#FFE9AE", "#C8DDF2"]
            s["motif"] = "rooftop"
            selves.append(s)
    forgotten = [p for p in projects if p["status"] == "abandoned"]
    if len(forgotten) >= 2:
        ev = [e for p in forgotten for e in p["evidence"][:3]]
        monthly = Counter(p["last_activity"][:7] for p in forgotten if p["last_activity"])
        s = _self_obj("forgotten", "keeper of unfinished things", None, [], forgotten, monthly, ev, now_month)
        s["room"] = "an attic of dust sheets, each one shaped like a project"
        s["palette"] = ["#D8C9EE", "#40364D", "#FFE9AE"]
        s["motif"] = "attic"
        s["status"] = "historical"
        selves.append(s)
    # every self gets its own given name
    used = set()
    for s in sorted(selves, key=lambda s: s["key"]):
        g = s["given"]
        i = GIVEN.index(g) if g in GIVEN else 0
        while g in used:
            i = (i + 7) % len(GIVEN)
            g = GIVEN[i]
        used.add(g)
        if g != s["given"]:
            s["lore"] = [{**l, "text": l["text"].replace(s["given"], g, 1)} for l in s["lore"]]
            s["given"], s["name"] = g, f"{g} the {s['title']}"
    # crossovers: selves that share a project
    for a in selves:
        a["connections"] = []
        for b in selves:
            if a is b:
                continue
            shared = sorted(set(a["projects"]) & set(b["projects"]))
            if len(shared) >= 2:
                a["connections"].append({"self": b["key"], "shared_projects": shared[:6], "why": f"both live in {listify(shared[:3])}"})
    return selves


def _self_obj(key, title, base, its, projs, monthly, ev, now_month):
    months = sorted(m for m in monthly if m)
    given = pick(GIVEN, key)
    last = months[-1] if months else None
    status = "historical" if last and last < shift_month(now_month, -4) else "active"
    lore_pool = LORE_TRAITS.get(key.split("-")[0], ["collects small evidence of large curiosities"])
    traits = [lore_pool[(h(key) + i) % len(lore_pool)] for i in range(min(2, len(lore_pool)))]
    first = nice_month(months[0]) if months else "an unknown month"
    facts = []
    if months:
        facts.append({"kind": "fact", "text": f"first appears in the records in {first} and was last seen in {nice_month(last)}."})
    if its:
        facts.append({"kind": "fact", "text": f"recurring interests: {listify([i['label'] for i in its[:5]])}."})
    if projs:
        facts.append({"kind": "fact", "text": f"lives mostly in {listify([p['name'] for p in projs[:4]])}."})
    lore = [
        {"kind": "lore", "text": f"{given} the {title} {pick(['was born', 'woke up', 'first unpacked a suitcase', 'moved in'], key)} somewhere around {first}."},
        {"kind": "lore", "text": f"they {traits[0]}{' and ' + traits[1] if len(traits) > 1 else ''}."},
    ]
    if status == "historical":
        lore.append({"kind": "lore", "text": f"the room has been quiet since {nice_month(last)}. the kettle is still warm, probably."})
    return {"key": key, "name": f"{given} the {title}", "title": title, "given": given,
            "room": base["room"] if base else f"a cluttered reading nook full of things about {title.split()[0]}",
            "palette": base["palette"] if base else ["#C8DDF2", "#40364D", "#FFD1D3"],
            "motif": base["motif"] if base else "nook",
            "interests": [i["key"] for i in its], "interest_labels": [i["label"] for i in its],
            "projects": [p["key"] for p in projs[:12]], "project_names": [p["name"] for p in projs[:12]],
            "timeline": dict(sorted(monthly.items())), "first_seen": months[0] if months else None, "last_seen": last,
            "status": status, "facts": facts, "lore": lore, "traits_lore": traits,
            "favorite_activities": [f"working on {p['name']}" for p in projs[:3]],
            "evidence": list(dict.fromkeys(ev))[:40]}


# ---------- step 6: artifacts and exhibitions ----------
def accession(con, key, year):
    r = con.execute("select number from accession where key=?", (key,)).fetchone()
    if r:
        return r["number"]
    y = year or "0000"
    n = con.execute("select count(*) c from accession where number like ?", (f"ML-{y}-%",)).fetchone()["c"] + 1
    num = f"ML-{y}-{n:03d}"
    con.execute("insert into accession(key, number) values (?,?)", (key, num))
    return num


def era_for(eras, month):
    for e in eras:
        if month and e["start"] <= month <= e["end"]:
            return e["key"]
    return None


def build_artifacts(con, projects, recs, selves, eras, interests):
    arts = []
    self_by_project = defaultdict(list)
    for s in selves:
        for p in s["projects"]:
            self_by_project[p].append(s["key"])
    by_created = sorted(projects, key=lambda p: p["created"] or "9")
    first_key = by_created[0]["key"] if by_created else None
    ilabel = {i["key"]: i["label"] for i in interests}
    for p in projects:
        month = (p["created"] or "")[:7]
        lang = (p["languages"] or [None])[0]
        desc = []
        if p["commits"]:
            desc.append(f"{p['commits']} commits between {nice_month(month)} and {nice_month((p['last_activity'] or '')[:7])}.")
        if lang:
            desc.append(f"written mostly in {lang}.")
        if p["sessions"]:
            desc.append(f"discussed in {p['sessions']} claude code sessions.")
        desc.append({"active": "still being worked on.", "resting": "resting for now.", "dormant": "quiet, but it did ship.",
                     "abandoned": f"untouched for {p['days_quiet']} days."}[p["status"]])
        kind = "first" if p["key"] == first_key else "project"
        arts.append({"key": f"project-{p['key']}", "title": p["name"], "kind": kind, "object": "floppy" if kind != "first" else "seed",
                     "category": "things i made", "date": p["created"], "period": month,
                     "description": " ".join(desc),
                     "context": p["description"] or "no description was written for it.",
                     "provenance": p["sources"], "evidence": p["evidence"][:20], "project": p["key"],
                     "selves": self_by_project.get(p["key"], []), "era": era_for(eras, month),
                     "interests": p["interests"], "interest_labels": [ilabel.get(i, i) for i in p["interests"]],
                     "status": p["status"], "commits": p["commits"], "url": p["homepage"] or (p["url"] if not p["private"] else None)})
    # releases: the first tag of each project is a milestone
    seen = set()
    for r in sorted([r for r in recs if r["kind"] == "release" and r["dt"]], key=lambda r: r["dt"]):
        repo = normalize_name(r["meta"].get("repo", ""))
        if repo in seen:
            continue
        seen.add(repo)
        month = month_of(r["dt"])
        arts.append({"key": f"release-{r['ext_id']}", "title": f"first release of {r['meta'].get('repo')}", "kind": "milestone",
                     "object": "ribbon", "category": "milestones", "date": r["dt"].isoformat(), "period": month,
                     "description": f"tagged {r['meta'].get('tag')} on {r['dt'].astimezone(TZ).strftime('%d %B %Y').lower()}.",
                     "context": "a git tag is a small public promise that something is finished enough.",
                     "provenance": [r["source_id"]], "evidence": [r["id"]], "project": repo,
                     "selves": self_by_project.get(repo, []), "era": era_for(eras, month), "interests": []})
    # personal writing and records
    objmap = {"lyric": ("cassette", "words i kept"), "journal": ("diary", "words i kept"), "idea": ("lightbulb", "ideas"),
              "wishlist": ("ticket", "the art of wanting"), "recipe": ("jar", "small comforts"), "research": ("scroll", "academic"),
              "paper": ("scroll", "academic"), "note": ("note", "words i kept"), "photo": ("photo", "photographs"),
              "event": ("ticket", "places and dates")}
    picked = Counter()
    for r in sorted([r for r in recs if r["kind"] in objmap], key=lambda r: -(len(r["body"] or ""))):
        if r["sensitive"]:
            continue
        if picked[r["kind"]] >= (40 if r["kind"] in ("lyric", "journal", "research", "paper", "wishlist", "idea") else 12):
            continue
        picked[r["kind"]] += 1
        obj, cat = objmap[r["kind"]]
        month = month_of(r["dt"])
        excerpt = re.sub(r"\s+", " ", (r["body"] or ""))[:260]
        arts.append({"key": f"rec-{r['id']}", "title": r["title"], "kind": r["kind"], "object": obj, "category": cat,
                     "date": r["dt"].isoformat() if r["dt"] else None, "period": month,
                     "description": excerpt or "a record with no text, kept for its date.",
                     "context": f"found in {r['meta'].get('folder') or r['source_id']}.", "provenance": [r["source_id"]],
                     "evidence": [r["id"]], "selves": [], "era": era_for(eras, month), "interests": []})
    # the longest conversations
    convs = sorted([r for r in recs if r["kind"] in ("session", "conversation")], key=lambda r: -(r["meta"].get("prompts") or 0))[:14]
    for r in convs:
        month = month_of(r["dt"])
        arts.append({"key": f"conv-{r['ext_id']}", "title": r["title"][:90], "kind": "conversation", "object": "letter",
                     "category": "conversations with machines", "date": r["dt"].isoformat() if r["dt"] else None,
                     "period": month, "description": f"{r['meta'].get('prompts')} messages from you in one {r['meta'].get('tool', 'chat')} conversation.",
                     "context": f"project folder {r['meta'].get('project')}." if r["meta"].get("project") else "",
                     "provenance": [r["source_id"]], "evidence": [r["id"]], "selves": [], "era": era_for(eras, month),
                     "interests": [], "project": normalize_name(r["meta"].get("project") or "")})
    # music: the most played artist of each era
    music = [r for r in recs if r["kind"] == "listening"]
    for e in eras:
        mins = Counter()
        ids = defaultdict(list)
        for r in music:
            if e["start"] <= r["meta"].get("month", "") <= e["end"]:
                mins[r["meta"]["artist"]] += r["meta"].get("minutes", 0)
                ids[r["meta"]["artist"]].append(r["id"])
        if mins:
            artist, m = mins.most_common(1)[0]
            arts.append({"key": f"song-{e['key']}", "title": f"{artist}, the sound of {e['title']}", "kind": "music",
                         "object": "vinyl", "category": "the songs that raised me", "date": f"{e['start']}-01", "period": e["start"],
                         "description": f"{m} minutes of listening between {nice_month(e['start'])} and {nice_month(e['end'])}, more than any other artist in that stretch.",
                         "context": "from spotify streaming history. plays under 30 seconds were not counted.",
                         "provenance": ["spotify_export"], "evidence": ids[artist][:20], "selves": ["musician"], "era": e["key"], "interests": []})
    # self links back into artifacts
    for s in selves:
        for a in arts:
            if set(a.get("interests", [])) & set(s["interests"]) and s["key"] not in a["selves"]:
                a["selves"].append(s["key"])
    for a in arts:
        year = (a.get("period") or "0000")[:4]
        a["accession"] = accession(con, a["key"], year)
    # related artifacts: share an interest or a project
    for a in arts:
        rel = [b["key"] for b in arts if b is not a and ((set(a.get("interests", [])) & set(b.get("interests", [])))
               or (a.get("project") and a.get("project") == b.get("project")))]
        a["related"] = rel[:8]
    return arts


def build_exhibitions(arts, projects):
    by = defaultdict(list)
    for a in arts:
        by[a["category"]].append(a)
    pk = {p["key"]: p for p in projects}
    ex = []

    def add(key, title, intro, items):
        items = [a for a in items if a]
        if len(items) >= 2:
            ex.append({"key": key, "title": title, "intro": intro, "artifacts": [a["key"] for a in items], "auto": True})

    made = [a for a in arts if a["kind"] in ("project", "first") and a.get("status") in ("active", "resting", "dormant")]
    add("things-i-made", "the things i made", "every project that is alive, resting, or shipped and allowed to rest.",
        sorted(made, key=lambda a: a["date"] or ""))
    add("graveyard", "the graveyard of abandoned projects", "projects that stopped without a release or a goodbye. no judgement in this room.",
        [a for a in arts if a.get("status") == "abandoned"])
    add("where-the-hours-went", "where the hours went", "the projects with the most commits, measured in commits not hours. hours were never recorded.",
        sorted([a for a in arts if a.get("commits")], key=lambda a: -a["commits"])[:10])
    add("milestones", "small public promises", "first releases, tagged and dated.", by["milestones"])
    add("academic", "my academic evolution", "research documents, papers and the projects built around them.",
        sorted(by["academic"] + [a for a in arts if "scholar" in a.get("selves", []) and a["kind"] == "project"], key=lambda a: a["date"] or ""))
    add("songs", "the songs that raised me", "one artist per era, chosen by minutes listened.", by["the songs that raised me"])
    add("words", "words i kept", "notes, lyrics and journal pages from the folders you opened.", by["words i kept"][:30])
    add("wanting", "the art of wanting", "wishlists and things you once wanted.", by["the art of wanting"])
    add("conversations", "conversations with machines", "the longest conversations, counted by your own messages.", by["conversations with machines"])
    add("photographs", "photographs", "names and dates only. the pixels stay where they are.", by["photographs"])
    old = sorted([a for a in arts if a["kind"] in ("project",) and a.get("status") in ("dormant", "abandoned")],
                 key=lambda a: pk.get(a.get("project"), {}).get("last_activity") or "")[:8]
    add("almost-forgot", "things i almost forgot", "the projects that have been quiet the longest.", old)
    return ex


# ---------- step 7: graph ----------
def build_graph(interests, projects, selves, eras):
    edges = []
    for i, a in enumerate(interests):
        for b in interests[i + 1:]:
            inter = a["_units"] & b["_units"]
            if not inter:
                continue
            j = len(inter) / len(a["_units"] | b["_units"])
            if j >= 0.06:
                edges.append({"a": f"interest:{a['key']}", "b": f"interest:{b['key']}", "kind": "co-occurs", "weight": round(j, 3),
                              "why": f"{a['label']} and {b['label']} show up in the same {len(inter)} records or record groups."})
    for p in projects:
        for rank, ik in enumerate(p["interests"]):
            edges.append({"a": f"project:{p['key']}", "b": f"interest:{ik}", "kind": "about", "weight": round(1 / (rank + 1), 3),
                          "why": f"{'the main' if rank == 0 else 'a recurring'} theme in {p['name']}'s commits, docs and sessions."})
    for i, a in enumerate(projects):
        for b in projects[i + 1:]:
            sh = set(a["interests"][:3]) & set(b["interests"][:3])
            if len(sh) >= 2:
                edges.append({"a": f"project:{a['key']}", "b": f"project:{b['key']}", "kind": "siblings", "weight": 0.5,
                              "why": f"both are mostly about the same {len(sh)} interests."})
    for s in selves:
        for ik in s["interests"]:
            edges.append({"a": f"self:{s['key']}", "b": f"interest:{ik}", "kind": "loves", "weight": 0.7,
                          "why": f"{s['name']} was built from this interest."})
    for e in eras:
        for ik in e["dominant"]:
            edges.append({"a": f"era:{e['key']}", "b": f"interest:{ik}", "kind": "dominated-by", "weight": 0.6,
                          "why": f"one of the most frequent interests between {e['start']} and {e['end']}."})
    # constellations: connected groups of interests
    parent = {i["key"]: i["key"] for i in interests}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for e in edges:
        if e["kind"] == "co-occurs" and e["weight"] >= 0.1:
            parent[find(e["a"][9:])] = find(e["b"][9:])
    comps = defaultdict(list)
    for i in interests:
        comps[find(i["key"])].append(i)
    cons = []
    for root, its in comps.items():
        if len(its) < 2:
            continue
        its.sort(key=lambda x: -x["records"])
        cons.append({"key": f"con-{its[0]['key']}", "title": f"the {its[0]['terms'][0]} constellation",
                     "interests": [i["key"] for i in its], "labels": [i["label"] for i in its]})
    return edges, cons


# ---------- step 8: discoveries ----------
def conf(n, nsrc):
    score = min(0.95, 0.3 + 0.05 * n + 0.15 * (nsrc - 1))
    return {"score": round(score, 2), "label": "high" if score >= 0.7 else "medium" if score >= 0.45 else "low"}


def build_discoveries(recs, interests, projects, selves, eras, units):
    out = []
    convs = [r for r in recs if r["kind"] in ("session", "conversation") and r["dt"]]
    # 1. talked about it before building it
    for p in projects:
        if not p["created"] or len(p["key"]) < 4:
            continue
        created = parse_ts(p["created"])
        names = {re.escape(a.lower()) for a in p["aliases"] if len(a) >= 4}
        if not names:
            continue
        pat = re.compile(r"\b(" + "|".join(names) + r")\b")
        early = [r for r in convs if r["dt"] < created and (r["dt"] - created).days <= -1 and pat.search(((r["title"] or "") + " " + (r["body"] or "")).lower())]
        if early:
            first = min(early, key=lambda r: r["dt"])
            days = (created - first["dt"]).days
            out.append({"key": f"talked-first-{p['key']}", "kind": "crossover", "title": f"{p['name']} was a conversation before it was code",
                        "explanation": f"the name {p['name']} shows up in {len(early)} conversation{'s' if len(early) > 1 else ''} before the first commit. the earliest is {days} days before. this shows order in time, not that the talk caused the project.",
                        "evidence": [r["id"] for r in early[:12]] + p["evidence"][:3], "start": month_of(first["dt"]), "end": p["created"][:7],
                        "entities": [f"project:{p['key']}"], "sources": sorted({r["source_id"] for r in early} | set(p["sources"])),
                        "confidence": conf(len(early), 2), "links": [{"place": "museum", "key": f"project-{p['key']}"}]})
    # 2. one interest, many kinds of evidence
    for it in interests:
        groups = {SOURCE_GROUP.get(s, s) for s in it["sources"]}
        if len(groups) >= 3:
            out.append({"key": f"cross-{it['key']}", "kind": "cross-source", "title": f"{it['label']} lives in {len(groups)} corners of your life",
                        "explanation": f"evidence for this interest comes from {listify(sorted(groups))}. an interest that crosses this many kinds of records is rarely an accident of one tool.",
                        "evidence": it["evidence"][:15], "start": it["first_seen"], "end": it["last_seen"],
                        "entities": [f"interest:{it['key']}"], "sources": sorted(it["sources"]),
                        "confidence": conf(it["records"], len(groups)), "links": [{"place": "observatory", "key": f"interest:{it['key']}"}]})
    # 3. ideas that came back
    for it in interests:
        ms = sorted(it["monthly"])
        for a, b in zip(ms, ms[1:]):
            gap = len(months_between(a, b)) - 2
            if gap >= 2:
                out.append({"key": f"return-{it['key']}-{b}", "kind": "return", "title": f"{it['terms'][0]} came back after {gap} quiet months",
                            "explanation": f"nothing about {it['label']} between {nice_month(a)} and {nice_month(b)}, then it returns. the records cannot say why. maybe you can.",
                            "evidence": it["evidence"][:10], "start": a, "end": b, "entities": [f"interest:{it['key']}"],
                            "sources": sorted(it["sources"]), "confidence": conf(it["monthly"][b], 1),
                            "links": [{"place": "unknown", "key": f"q-return-{it['key']}-{b}"}]})
                break
    # 4. forgotten projects
    for p in projects:
        if p["status"] == "abandoned" and p["commits"] >= 10:
            out.append({"key": f"forgotten-{p['key']}", "kind": "forgotten", "title": f"{p['name']} is still waiting",
                        "explanation": f"{p['commits']} commits, then nothing for {p['days_quiet']} days. no release tag and no note saying it went live.",
                        "evidence": p["evidence"][:8], "start": (p["created"] or "")[:7], "end": (p["last_activity"] or "")[:7],
                        "entities": [f"project:{p['key']}"], "sources": p["sources"], "confidence": conf(p["commits"] // 5, len(p["sources"])),
                        "links": [{"place": "museum", "key": f"project-{p['key']}"}]})
    # 5. the busiest month
    per = Counter()
    for u in units:
        if u["month"]:
            per[u["month"]] += len(u["rids"])
    if len(per) >= 6:
        vals = np.array(list(per.values()))
        mu, sd = vals.mean(), vals.std()
        for m, v in per.most_common(2):
            if v > mu + 2 * sd:
                ids = [rid for u in units if u["month"] == m for rid in u["rids"][:2]][:20]
                out.append({"key": f"burst-{m}", "kind": "burst", "title": f"{nice_month(m)} did not sleep",
                            "explanation": f"{v} records in one month, against a usual {round(mu)}. that is {round(v / max(mu, 1), 1)} times the average month.",
                            "evidence": ids, "start": m, "end": m, "entities": [], "sources": sorted({s for u in units if u["month"] == m for s in u["sources"]}),
                            "confidence": {"score": 0.95, "label": "high"}, "links": [{"place": "library", "key": era_for(eras, m)}]})
    # 6. two selves in one project
    seen = set()
    for s in selves:
        for c in s.get("connections", []):
            pair = tuple(sorted([s["key"], c["self"]]))
            if pair in seen:
                continue
            seen.add(pair)
            other = next(x for x in selves if x["key"] == c["self"])
            out.append({"key": f"meet-{pair[0]}-{pair[1]}", "kind": "crossover", "title": f"where {s['name'].split(' the ')[0]} met {other['name'].split(' the ')[0]}",
                        "explanation": f"{s['name']} and {other['name']} share {listify(c['shared_projects'][:3])}. two different parts of you working in the same room.",
                        "evidence": (s["evidence"][:5] + other["evidence"][:5]), "start": None, "end": None,
                        "entities": [f"self:{s['key']}", f"self:{other['key']}"], "sources": [],
                        "confidence": conf(len(c["shared_projects"]) * 3, 2), "links": [{"place": "multiverse", "key": s["key"]}]})
    # 7. projects born the same week
    ps = sorted([p for p in projects if p["created"]], key=lambda p: p["created"])
    for a, b in zip(ps, ps[1:]):
        if abs((parse_ts(b["created"]) - parse_ts(a["created"])).days) <= 2 and a["commits"] >= 5 and b["commits"] >= 5:
            out.append({"key": f"twins-{a['key']}-{b['key']}", "kind": "pattern", "title": f"{a['name']} and {b['name']} were born days apart",
                        "explanation": f"first commits on {a['created'][:10]} and {b['created'][:10]}. two beginnings at once.",
                        "evidence": a["evidence"][:3] + b["evidence"][:3], "start": a["created"][:7], "end": b["created"][:7],
                        "entities": [f"project:{a['key']}", f"project:{b['key']}"], "sources": sorted(set(a["sources"]) | set(b["sources"])),
                        "confidence": {"score": 0.9, "label": "high"}, "links": [{"place": "museum", "key": f"project-{a['key']}"}]})
    for d in out:
        d["evidence"] = list(dict.fromkeys(d["evidence"]))
    # keep the strongest few of each repeating pattern, so the inbox stays meaningful
    caps = {"meet": 4, "return": 4, "twins": 3, "burst": 2, "forgotten": 6, "talked": 12, "cross": 8}
    count = Counter()
    kept = []
    for d in sorted(out, key=lambda d: -d["confidence"]["score"]):
        fam = d["key"].split("-")[0]
        if count[fam] < caps.get(fam, 6):
            count[fam] += 1
            kept.append(d)
    return kept


# ---------- step 9: archive ----------
COMMENTARY = {
    "builder": "subject builds systems that keep other systems alive. a considerable share of documented creativity goes into backups of things that already have backups.",
    "scholar": "subject reads, measures and then measures the measuring. the archive respects this and fears it a little.",
    "designer": "subject has opinions about pink that the archive is not qualified to contest.",
    "gamemaker": "subject repeatedly turns ordinary situations into games. the archive suspects this report is also a level.",
    "tinkerer": "subject talks to machines often and politely. the machines appear to talk back at length.",
    "learner": "subject builds study tools at a rate that may exceed the studying. evidence is inconclusive.",
    "musician": "subject's records hum. the archive cannot hear them yet.",
    "maker": "subject converts afternoons into small objects. the archive has started a shelf.",
    "founder": "subject keeps writing launch notes. some of them launch.",
}


def build_reports(interests, projects, selves, eras, recs, disc, coverage):
    reps = []
    for it in sorted(interests, key=lambda x: -x["records"])[:12]:
        peak = max(it["monthly"].items(), key=lambda x: x[1]) if it["monthly"] else None
        projs = [p["name"] for p in projects if it["key"] in p["interests"]][:6]
        facts = [f"first recorded in {nice_month(it['first_seen'])}, most recently in {nice_month(it['last_seen'])}.",
                 f"{it['records']} records across {listify(sorted(it['sources']))}."]
        if projs:
            facts.append(f"central to {listify(projs)}.")
        stats = []
        if peak:
            stats.append(f"busiest month {nice_month(peak[0])} with {peak[1]} record groups.")
        stats.append(f"active in {len(it['monthly'])} distinct months.")
        interp = [{"emerging": "this looks like an interest that is still growing.",
                   "declining": "this looks like an interest that is fading, or moved somewhere the archive cannot see.",
                   "dormant": "this looks like a past interest. it may live on offline.",
                   "steady": "this looks like a steady companion rather than a phase."}[it["status"]]]
        missing = [g for g in ("music", "conversations", "files", "google") if g not in coverage]
        unc = [f"the archive has no {listify(missing)} records yet, so this picture leans on what was connected."] if missing else []
        unc.append("terms were grouped by a statistical topic model. labels are its best two words, not your words.")
        reps.append({"key": f"dossier-{it['key']}", "kind": "dossier", "title": f"dossier: {it['label']}",
                     "facts": facts, "stats": stats, "interpretations": interp,
                     "commentary": COMMENTARY.get(it.get("archetype") or "", f"subject keeps returning to {it['terms'][0]}. the archive has opened a folder and is leaving it open."),
                     "uncertainties": unc, "evidence": it["evidence"][:30], "subject": f"interest:{it['key']}", "date": it["first_seen"]})
    # working hours, from timestamps only
    ts = [r["dt"].astimezone(TZ) for r in recs if r["dt"] and r["kind"] in ("commit", "session", "conversation")]
    if len(ts) >= 30:
        hours = Counter(t.hour for t in ts)
        days = Counter(t.strftime("%A").lower() for t in ts)
        peak_h = hours.most_common(1)[0][0]
        reps.append({"key": "observation-hours", "kind": "observation", "title": "behavioural observation: the hours",
                     "facts": [f"{len(ts)} timestamped commits, sessions and conversations.",
                               f"the busiest hour is {peak_h}:00 to {peak_h + 1}:00 local time.",
                               f"the busiest day is {days.most_common(1)[0][0]}."],
                     "stats": [f"{round(100 * sum(v for k, v in hours.items() if k < 6) / len(ts))}% before 6 am, "
                               f"{round(100 * sum(v for k, v in hours.items() if 9 <= k < 18) / len(ts))}% between 9 and 6."],
                     "interpretations": ["timestamps show when things were saved, not how anyone felt while saving them."],
                     "commentary": pick(["subject keeps hours that would worry a sensible houseplant.",
                                         "the archive notes the clock is treated as a suggestion."], str(peak_h)),
                     "uncertainties": ["commit times are when a commit was made, which can be long after the work."],
                     "evidence": [], "hours": dict(sorted(hours.items())), "subject": "time", "date": None})
    # contradictions
    contra = [p for p in projects if p["live_doc"] and p["days_quiet"] > 90]
    if contra:
        reps.append({"key": "contradictions-live", "kind": "contradiction", "title": "contradictory evidence: live but silent",
                     "facts": [f"{p['name']} has a document that says it is live or deployed, and no commits for {p['days_quiet']} days." for p in contra[:8]],
                     "stats": [], "interpretations": ["either these are finished and fine, or the documents are out of date. the archive cannot tell which."],
                     "commentary": "a live thing that never changes is either perfect or forgotten.",
                     "uncertainties": ["deployment state was read from your notes, not checked against the running service."],
                     "evidence": [d for p in contra for d in p["docs"][:2]], "subject": "projects", "date": None})
    if eras:
        reps.append({"key": "eras", "kind": "eras", "title": "historical record: the eras",
                     "facts": [f"{e['index']}. {e['title']}, {nice_month(e['start'])} to {nice_month(e['end'])}, {e['records']} records." for e in eras],
                     "stats": [f"{len(eras)} eras found by watching when the mix of interests changes."],
                     "interpretations": ["era borders are statistical. a real life does not change on the first of the month."],
                     "commentary": "the archive has divided the subject into chapters. the subject was not consulted and is welcome to object.",
                     "uncertainties": ["months with no records are treated as gaps, not as rest."], "evidence": [], "subject": "eras", "date": eras[0]["start"]})
    reps.append({"key": "coverage", "kind": "coverage", "title": "what this archive does not know",
                 "facts": [f"connected kinds of records: {listify(sorted(coverage)) or 'none yet'}."],
                 "stats": [f"{len(recs)} records in total."],
                 "interpretations": ["a digital footprint is a shadow, not a person."],
                 "commentary": "the archive keeps a room for everything it cannot explain. it is the biggest room.",
                 "uncertainties": ["no health, money, location or private messages are connected, on purpose."],
                 "evidence": [], "subject": "archive", "date": None})
    return reps


# ---------- step 10: library ----------
def build_chapters(eras, projects, interests, disc, memories, selves, recs):
    chapters = []
    ilabel = {i["key"]: i["label"] for i in interests}
    for e in eras:
        blocks = []
        rs = [r for r in recs if r["dt"] and e["start"] <= month_of(r["dt"]) <= e["end"]]
        srcs = Counter(SOURCE_GROUP.get(r["source_id"], r["source_id"]) for r in rs)
        blocks.append({"kind": "fact", "text": f"this chapter covers {nice_month(e['start'])} to {nice_month(e['end'])}. the records hold {len(rs)} traces from {listify([k for k, _ in srcs.most_common()])}.",
                       "evidence": [r["id"] for r in rs[:5]]})
        born = [p for p in projects if p["created"] and e["start"] <= p["created"][:7] <= e["end"]]
        if born:
            born.sort(key=lambda p: -p["commits"])
            blocks.append({"kind": "fact", "text": f"{listify([p['name'] for p in born[:6]])} began here." + (f" {len(born) - 6} more began too." if len(born) > 6 else ""),
                           "evidence": [p["evidence"][0] for p in born[:6] if p["evidence"]]})
            big = born[0]
            if big["commits"]:
                blocks.append({"kind": "stat", "text": f"the biggest of them, {big['name']}, now has {big['commits']} commits.", "evidence": big["evidence"][:2]})
        if e["dominant_labels"]:
            blocks.append({"kind": "fact", "text": f"the records talk most about {listify(e['dominant_labels'])}.", "evidence": []})
        ended = [p for p in projects if p["status"] == "abandoned" and p["last_activity"] and e["start"] <= p["last_activity"][:7] <= e["end"]]
        if ended:
            blocks.append({"kind": "fact", "text": f"{listify([p['name'] for p in ended[:5]])} went quiet during this time and never picked back up.", "evidence": [p["evidence"][0] for p in ended[:5] if p["evidence"]]})
        for d in disc:
            if d.get("start") and e["start"] <= d["start"] <= e["end"] and d["kind"] in ("crossover", "burst", "return"):
                blocks.append({"kind": "discovery", "text": d["title"] + ". " + d["explanation"], "evidence": d["evidence"][:4], "discovery": d["key"]})
        mine = [m for m in memories if m.get("date") and e["start"] <= m["date"][:7] <= e["end"]]
        for m in mine:
            blocks.append({"kind": "owner", "text": f"in your words. {m['body']}", "evidence": [], "memory": m["id"]})
        active = [s for s in selves if any(e["start"] <= mm <= e["end"] for mm in s["timeline"])]
        if active:
            blocks.append({"kind": "interpretation", "text": f"read as a story, this is a chapter where {listify([s['name'] for s in active[:3]])} {'shared the house' if len(active) > 1 else 'had the house to themselves'}. that is a way of reading the records, not something the records say.", "evidence": []})
        chapters.append({"key": e["key"], "volume": e["start"][:4], "title": e["title"], "start": e["start"], "end": e["end"],
                         "kind": "era", "blocks": blocks, "projects": [p["key"] for p in born], "selves": [s["key"] for s in active],
                         "interests": e["dominant"]})
    years = sorted({e["start"][:4] for e in eras} | {e["end"][:4] for e in eras})
    for y in years:
        rs = [r for r in recs if r["dt"] and month_of(r["dt"])[:4] == y]
        if not rs:
            continue
        months = Counter(month_of(r["dt"]) for r in rs)
        born = [p for p in projects if (p["created"] or "")[:4] == y]
        blocks = [{"kind": "fact", "text": f"{len(rs)} records from {y}. the busiest month was {nice_month(months.most_common(1)[0][0])}.", "evidence": []},
                  {"kind": "fact", "text": f"{len(born)} projects started this year." + (f" among them {listify([p['name'] for p in born[:5]])}." if born else ""), "evidence": []}]
        top = Counter()
        for it in interests:
            top[it["label"]] = sum(v for m, v in it["monthly"].items() if m.startswith(y))
        tl = [k for k, v in top.most_common(3) if v]
        if tl:
            blocks.append({"kind": "fact", "text": f"the year's most frequent interests were {listify(tl)}.", "evidence": []})
        chapters.append({"key": f"year-{y}", "volume": y, "title": f"{y}, looking back", "start": f"{y}-01", "end": f"{y}-12",
                         "kind": "retrospective", "blocks": blocks, "projects": [p["key"] for p in born], "selves": [], "interests": []})
    return chapters


def monthly_retros(recs, projects, interests):
    out = []
    by = defaultdict(list)
    for r in recs:
        if r["dt"]:
            by[month_of(r["dt"])].append(r)
    for m in sorted(by):
        rs = by[m]
        kinds = Counter(r["kind"] for r in rs)
        repos = Counter(r["meta"].get("repo") for r in rs if r["kind"] == "commit")
        top_i = max(interests, key=lambda i: i["monthly"].get(m, 0), default=None)
        out.append({"month": m, "records": len(rs), "kinds": dict(kinds), "top_project": repos.most_common(1)[0][0] if repos else None,
                    "top_interest": top_i["label"] if top_i and top_i["monthly"].get(m) else None,
                    "started": [p["name"] for p in projects if (p["created"] or "")[:7] == m]})
    return out


# ---------- step 11: unknown room ----------
def build_questions(gaps, interests, projects, disc, reps):
    qs = []
    for g in gaps:
        qs.append({"key": f"q-gap-{g['start']}", "kind": "missing period", "prompt": f"the records go quiet from {nice_month(g['start'])} to {nice_month(g['end'])}. what was happening?",
                   "context": f"{g['months']} months with nothing in any connected source."})
    for it in interests:
        if it["records"] <= 6:
            qs.append({"key": f"q-thin-{it['key']}", "kind": "thin evidence", "prompt": f"where did your interest in {it['terms'][0]} come from?",
                       "context": f"only {it['records']} records mention {it['label']}."})
    for p in projects:
        if p["status"] == "abandoned" and p["commits"] >= 10:
            qs.append({"key": f"q-stop-{p['key']}", "kind": "unfinished", "prompt": f"why did {p['name']} stop?",
                       "context": f"{p['commits']} commits, last one {p['days_quiet']} days ago."})
    for d in disc:
        if d["kind"] == "return":
            qs.append({"key": f"q-{d['key']}", "kind": "return", "prompt": f"what brought {d['title'].split(' came back')[0]} back in {nice_month(d['end'])}?",
                       "context": d["explanation"]})
    for r in reps:
        if r["kind"] == "contradiction":
            qs.append({"key": "q-contra-live", "kind": "contradiction", "prompt": "some projects are documented as live but have not changed in months. are they finished, or forgotten?",
                       "context": " ".join(r["facts"][:3])})
    for k, p in [("q-offline", "what matters to you that never leaves a digital trace?"),
                 ("q-people", "who shaped these years in ways no record shows?"),
                 ("q-before", "what were you like before the earliest record here?"),
                 ("q-wrong", "what does this universe get wrong about you?")]:
        qs.append({"key": k, "kind": "outside the records", "prompt": p, "context": "the archive cannot answer this one."})
    return qs


# ---------- main ----------
def build(con):
    t0 = datetime.now(timezone.utc)
    recs = load(con)
    now = datetime.now(timezone.utc)
    now_month = month_of(now)
    banned = set()
    rejected_disc = set()
    for c in con.execute("select target, verdict, note from correction"):
        if c["target"].startswith("interest:") and c["verdict"] == "reject":
            banned |= set(c["target"][9:].split("-"))
        if c["target"].startswith("term:"):
            banned.add(c["target"][5:])
    for r in con.execute("select key from discovery_state where state in ('rejected')"):
        rejected_disc.add(r["key"])
    memories = db.rows(con, "select * from memory")
    for m in memories:  # owner memories are evidence too, marked as owner authored
        recs.append({"id": -m["id"], "source_id": "owner", "ext_id": f"memory:{m['id']}", "kind": "memory",
                     "ts": m["date"], "title": m["title"] or "", "body": m["body"] or "", "meta": {}, "sensitive": 0,
                     "dt": parse_ts((m["date"] or "") + ("T12:00:00+00:00" if m["date"] and len(m["date"]) == 10 else ""))})
    units = build_units(recs)
    for r in recs:
        if r["kind"] in ("repo", "gh_repo"):
            name = r["meta"].get("repo") or r["title"]
            banned |= set(re.split(r"[^a-z0-9]+", name.lower())) | {name.lower(), normalize_name(name)}
        if r["kind"] == "gh_repo" and r["meta"].get("url"):
            banned.add(r["meta"]["url"].split("/")[-2].lower())
        if r["kind"] == "session" and r["meta"].get("project"):
            banned.add(r["meta"]["project"].lower())
    banned |= {"archived", "github", "javascript", "html", "swift", "kotlin", "jupyter", "notebook", "shell", "md"}
    banned = {b for b in banned if b and len(b) > 1 and b not in {"research", "music", "game", "paper", "design", "study", "recipe", "photo", "travel"}}
    topics, W = discover_interests(units, banned)
    interests, unit_topics = interest_objects(units, topics, W, now_month)
    projects = build_projects(recs, units, unit_topics, now)
    eras, gaps = build_eras(units, interests)
    selves = build_selves(interests, projects, recs, units, now_month)
    arts = build_artifacts(con, projects, recs, selves, eras, interests)
    exhibitions = build_exhibitions(arts, projects)
    edges, constellations = build_graph(interests, projects, selves, eras)
    disc = [d for d in build_discoveries(recs, interests, projects, selves, eras, units) if d["key"] not in rejected_disc]
    coverage = {SOURCE_GROUP.get(s, s) for s in {r["source_id"] for r in recs}} - {"owner"}
    reps = build_reports(interests, projects, selves, eras, recs, disc, coverage)
    chapters = build_chapters(eras, projects, interests, disc, memories, selves, recs)
    retros = monthly_retros(recs, projects, interests)
    questions = build_questions(gaps, interests, projects, disc, reps)
    for it in interests:
        it.pop("_t", None)
        it.pop("_units", None)

    con.execute("delete from derived")
    con.execute("delete from edge")

    def put(type_, obj, title, start=None, end=None):
        con.execute("insert or replace into derived(type, key, title, ts_start, ts_end, data) values (?,?,?,?,?,?)",
                    (type_, obj["key"], title, start, end, json.dumps(obj, default=str)))

    for x in interests:
        put("interest", x, x["label"], x["first_seen"], x["last_seen"])
    for x in projects:
        put("project", x, x["name"], (x["created"] or "")[:7], (x["last_activity"] or "")[:7])
    for x in eras:
        put("era", x, x["title"], x["start"], x["end"])
    for x in selves:
        put("self", x, x["name"], x["first_seen"], x["last_seen"])
    for x in arts:
        put("artifact", x, x["title"], x.get("period"), x.get("period"))
    for x in exhibitions:
        put("exhibition", x, x["title"])
    for x in constellations:
        put("constellation", x, x["title"])
    for x in disc:
        put("discovery", x, x["title"], x.get("start"), x.get("end"))
        con.execute("insert or ignore into discovery_state(key, state, updated_at) values (?, 'new', ?)", (x["key"], db.now()))
    for x in reps:
        put("report", x, x["title"], x.get("date"))
    for x in questions:
        put("question", x, x["prompt"])
    for x in gaps:
        put("gap", {"key": f"gap-{x['start']}", **x}, "gap", x["start"], x["end"])
    for e in edges:
        con.execute("insert or replace into edge(a, b, kind, weight, why, evidence) values (?,?,?,?,?,?)",
                    (e["a"], e["b"], e["kind"], e["weight"], e["why"], "[]"))
    # chapters keep a version history of what the biographer wrote
    for c in chapters:
        put("chapter", c, c["title"], c["start"], c["end"])
        body = "\n".join(b["text"] for b in c["blocks"])
        last = con.execute("select body from chapter_version where key=? and author='biographer' order by id desc limit 1", (c["key"],)).fetchone()
        if not last or last["body"] != body:
            con.execute("insert into chapter_version(key, author, title, body, created_at) values (?,?,?,?,?)",
                        (c["key"], "biographer", c["title"], body, db.now()))
    db.set_meta(con, "retros", retros)
    stats = {"records": len([r for r in recs if r["id"] > 0]), "interests": len(interests), "projects": len(projects),
             "eras": len(eras), "selves": len(selves), "artifacts": len(arts), "discoveries": len(disc),
             "first": min((r["ts"] for r in recs if r["dt"]), default=None), "built_at": db.now(), "version": VERSION,
             "seconds": round((datetime.now(timezone.utc) - t0).total_seconds(), 1), "coverage": sorted(coverage)}
    db.set_meta(con, "stats", stats)
    con.execute("insert into snapshot(at, kind, label, data) values (?,?,?,?)",
                (db.now(), "captured", f"captured {now.astimezone(TZ).strftime('%d %b %Y %H:%M').lower()}",
                 json.dumps({"stats": stats, "selves": [s["name"] for s in selves], "interests": [i["label"] for i in interests][:20],
                             "active_projects": [p["name"] for p in projects if p["status"] == "active"]})))
    rebuild_search(con, recs)
    con.commit()
    return stats


def rebuild_search(con, recs):
    con.execute("delete from search_index")
    for r in recs:
        if r["id"] <= 0:
            continue
        con.execute("insert into search_index(ref, kind, title, body, ts) values (?,?,?,?,?)",
                    (f"record:{r['id']}", r["kind"], r["title"] or "", (r["body"] or "")[:3000], r["ts"]))
    for row in con.execute("select type, key, title, data, ts_start from derived").fetchall():
        d = json.loads(row["data"])
        def flat(v):
            if isinstance(v, list):
                return " ".join(flat(x) for x in v)
            if isinstance(v, dict):
                return str(v.get("text", ""))
            return str(v or "")
        body = " ".join(flat(d.get(k)) for k in ("description", "context", "explanation", "terms", "interest_labels", "facts",
                                                 "stats", "blocks", "lore", "prompt", "commentary"))
        con.execute("insert into search_index(ref, kind, title, body, ts) values (?,?,?,?,?)",
                    (f"{row['type']}:{row['key']}", row["type"], row["title"] or "", body[:4000], row["ts_start"]))
