# backend/app/connectors/code.py: local git repositories, project documentation, and GitHub (through gh).
# Only metadata and documentation are read. Source code is never imported.
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .base import Connector, Ctx, walk
from ..redact import is_forbidden, looks_sensitive

HOME = Path.home()


def run(cmd, cwd=None, timeout=60) -> str:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[:400])
    return r.stdout


def find_repos(roots: list[Path], max_depth=3) -> list[Path]:
    out = []
    for root in roots:
        root = root.expanduser()
        if not root.exists():
            continue
        stack = [(root, 0)]
        while stack:
            p, d = stack.pop()
            try:
                if (p / ".git").exists():
                    out.append(p)
                    continue  # nested repos inside a repo are skipped on purpose
                if d >= max_depth:
                    continue
                for c in sorted(p.iterdir()):
                    if c.is_dir() and not c.name.startswith(".") and not is_forbidden(c / "x"):
                        stack.append((c, d + 1))
            except (PermissionError, OSError):
                continue
    return sorted(set(out))


class GitLocal(Connector):
    def discover(self, con):
        roots = [Path(p).expanduser() for p in self.suggested_paths]
        repos = find_repos([r for r in roots if r.exists()])
        if not shutil.which("git"):
            return {"status": "unsupported", "found": "git is not installed"}
        return {"status": "available", "found": f"{len(repos)} git repositories in suggested folders",
                "detail": {"repos": [str(r) for r in repos[:200]]}}

    def sync(self, ctx: Ctx):
        for repo in find_repos(ctx.paths):
            try:
                head = run(["git", "rev-parse", "HEAD"], cwd=repo).strip()
            except Exception:
                continue  # empty repo
            name = repo.name
            last = ctx.cursor(str(repo))
            remote = ""
            try:
                remote = run(["git", "remote", "get-url", "origin"], cwd=repo).strip()
                remote = re.sub(r"https://[^@/]+@", "https://", remote)
            except Exception:
                pass
            tags = []
            try:
                for line in run(["git", "tag", "--format=%(refname:short)\x1f%(creatordate:iso-strict)"], cwd=repo).splitlines():
                    t, d = (line.split("\x1f") + [""])[:2]
                    tags.append({"tag": t, "date": d})
            except Exception:
                pass
            rng = [f"{last}..HEAD"] if last else []
            try:
                log = run(["git", "log", *rng, "--no-merges", "--format=%H%x1f%aI%x1f%s%x1f%an", "--shortstat"],
                          cwd=repo, timeout=120)
            except RuntimeError:
                log = run(["git", "log", "--no-merges", "--format=%H%x1f%aI%x1f%s%x1f%an", "--shortstat"], cwd=repo, timeout=120)
            commits, cur = [], None
            for line in log.splitlines():
                if "\x1f" in line:
                    sha, ts, subj, author = (line.split("\x1f") + ["", "", ""])[:4]
                    cur = {"sha": sha, "ts": ts, "subj": subj, "author": author}
                    commits.append(cur)
                elif cur and "changed" in line:
                    for v, k in re.findall(r"(\d+) (file|insertion|deletion)", line):
                        cur[k] = int(v)
            for c in commits:
                ctx.put(f"{name}:{c['sha']}", "commit", c["ts"], c["subj"], "",
                        {"repo": name, "path": str(repo), "author": c["author"], "files": c.get("file", 0),
                         "insertions": c.get("insertion", 0), "deletions": c.get("deletion", 0)})
            # one summary record per repo (recomputed every sync, hash keeps it idempotent)
            first = run(["git", "log", "--reverse", "--format=%aI", "--max-parents=0"], cwd=repo).splitlines()
            last_ts = run(["git", "log", "-1", "--format=%aI"], cwd=repo).strip()
            count = int(run(["git", "rev-list", "--count", "--no-merges", "HEAD"], cwd=repo).strip() or 0)
            roots = run(["git", "rev-list", "--max-parents=0", "HEAD"], cwd=repo).split()
            ctx.put(f"repo:{repo}", "repo", first[0] if first else last_ts, name, "",
                    {"repo": name, "path": str(repo), "remote": remote, "commits": count, "last_commit": last_ts,
                     "tags": tags[-30:], "root": sorted(roots)[0] if roots else None})
            for t in tags:
                if t["date"]:
                    ctx.put(f"{name}:tag:{t['tag']}", "release", t["date"], f"{name} {t['tag']}", "",
                            {"repo": name, "tag": t["tag"]})
            ctx.set_cursor(str(repo), head)
            ctx.con.commit()
            ctx.log(f"{name} at {head[:7]}")


