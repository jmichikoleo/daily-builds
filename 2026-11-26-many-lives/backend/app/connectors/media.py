# backend/app/connectors/media.py: Spotify (official export + official web api) and Google Takeout.
# Plays and watches are stored as monthly aggregates (month x artist, month x channel), which is what the
# universe needs and keeps years of history small.
import base64
import hashlib
import json
import re
import secrets
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

from .base import Connector, Ctx
from .conversations import export_files
from .. import config, db

SPOTIFY_NAMES = re.compile(r"(StreamingHistory_music_\d+|StreamingHistory\d+|Streaming_History_Audio_.*|endsong_\d+)\.json$")


def _members(f: Path, pat: re.Pattern):
    if f.suffix == ".zip":
        with zipfile.ZipFile(f) as z:
            for n in z.namelist():
                if pat.search(n):
                    yield n, z.read(n)
    elif pat.search(f.name):
        yield f.name, f.read_bytes()


class SpotifyExport(Connector):
    def discover(self, con):
        return {"status": "export required",
                "found": "request 'extended streaming history' in spotify privacy settings, then drop the zip in the inbox"}

    def sync(self, ctx: Ctx):
        for f in export_files(ctx, ["*.zip", "*.json"]):
            h = ctx.file_changed(f)
            if not h:
                continue
            agg = defaultdict(lambda: {"plays": 0, "ms": 0, "tracks": defaultdict(int)})
            found = False
            for name, raw in _members(f, SPOTIFY_NAMES):
                found = True
                for e in json.loads(raw.decode("utf-8", "ignore")):
                    ts = e.get("ts") or e.get("endTime")
                    artist = e.get("master_metadata_album_artist_name") or e.get("artistName")
                    track = e.get("master_metadata_track_name") or e.get("trackName")
                    ms = e.get("ms_played") or e.get("msPlayed") or 0
                    if not ts or not artist or ms < 30000:  # under 30 s is a skip, not a listen
                        continue
                    a = agg[(ts[:7], artist)]
                    a["plays"] += 1
                    a["ms"] += ms
                    a["tracks"][track] += 1
            if not found:
                continue
            for (month, artist), a in agg.items():
                top = sorted(a["tracks"].items(), key=lambda x: -x[1])[:5]
                ctx.put(f"spotify:{month}:{artist}", "listening", f"{month}-01T00:00:00+00:00",
                        f"{artist} in {month}", " ".join(t for t, _ in top),
                        {"artist": artist, "month": month, "plays": a["plays"], "minutes": round(a["ms"] / 60000),
                         "top_tracks": top, "coverage": "official export", "archive": f.name})
            ctx.mark_file(f, h)
            ctx.con.commit()
            ctx.log(f"{f.name}: {len(agg)} artist-months")


