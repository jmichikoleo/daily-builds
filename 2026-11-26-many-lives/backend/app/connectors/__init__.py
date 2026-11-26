# backend/app/connectors/__init__.py: the registry of every source the studio knows about.
# implemented=False entries are honest placeholders: the studio shows them as unsupported with the reason.
from .base import Connector
from .code import GitHub, GitLocal, ProjectDocs
from .conversations import ChatGPTExport, ClaudeCode, ClaudeExport
from .files import Documents, Zotero
from .media import GoogleTakeout, SpotifyApi, SpotifyExport

ROOTS = ["~/Desktop/mochis-project", "~/Developer", "~/Documents"]

REGISTRY: list[Connector] = [
    GitHub("github", "github", "code", "cli", "existing gh sign in (read only api calls)",
           ["repositories", "descriptions", "languages", "topics", "monthly contributions"],
           "read only. private repos only if you tick them", "lists every repo and the contribution calendar",
           "upserts by repo name and month, unchanged rows are skipped by hash", interval_hours=24,
           categories=[{"id": "private_repos", "label": "include private repositories (names and descriptions only)", "default": True}]),
    GitLocal("git_local", "local git history", "code", "local", "none, reads folders you approve",
             ["repositories", "commit messages and dates", "tags and releases", "change size"],
             "read only git log. no source code is read", "full git log per repo",
             "remembers each repo's last commit and only reads newer ones", interval_hours=24, needs_paths=True,
             suggested_paths=ROOTS[:2]),
    ProjectDocs("project_docs", "project notes and readmes", "projects", "local", "none, reads folders you approve",
                ["readmes", "plans", "progress notes", "release notes"],
                "read only. only readme, plan, progress and release style files at a repo root or docs/",
                "reads each matching file once", "file size, time and sha256 per file", interval_hours=24,
                needs_paths=True, suggested_paths=ROOTS[:2]),
    ClaudeCode("claude_code", "claude code sessions", "conversations", "local", "none, but needs your folder approval",
               ["your prompts (not replies)", "session titles", "project folders", "dates"],
               "reads ~/.claude/projects session logs. tool output and replies are not stored",
               "one record per session", "file size, time and sha256 per session log", interval_hours=24,
               needs_paths=True, suggested_paths=["~/.claude/projects"], privacy="sensitive",
               notes="these logs can contain anything you pasted. secrets are redacted but read the preview first"),
    ChatGPTExport("chatgpt_export", "chatgpt export", "conversations", "export", "official data export from chatgpt settings",
                  ["conversation titles", "your messages", "dates", "branches"],
                  "only the zip you drop in the inbox", "parses conversations.json or chat.html",
                  "each archive hash is imported once. same conversations are upserted", interval_hours=1, privacy="sensitive",
                  notes="openai offers no api for your chatgpt history. settings, data controls, export data"),
    ClaudeExport("claude_export", "claude.ai export", "conversations", "export", "official data export from claude.ai settings",
                 ["conversation titles", "your messages", "dates"], "only the zip you drop in the inbox",
                 "parses conversations.json", "archive hash", interval_hours=1, privacy="sensitive",
                 notes="separate from claude code sessions"),
    SpotifyExport("spotify_export", "spotify streaming history", "music", "export", "official privacy data export",
                  ["plays by artist and month", "top tracks per month", "minutes"], "only the zip you drop in the inbox",
                  "aggregates every play over 30 s", "archive hash", interval_hours=1,
                  notes="ask for extended streaming history for your whole life, the basic one covers one year"),
    SpotifyApi("spotify_api", "spotify live", "music", "oauth", "oauth pkce with your own spotify developer app",
               ["top artists (3 ranges)", "last 50 plays"], "read only scopes",
               "top lists and recent plays", "daily snapshot of top lists", interval_hours=24, implemented=True,
               validated="not validated. needs a client id", notes="the api never gives full history. use the export for that"),
    GoogleTakeout("google_takeout", "google takeout", "google", "export", "official takeout archive",
                  ["youtube watch history by channel and month", "youtube subscriptions", "calendar events", "search history (off)"],
                  "only the takeout zip you drop in the inbox", "selective, only the files above are opened",
                  "archive hash", interval_hours=1,
                  categories=[{"id": "calendar_events", "label": "calendar events", "default": True},
                              {"id": "search_history", "label": "search history (sensitive)", "default": False}]),
    Documents("documents", "personal folders", "files", "local", "none, reads folders you approve",
              ["notes", "writing", "lyrics", "journals", "research pdfs", "docx", "calendars", "bibtex and ris", "photo names and dates"],
              "read only. secrets, keys and system folders are always skipped", "walks approved folders (5 levels)",
              "file size, time and sha256 per file", interval_hours=6, needs_paths=True,
              suggested_paths=["~/Documents", "~/Desktop", "~/Downloads"], privacy="sensitive",
              notes="downloads holds official forms and other people's files. approve narrow folders"),
    Zotero("zotero", "zotero", "academic", "local", "none, reads the local library read only", ["papers", "abstracts"],
           "read only sqlite", "reads every item", "upsert by item key", interval_hours=24),
]

PLANNED = [
    ("google_oauth", "google calendar, drive, youtube (live)", "google", "needs a google cloud oauth client. takeout works today"),
    ("orcid", "orcid and crossref", "academic", "planned. needs your orcid id"),
    ("pinterest", "pinterest", "optional", "planned. export based"),
    ("letterboxd", "letterboxd", "optional", "csv export works today through personal folders"),
    ("goodreads", "goodreads", "optional", "csv export works today through personal folders"),
    ("apple_music", "apple music", "optional", "no personal history api. apple privacy export is planned"),
    ("apple_photos", "apple photos", "optional", "needs photos library permission. not built"),
    ("apple_health", "apple health", "sensitive", "off by default, not built"),
    ("screen_time", "screen time", "sensitive", "no supported export. not built"),
    ("discord", "discord", "optional", "data package import planned, your own messages only"),
    ("bookmarks", "browser bookmarks", "optional", "export an html bookmarks file into a personal folder"),
    ("browser_history", "browser history", "sensitive", "off by default, not built"),
    ("shopping", "shopping records", "sensitive", "off by default, not built"),
    ("finance", "financial records", "sensitive", "off by default, not built"),
]

BY_ID = {c.id: c for c in REGISTRY}
