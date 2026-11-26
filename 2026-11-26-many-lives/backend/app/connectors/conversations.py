# backend/app/connectors/conversations.py: Claude Code session logs (local), ChatGPT export, Claude export.
# Only the owner's own messages are kept (what you asked or wrote). Assistant replies are counted, not stored.
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from .base import Connector, Ctx
from .. import config

TAGS = re.compile(r"<(system-reminder|command-[a-z\-]+|local-command-stdout|pasted_content[^>]*)>.*?</\1[^>]*>", re.S)
ANY_TAG = re.compile(r"</?[a-z_\-]+(?: [^>]*)?>")


# app and harness notices (background task results, session events) are logged as user turns. they are not your words.
WRAPPED = re.compile(r"<([a-z][a-z0-9_\-]*)(?: [^>]*)?>.*?</\1>", re.S)
NOISE = re.compile(r"\btoolu_[A-Za-z0-9]+|(?:/private)?/(?:tmp|var/folders)/\S+|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[a-z0-9]{9}\b(?=\s+toolu_)")


def clean_prompt(t: str) -> str:
    t = TAGS.sub(" ", t or "")
    t = WRAPPED.sub(" ", t)
    t = ANY_TAG.sub(" ", t)
    t = NOISE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def iso(ts) -> str | None:
    if ts is None or ts == "":
        return None
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, timezone.utc).isoformat()
    return str(ts)


class ClaudeCode(Connector):
    def discover(self, con):
        root = Path.home() / ".claude/projects"
        if not root.exists():
            return {"status": "unsupported", "found": "no claude code session folder on this mac"}
        n = len(list(root.glob("*/*.jsonl")))
        return {"status": "authorization required",
                "found": f"{n} claude code session logs, needs your folder approval before anything is read"}

    def sync(self, ctx: Ctx):
        for root in ctx.paths:
            for f in sorted(root.glob("*/*.jsonl")):
                if "scratch" in f.parent.name or f.parent.name.startswith("-private-"):
                    continue  # throwaway scratch and temp sessions
                h = ctx.file_changed(f)
                if not h:
                    continue
                prompts, first_ts, last_ts, cwd, title, n_assist = [], None, None, "", "", 0
                for line in f.open(errors="ignore"):
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    t = d.get("type")
                    if t == "custom-title":
                        title = d.get("customTitle") or d.get("title") or title
                    if t == "assistant":
                        n_assist += 1
                    if t != "user" or d.get("isSidechain") or d.get("isMeta"):
                        continue
                    c = (d.get("message") or {}).get("content")
                    if not isinstance(c, str):
                        continue  # tool results, not the owner's words
                    p = clean_prompt(c)
                    if len(p) < 3:
                        continue
                    ts = d.get("timestamp")
                    first_ts = first_ts or ts
                    last_ts = ts
                    cwd = d.get("cwd") or cwd
                    prompts.append(p[:600])
                if not prompts:
                    ctx.mark_file(f, h)
                    continue
                project = Path(cwd).name if cwd else f.parent.name
                ctx.put(f"session:{f.stem}", "session", first_ts, (title or prompts[0][:90]),
                        "\n".join(prompts)[:6000],
                        {"project": project, "prompts": len(prompts), "replies": n_assist, "last": last_ts,
                         "tool": "claude code"})
                ctx.mark_file(f, h)
                ctx.con.commit()


def export_files(ctx: Ctx, patterns: list[str]):
    """archives and folders in the app inbox plus any folder the owner approved for this importer."""
    roots = [config.INBOX_DIR] + ctx.paths
    for r in roots:
        if not r.exists():
            continue
        for pat in patterns:
            for f in r.glob(pat):
                if f.is_file():
                    yield f


def read_json_from(f: Path, names: tuple[str, ...]):
    """yield (name, parsed json) for matching members of a zip, or the file itself."""
    if f.suffix == ".zip":
        with zipfile.ZipFile(f) as z:
            for n in z.namelist():
                if n.split("/")[-1] in names or any(re.fullmatch(x, n.split("/")[-1]) for x in names if "*" in x or "\\" in x):
                    with z.open(n) as fh:
                        try:
                            yield n, json.loads(fh.read().decode("utf-8", "ignore"))
                        except Exception:
                            continue
    elif f.name in names or any(re.fullmatch(x, f.name) for x in names if "*" in x or "\\" in x):
        yield f.name, json.loads(f.read_text(errors="ignore"))