class SpotifyApi(Connector):
    """official web api with oauth pkce. needs a spotify developer app client id (no secret)."""

    SCOPES = "user-top-read user-read-recently-played user-library-read playlist-read-private user-follow-read"

    def discover(self, con):
        if not config.SPOTIFY_CLIENT_ID:
            return {"status": "authorization required",
                    "found": "needs a spotify developer app client id (ML_SPOTIFY_CLIENT_ID) before oauth can start"}
        tok = db.get_meta(con, "spotify_token")
        return {"status": "connected" if tok else "available to connect", "found": "spotify web api ready"}

    @staticmethod
    def auth_url(con) -> str:
        verifier = secrets.token_urlsafe(64)
        state = secrets.token_urlsafe(16)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        db.set_meta(con, "spotify_pkce", {"verifier": verifier, "state": state})
        q = urllib.parse.urlencode({"client_id": config.SPOTIFY_CLIENT_ID, "response_type": "code",
                                    "redirect_uri": config.SPOTIFY_REDIRECT, "code_challenge_method": "S256",
                                    "code_challenge": challenge, "scope": SpotifyApi.SCOPES, "state": state})
        return f"https://accounts.spotify.com/authorize?{q}"

    @staticmethod
    def _token_req(data: dict) -> dict:
        req = urllib.request.Request("https://accounts.spotify.com/api/token", data=urllib.parse.urlencode(data).encode(),
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())

    @staticmethod
    def finish(con, code: str, state: str):
        p = db.get_meta(con, "spotify_pkce") or {}
        if not p or p.get("state") != state:
            raise ValueError("state mismatch")
        tok = SpotifyApi._token_req({"grant_type": "authorization_code", "code": code, "redirect_uri": config.SPOTIFY_REDIRECT,
                                     "client_id": config.SPOTIFY_CLIENT_ID, "code_verifier": p["verifier"]})
        tok["expires_at"] = time.time() + tok.get("expires_in", 3600) - 60
        db.set_meta(con, "spotify_token", tok)  # stored in the private data dir only, never logged
        db.set_meta(con, "spotify_pkce", None)

    def _get(self, con, path):
        tok = db.get_meta(con, "spotify_token")
        if not tok:
            raise RuntimeError("not authorized")
        if time.time() > tok["expires_at"]:
            new = self._token_req({"grant_type": "refresh_token", "refresh_token": tok["refresh_token"],
                                   "client_id": config.SPOTIFY_CLIENT_ID})
            tok.update(new)
            tok["expires_at"] = time.time() + new.get("expires_in", 3600) - 60
            db.set_meta(con, "spotify_token", tok)
        req = urllib.request.Request(f"https://api.spotify.com/v1/{path}", headers={"Authorization": f"Bearer {tok['access_token']}"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    return json.loads(r.read())
            except urllib.error.HTTPError as e:
                if e.code == 429:  # rate limit, wait as told
                    time.sleep(int(e.headers.get("Retry-After", "5")))
                    continue
                raise
        raise RuntimeError("spotify rate limit")

    def sync(self, ctx: Ctx):
        stamp = time.strftime("%Y-%m")
        for rng in ("short_term", "medium_term", "long_term"):
            arts = self._get(ctx.con, f"me/top/artists?limit=50&time_range={rng}")["items"]
            for i, a in enumerate(arts):
                ctx.put(f"top-artist:{rng}:{stamp}:{a['id']}", "top_artist", time.strftime("%Y-%m-%dT00:00:00+00:00"),
                        a["name"], " ".join(a.get("genres", [])),
                        {"artist": a["name"], "rank": i + 1, "range": rng, "genres": a.get("genres", []),
                         "coverage": "spotify api top list, not full history"})
        for p in self._get(ctx.con, "me/player/recently-played?limit=50")["items"]:
            t = p["track"]
            ctx.put(f"recent:{p['played_at']}", "play", p["played_at"], t["name"], t["artists"][0]["name"],
                    {"artist": t["artists"][0]["name"], "coverage": "last 50 plays only"})
        ctx.con.commit()


class GoogleTakeout(Connector):
    def discover(self, con):
        return {"status": "export required",
                "found": "export youtube and calendar from takeout.google.com, then drop the zip in the inbox"}

    def sync(self, ctx: Ctx):
        for f in export_files(ctx, ["takeout-*.zip", "*.zip"]):
            h = ctx.file_changed(f)
            if not h:
                continue
            if f.suffix != ".zip":
                continue
            with zipfile.ZipFile(f) as z:
                names = z.namelist()
                if not any(n.startswith("Takeout/") for n in names):
                    continue
                watch = defaultdict(lambda: {"n": 0, "titles": []})
                for n in names:
                    low = n.lower()
                    if low.endswith("watch-history.json"):
                        for e in json.loads(z.read(n)):
                            ch = ((e.get("subtitles") or [{}])[0]).get("name") or "unknown channel"
                            w = watch[(e.get("time", "")[:7], ch)]
                            w["n"] += 1
                            if len(w["titles"]) < 5:
                                w["titles"].append(re.sub(r"^Watched ", "", e.get("title", "")))
                    elif low.endswith("subscriptions.csv"):
                        for line in z.read(n).decode("utf-8", "ignore").splitlines()[1:]:
                            parts = line.split(",")
                            if len(parts) >= 3:
                                ctx.put(f"yt-sub:{parts[0]}", "subscription", None, parts[2], "", {"channel": parts[2]})
                    elif low.endswith(".ics") and "calendar_events" in ctx.categories:
                        from .files import parse_ics
                        for ev in parse_ics(z.read(n).decode("utf-8", "ignore")):
                            ctx.put(f"cal:{ev['uid']}", "event", ev["start"], ev["summary"], ev.get("description", "")[:500],
                                    {"calendar": n.split("/")[-1]})
                    elif ("my activity/search" in low and low.endswith(".json")) and "search_history" in ctx.categories:
                        for e in json.loads(z.read(n)):
                            ctx.put(f"search:{e.get('time')}", "search", e.get("time"),
                                    re.sub(r"^Searched for ", "", e.get("title", "")), "", {}, sensitive=True)
                for (month, ch), w in watch.items():
                    ctx.put(f"yt:{month}:{ch}", "watching", f"{month}-01T00:00:00+00:00", f"{ch} in {month}",
                            " ".join(w["titles"]), {"channel": ch, "month": month, "videos": w["n"],
                                                    "coverage": "takeout watch history"})
            ctx.mark_file(f, h)
            ctx.con.commit()
            ctx.log(f"{f.name}: takeout processed")
