# data sources

the acquisition order is local data first, then existing sign ins, official apis, oauth, official exports, and manual drop as the fallback. nothing is read before approval. folder based sources only read the folders approved in the studio.

## capability matrix

| source | method | status on 2026-11-26 | what it reads | incremental by |
| --- | --- | --- | --- | --- |
| github | existing `gh` sign in, read only rest and graphql | **implemented, validated** with the real account (84 repos plus monthly contributions) | names, descriptions, languages, topics, dates, private flag, contribution calendar | upsert by repo name and month, hash skip |
| local git history | `git log` in approved folders | **implemented, validated** (22 repos, about 1000 commits) | commit subject, date, author, change size, tags, root commit | last seen commit per repo |
| project notes and readmes | read files in approved repos | **implemented, validated** (117 docs) | readme, plan, progress, release style files at repo root or `docs/` | size, mtime, sha256 |
| claude code sessions | read `~/.claude/projects/*/*.jsonl` | **implemented, tested on a real log during development, waiting for your folder approval** | your own prompts, session title, project folder, dates. replies and tool output are not stored | sha256 per log |
| chatgpt export | official export zip in the inbox | **implemented, tested with fixtures**. no real export present yet | conversation titles, your messages, dates, branch count | archive hash |
| claude.ai export | official export zip in the inbox | **implemented, tested with fixtures** | titles, your messages, dates | archive hash |
| spotify history | official extended streaming history zip | **implemented, tested with fixtures** | plays over 30 s grouped by artist and month, top tracks | archive hash |
| spotify live | oauth pkce, read only scopes | **built, not validated**. needs your own spotify developer client id | top artists in 3 ranges, last 50 plays. never full history | daily snapshot |
| google takeout | official takeout zip | **implemented, tested with fixtures** | youtube watch history by channel and month, subscriptions, calendar ics. search history off unless ticked | archive hash |
| personal folders | read approved folders | **implemented, tested with fixtures** | md, txt, json, csv, html, xml, ics, pdf, docx, bib, ris, zip listings, photo names and dates (no pixels, no exif location) | size, mtime, sha256 |
| zotero | read only sqlite | **implemented, not validated**. no zotero library on this mac | titles, abstracts | upsert by item key |

## not built, or not possible (shown honestly in the studio)

| source | why |
| --- | --- |
| google calendar, drive, youtube live | needs a google cloud oauth client. takeout covers the history today |
| orcid and crossref | planned, needs your orcid id |
| pinterest | export based, planned |
| letterboxd, goodreads | their csv exports already work through personal folders |
| apple music | no personal history api |
| apple photos | needs photos library permission, not built |
| discord | data package importer planned, own messages only |
| browser bookmarks | export the html bookmarks file into an approved folder |
| apple health, screen time, browser history, shopping, finance | sensitive. off by default, not built |

## what you still need to do

1. **claude code sessions.** open sources, claude code sessions, approve `~/.claude/projects`, then sync. preview before keeping.
2. **chatgpt.** chatgpt settings, data controls, export data. when the mail arrives, drop the zip into the inbox folder shown in the studio.
3. **claude.ai.** settings, privacy, export data. same inbox.
4. **spotify.** spotify account privacy page, request extended streaming history. it can take up to 30 days. same inbox. for the live api, create a spotify developer app with redirect `http://127.0.0.1:4686/api/spotify/callback` and set `ML_SPOTIFY_CLIENT_ID`.
5. **google.** takeout.google.com, pick youtube and calendar. same inbox.
6. **personal folders.** approve narrow folders only, like a notes or lyrics folder. downloads holds official forms and other people's files, so it is not suggested as a whole.

the inbox folder for the live install is `~/Library/Application Support/many-lives/inbox`.