DOC_NAMES = re.compile(r"(?i)^(readme|progress|plan|implementation_plan|architecture|changelog|status|roadmap|build_progress|"
                       r"release|phase\d*.*|.*_plan|.*_release|.*_acceptance|about|idea|ideas|brief)\.(md|txt|markdown)$")


class ProjectDocs(Connector):
    def discover(self, con):
        roots = [Path(p).expanduser() for p in self.suggested_paths if Path(p).expanduser().exists()]
        n = sum(1 for _ in self._docs(roots))
        return {"status": "available", "found": f"{n} project documents (readmes, plans, progress notes)"}

    def _docs(self, roots):
        for repo in find_repos(roots):
            for f in list(repo.glob("*")) + list(repo.glob("docs/*")):
                if f.is_file() and DOC_NAMES.match(f.name) and not is_forbidden(f):
                    yield repo, f

    def sync(self, ctx: Ctx):
        for repo, f in self._docs(ctx.paths):
            h = ctx.file_changed(f)
            if not h:
                continue
            text = f.read_text(errors="ignore")
            mtime = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat()
            title = f"{repo.name} / {f.name}"
            ctx.put(f"doc:{f}", "doc", mtime, title, text[:8000],
                    {"repo": repo.name, "path": str(f), "chars": len(text)}, sensitive=looks_sensitive(f.name, text))
            ctx.mark_file(f, h)
        ctx.con.commit()


class GitHub(Connector):
    def discover(self, con):
        if not shutil.which("gh"):
            return {"status": "unsupported", "found": "github cli not installed"}
        try:
            who = run(["gh", "api", "user", "--jq", ".login"]).strip()
        except Exception as e:
            return {"status": "authorization required", "found": f"gh is not signed in ({e})"}
        return {"status": "available", "found": f"signed in to github as {who} through gh", "detail": {"login": who}}

    def sync(self, ctx: Ctx):
        login = run(["gh", "api", "user", "--jq", ".login"]).strip()
        fields = "name,description,createdAt,pushedAt,updatedAt,primaryLanguage,isPrivate,url,isArchived,isFork,stargazerCount,repositoryTopics,homepageUrl,languages"
        repos = json.loads(run(["gh", "repo", "list", login, "--limit", "300", "--json", fields], timeout=120))
        include_private = "private_repos" in ctx.categories
        for r in repos:
            if r.get("isPrivate") and not include_private:
                continue
            langs = [l["node"]["name"] for l in (r.get("languages") or []) if l.get("node")]
            ctx.put(f"gh:{r['name']}", "gh_repo", r["createdAt"], r["name"], r.get("description") or "",
                    {"repo": r["name"], "url": r["url"], "private": r["isPrivate"], "pushed": r["pushedAt"],
                     "language": (r.get("primaryLanguage") or {}).get("name"), "languages": langs,
                     "archived": r["isArchived"], "fork": r["isFork"], "stars": r["stargazerCount"],
                     "homepage": r.get("homepageUrl"),
                     "topics": [t["name"] for t in (r.get("repositoryTopics") or [])]})
            ctx.con.commit()
        # contribution calendar, one record per month, from the official graphql api
        created = run(["gh", "api", "user", "--jq", ".created_at"]).strip()[:4]
        for year in range(int(created), datetime.now().year + 1):
            q = ('query($u:String!,$f:DateTime!,$t:DateTime!){user(login:$u){contributionsCollection(from:$f,to:$t){'
                 'contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}')
            out = json.loads(run(["gh", "api", "graphql", "-f", f"query={q}", "-f", f"u={login}",
                                  "-f", f"f={year}-01-01T00:00:00Z", "-f", f"t={year}-12-31T23:59:59Z"]))
            months: dict[str, int] = {}
            for w in out["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]:
                for d in w["contributionDays"]:
                    months[d["date"][:7]] = months.get(d["date"][:7], 0) + d["contributionCount"]
            for m, n in months.items():
                if n:
                    ctx.put(f"contrib:{m}", "contributions", f"{m}-01T00:00:00+00:00", f"{n} contributions in {m}", "",
                            {"month": m, "count": n})
        ctx.con.commit()
        ctx.log(f"{len(repos)} repositories listed for {login}")