def chatgpt_html_json(text: str):
    m = re.search(r"var jsonData = (\[.*?\]);\s*\n", text, re.S)
    return json.loads(m.group(1)) if m else []


class ChatGPTExport(Connector):
    def discover(self, con):
        return {"status": "export required",
                "found": "no official api for chatgpt history. request the export, then drop the zip in the inbox"}

    def sync(self, ctx: Ctx):
        for f in export_files(ctx, ["*.zip", "conversations.json", "chat.html"]):
            h = ctx.file_changed(f)
            if not h:
                continue
            convs = []
            if f.name == "chat.html":
                convs = chatgpt_html_json(f.read_text(errors="ignore"))
            else:
                for name, data in read_json_from(f, ("conversations.json",)):
                    if isinstance(data, list) and data and "mapping" in data[0]:
                        convs = data
                if not convs and f.suffix == ".zip":
                    with zipfile.ZipFile(f) as z:
                        if "chat.html" in [n.split("/")[-1] for n in z.namelist()]:
                            n = [n for n in z.namelist() if n.endswith("chat.html")][0]
                            convs = chatgpt_html_json(z.read(n).decode("utf-8", "ignore"))
            if not convs:
                continue  # not a chatgpt archive, leave it for other importers
            for c in convs:
                mapping = c.get("mapping") or {}
                mine, n_assist, branches = [], 0, 0
                for node in mapping.values():
                    if len(node.get("children") or []) > 1:
                        branches += 1
                    m = node.get("message") or {}
                    role = (m.get("author") or {}).get("role")
                    parts = (m.get("content") or {}).get("parts") or []
                    txt = " ".join(p for p in parts if isinstance(p, str)).strip()
                    if role == "user" and txt:
                        mine.append((m.get("create_time") or 0, txt[:600]))
                    elif role == "assistant":
                        n_assist += 1
                mine.sort()
                cid = c.get("conversation_id") or c.get("id") or f"{c.get('title')}-{c.get('create_time')}"
                ctx.put(f"chatgpt:{cid}", "conversation", iso(c.get("create_time")), c.get("title") or "untitled",
                        "\n".join(t for _, t in mine)[:6000],
                        {"tool": "chatgpt", "prompts": len(mine), "replies": n_assist, "branches": branches,
                         "updated": iso(c.get("update_time")), "archive": f.name})
            ctx.mark_file(f, h)
            ctx.con.commit()
            ctx.log(f"{f.name}: {len(convs)} chatgpt conversations")


class ClaudeExport(Connector):
    def discover(self, con):
        return {"status": "export required",
                "found": "claude.ai offers a data export in settings. drop the zip in the inbox"}

    def sync(self, ctx: Ctx):
        for f in export_files(ctx, ["*.zip", "conversations.json"]):
            h = ctx.file_changed(f)
            if not h:
                continue
            convs = []
            for name, data in read_json_from(f, ("conversations.json",)):
                if isinstance(data, list) and data and "chat_messages" in data[0]:
                    convs = data
            if not convs:
                continue
            for c in convs:
                msgs = c.get("chat_messages") or []
                mine = []
                for m in msgs:
                    if m.get("sender") == "human":
                        txt = m.get("text") or " ".join(x.get("text", "") for x in (m.get("content") or []) if isinstance(x, dict))
                        if txt.strip():
                            mine.append(txt.strip()[:600])
                ctx.put(f"claude:{c.get('uuid')}", "conversation", c.get("created_at"), c.get("name") or "untitled",
                        "\n".join(mine)[:6000],
                        {"tool": "claude.ai", "prompts": len(mine), "replies": len(msgs) - len(mine),
                         "updated": c.get("updated_at"), "archive": f.name})
            ctx.mark_file(f, h)
            ctx.con.commit()
            ctx.log(f"{f.name}: {len(convs)} claude conversations")
