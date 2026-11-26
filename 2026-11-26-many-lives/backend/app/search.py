# backend/app/search.py: keyword search over everything (sqlite fts5) with a little question sense.
# "when did i first ..." sorts oldest first, month names narrow the dates, "forgotten" and "keep returning"
# jump to the matching derived objects. Words are folded across english, indonesian and korean by text.ALIASES.
import json
import re
from datetime import datetime

from . import db
from .text import ALIASES, tokens

MONTHS = {m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                         "september", "october", "november", "december"])}
QUESTION_WORDS = {"when", "did", "first", "what", "which", "how", "has", "have", "was", "were", "keep", "keeps", "returning",
                  "forgotten", "forgot", "creating", "listen", "listened", "during", "changed", "connects", "connect", "between",
                  "interested", "interest", "interests", "last", "become", "projects", "project", "my", "about", "doing"}


def parse_dates(q: str):
    ql = q.lower()
    now = datetime.now()
    y = re.search(r"\b(19|20)\d{2}\b", ql)
    for name, n in MONTHS.items():
        if re.search(rf"\b{name}\b", ql):
            year = int(y.group(0)) if y else (now.year if n <= now.month else now.year - 1)
            if "last" in ql and not y:
                year = now.year if n < now.month else now.year - 1
            return f"{year:04d}-{n:02d}", f"{year:04d}-{n:02d}"
    if y:
        return f"{y.group(0)}-01", f"{y.group(0)}-12"
    return None, None


def search(con, q: str, limit=40):
    ql = q.lower().strip()
    start, end = parse_dates(ql)
    words = [w for w in re.findall(r"[\w가-힣]+", ql) if w not in QUESTION_WORDS and not w.isdigit() and w not in MONTHS]
    terms = set(words) | set(tokens(" ".join(words)))
    terms |= {k for k, v in ALIASES.items() if v in terms}
    terms = {t for t in terms if len(t) > 1}
    out = {"query": q, "range": [start, end], "mode": [], "results": [], "answer": None}
    if "forgot" in ql or "forgotten" in ql:
        out["mode"].append("forgotten")
        for p in db.derived(con, "project"):
            if p["status"] in ("abandoned", "dormant"):
                out["results"].append({"ref": f"project:{p['key']}", "kind": "project", "title": p["name"],
                                       "snippet": f"quiet for {p['days_quiet']} days", "ts": p["last_activity"]})
    if "returning" in ql or "keep coming" in ql or "come back" in ql:
        out["mode"].append("returning")
        for d in db.derived(con, "discovery"):
            if d["kind"] == "return":
                out["results"].append({"ref": f"discovery:{d['key']}", "kind": "discovery", "title": d["title"],
                                       "snippet": d["explanation"], "ts": d.get("end")})
    if terms:
        match = " OR ".join('"' + t.replace('"', "") + '"' for t in terms)
        sql = "select ref, kind, title, snippet(search_index, 3, '[', ']', ' ... ', 14) snip, ts from search_index where search_index match ?"
        args = [match]
        if start:
            sql += " and substr(ts,1,7) between ? and ?"
            args += [start, end]
        first = bool(re.search(r"\bfirst\b|\bearliest\b|\bbegin", ql))
        sql += " order by " + ("ts is null, ts asc" if first else "rank") + " limit ?"
        args.append(limit)
        try:
            for r in con.execute(sql, args):
                out["results"].append({"ref": r["ref"], "kind": r["kind"], "title": r["title"], "snippet": r["snip"], "ts": r["ts"]})
        except Exception as e:
            out["error"] = str(e)
        if first:
            out["mode"].append("earliest first")
            dated = [r for r in out["results"] if r["ts"] and r["ref"].startswith("record:")]
            if dated:
                out["answer"] = f"the earliest trace is from {dated[0]['ts'][:10]}: {dated[0]['title']}"
    elif start:
        out["mode"].append("by date")
        for r in con.execute("select ref, kind, title, substr(body,1,160) snip, ts from search_index where substr(ts,1,7) between ? and ?"
                             " and ref like 'record:%' order by ts limit ?", (start, end, limit)):
            out["results"].append({"ref": r["ref"], "kind": r["kind"], "title": r["title"], "snippet": r["snip"], "ts": r["ts"]})
        for d in db.derived(con, "project"):
            if start <= (d["created"] or "")[:7] <= end:
                out["results"].insert(0, {"ref": f"project:{d['key']}", "kind": "project", "title": f"started {d['name']}",
                                          "snippet": d["description"][:160], "ts": d["created"]})
    out["terms"] = sorted(terms)
    seen, uniq = set(), []
    for r in out["results"]:
        if r["ref"] not in seen:
            seen.add(r["ref"])
            uniq.append(r)
    out["results"] = uniq[:limit]
    return out
