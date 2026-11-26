# backend/app/connectors/files.py: personal folders (notes, writing, lyrics, research, calendars, photos)
# and academic libraries (bibtex, ris, zotero). Read only. Originals are never modified.
import csv
import io
import json
import re
import sqlite3
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from .base import Connector, Ctx, walk
from ..redact import is_forbidden, looks_sensitive

TEXT_EXT = (".md", ".markdown", ".txt", ".json", ".csv", ".html", ".htm", ".xml", ".ics", ".pdf", ".docx",
            ".bib", ".ris", ".zip", ".jpg", ".jpeg", ".png", ".heic", ".gif", ".webp")
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".heic", ".gif", ".webp")


class _Strip(HTMLParser):
    def __init__(self):
        super().__init__()
        self.out = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        self.skip = tag in ("script", "style")

    def handle_endtag(self, tag):
        self.skip = False

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d)


def html_text(s: str) -> str:
    p = _Strip()
    p.feed(s)
    return re.sub(r"\s+", " ", " ".join(p.out)).strip()


def parse_ics(text: str) -> list[dict]:
    text = re.sub(r"\r?\n[ \t]", "", text)  # unfold
    out, cur = [], None
    for line in text.splitlines():
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT" and cur is not None:
            if cur.get("start"):
                out.append({"uid": cur.get("uid") or f"{cur['start']}-{cur.get('summary','')}", **cur})
            cur = None
        elif cur is not None and ":" in line:
            k, v = line.split(":", 1)
            k = k.split(";")[0].upper()
            if k == "SUMMARY":
                cur["summary"] = v
            elif k == "DESCRIPTION":
                cur["description"] = v.replace("\\n", "\n")
            elif k == "UID":
                cur["uid"] = v
            elif k == "DTSTART":
                d = re.sub(r"[^0-9T]", "", v)
                cur["start"] = f"{d[:4]}-{d[4:6]}-{d[6:8]}T{d[9:11] or '00'}:{d[11:13] or '00'}:00+00:00"
    return out


def parse_bibtex(text: str) -> list[dict]:
    out = []
    for m in re.finditer(r"@(\w+)\s*\{\s*([^,]+),(.*?)\n\}", text, re.S):
        fields = {k.lower(): re.sub(r"[{}\s]+", " ", v).strip()
                  for k, v in re.findall(r"(\w+)\s*=\s*[{\"](.*?)[}\"]\s*,?\s*\n", m.group(3) + "\n", re.S)}
        out.append({"key": m.group(2).strip(), "type": m.group(1).lower(), **fields})
    return out


def parse_ris(text: str) -> list[dict]:
    out, cur = [], {}
    for line in text.splitlines():
        m = re.match(r"^([A-Z][A-Z0-9])  - ?(.*)$", line)
        if not m:
            continue
        k, v = m.groups()
        if k == "ER":
            out.append(cur)
            cur = {}
        elif k in ("TI", "T1"):
            cur["title"] = v
        elif k in ("PY", "Y1", "DA"):
            cur["year"] = v[:4]
        elif k in ("AU", "A1"):
            cur.setdefault("author", []).append(v)
        elif k in ("KW",):
            cur.setdefault("keywords", []).append(v)
        elif k in ("AB", "N2"):
            cur["abstract"] = v
        elif k in ("JO", "T2", "JF"):
            cur["journal"] = v
    return out


def extract_text(f: Path) -> str:
    ext = f.suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        r = PdfReader(str(f))
        return "\n".join((p.extract_text() or "") for p in r.pages[:12])
    if ext == ".docx":
        import docx
        return "\n".join(p.text for p in docx.Document(str(f)).paragraphs)
    raw = f.read_text(errors="ignore")
    if ext in (".html", ".htm", ".xml"):
        return html_text(raw)
    if ext == ".json":
        try:
            return json.dumps(json.loads(raw), ensure_ascii=False)[:8000]
        except Exception:
            return raw
    return raw


def guess_kind(f: Path, text: str) -> str:
    n = f.name.lower()
    t = text[:3000].lower()
    if re.search(r"lyric|가사|lirik|verse|chorus|reff", n + t[:400]):
        return "lyric"
    if re.search(r"journal|diary|일기|catatan harian", n):
        return "journal"
    if re.search(r"wishlist|want list|갖고 싶", n):
        return "wishlist"
    if re.search(r"recipe|레시피|resep", n):
        return "recipe"
    if re.search(r"abstract|introduction|references|related work|methodology", t):
        return "research"
    if re.search(r"idea|아이디어|ide ", n):
        return "idea"
    return "note"


BULK_DIRS = {"data", "data_peek", "raw", "upload", "uploads", "render", "renders", "textures", "volumes", "cache", "checkpoints",
             "outputs", "frames", "dataset", "datasets", "logs", "tmp", "artifacts", "scheduled", "assets", "images"}
FRAME = re.compile(r"^\d{2,6}$")


def personal_files(roots, max_depth=5):
    """personal writing, not bulk data. skips dataset style folders, numbered render frames, and any folder
    that holds over 150 files of one type (a dataset, an export dump or an image sequence)."""
    import os
    from collections import Counter
    for root in roots:
        root = root.expanduser()
        base = len(root.parts)
        for dirpath, dirnames, filenames in os.walk(root):
            p = Path(dirpath)
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and d.lower() not in BULK_DIRS
                           and not is_forbidden(p / d / "x")]
            if len(p.parts) - base >= max_depth:
                dirnames[:] = []
            kinds = Counter(Path(f).suffix.lower() for f in filenames)
            for fn in filenames:
                fp = p / fn
                ext = fp.suffix.lower()
                if fn.startswith(".") or ext not in TEXT_EXT or is_forbidden(fp) or kinds[ext] > 150 or FRAME.match(fp.stem) \
                        or ext == ".json" or re.match(r"^\d{6,}", fp.stem):
                    # json is machine output and long digit names are documents from datasets, not your writing
                    continue
                yield fp


class Documents(Connector):
    def discover(self, con):
        found = []
        for p in self.suggested_paths:
            pp = Path(p).expanduser()
            if pp.exists():
                found.append(str(pp))
        return {"status": "available" if found else "discovered",
                "found": f"{len(found)} suggested folders exist. nothing is read until you approve one",
                "detail": {"folders": found}}

    def sync(self, ctx: Ctx):
        for f in personal_files(ctx.paths):
            try:
                if f.stat().st_size > 40_000_000:
                    continue
                h = ctx.file_changed(f)
                if not h:
                    continue
                mtime = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat()
                ext = f.suffix.lower()
                if ext in IMAGE_EXT:
                    # metadata only: name, folder, date. pixels and exif location are not read.
                    ctx.put(f"file:{f}", "photo", mtime, f.stem, "", {"path": str(f), "folder": f.parent.name})
                elif ext == ".ics":
                    for ev in parse_ics(f.read_text(errors="ignore")):
                        ctx.put(f"cal:{ev['uid']}", "event", ev["start"], ev.get("summary", "event"),
                                ev.get("description", "")[:500], {"calendar": f.name})
                elif ext == ".bib":
                    for e in parse_bibtex(f.read_text(errors="ignore")):
                        # dated by when the reference file was saved. the paper's own year is kept in meta
                        ctx.put(f"bib:{e['key']}", "paper", mtime,
                                e.get("title", e["key"]), e.get("abstract", "") + " " + e.get("keywords", ""),
                                {"authors": e.get("author", ""), "venue": e.get("journal") or e.get("booktitle"),
                                 "year": e.get("year"), "file": f.name})
                elif ext == ".ris":
                    for e in parse_ris(f.read_text(errors="ignore")):
                        if e.get("title"):
                            ctx.put(f"ris:{e['title'][:120]}", "paper", mtime,
                                    e["title"], e.get("abstract", "") + " " + " ".join(e.get("keywords", [])),
                                    {"authors": e.get("author", []), "venue": e.get("journal"), "year": e.get("year"), "file": f.name})
                elif ext == ".csv":
                    text = f.read_text(errors="ignore")
                    rows = list(csv.reader(io.StringIO(text)))
                    ctx.put(f"file:{f}", "dataset", mtime, f.stem, text[:4000],
                            {"path": str(f), "rows": len(rows), "columns": rows[0] if rows else []})
                elif ext == ".zip":
                    with zipfile.ZipFile(f) as z:
                        ctx.put(f"file:{f}", "archive", mtime, f.stem, " ".join(z.namelist()[:80]),
                                {"path": str(f), "members": len(z.namelist())})
                else:
                    text = extract_text(f)
                    kind = guess_kind(f, text)
                    ctx.put(f"file:{f}", kind, mtime, f.stem, text[:10000],
                            {"path": str(f), "folder": f.parent.name, "chars": len(text), "ext": ext},
                            sensitive=looks_sensitive(f.name, text))
                ctx.mark_file(f, h)
            except Exception as e:  # one bad file never stops the sync
                ctx.log(f"skipped {f.name}: {e}")
        ctx.con.commit()


class Zotero(Connector):
    def discover(self, con):
        p = Path.home() / "Zotero/zotero.sqlite"
        if not p.exists():
            return {"status": "unsupported", "found": "no zotero library on this mac. bibtex or ris exports work through personal folders"}
        return {"status": "available", "found": "zotero library found"}

    def sync(self, ctx: Ctx):
        p = Path.home() / "Zotero/zotero.sqlite"
        z = sqlite3.connect(f"file:{p}?mode=ro&immutable=1", uri=True)
        q = """select i.key, i.dateAdded,
                 (select v.value from itemData d join itemDataValues v using(valueID) join fields f using(fieldID)
                  where d.itemID=i.itemID and f.fieldName='title') title,
                 (select v.value from itemData d join itemDataValues v using(valueID) join fields f using(fieldID)
                  where d.itemID=i.itemID and f.fieldName='abstractNote') abstract
               from items i"""
        for key, added, title, abstract in z.execute(q):
            if title:
                ctx.put(f"zotero:{key}", "paper", added, title, abstract or "", {"library": "zotero"})
        ctx.con.commit()
