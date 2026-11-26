# implementation plan

| phase | scope | state |
| --- | --- | --- |
| 0 environment and discovery | inspected the mac mini (m4 pro, 48 gb), node 26, python 3.13, gh signed in, tailscale serve in use on 8443 to 8660, ollama installed with only a vision model and not running, orbstack off, mochi cloud is a file store with no query api. 22 local repos, 117 project docs, 65 claude code logs found. no chatgpt, spotify or takeout exports on disk | done |
| 1 universe foundation | fastapi + sqlite backend, react frontend, universe map with pan, zoom, pinch, satellites, sparkles, time dial, snapshots, trail. all destinations laid out. private auth through tailscale identity. demo universe | done |
| 2 data acquisition | connector framework, studio with discovery, approval, categories, preview, pause, disconnect, delete, sync log. github, local git, project docs, claude code, chatgpt, claude.ai, spotify export, spotify oauth, google takeout, personal folders (all listed formats), zotero. background scheduler, inbox for exports | done. claude code waits for your approval, exports wait for you to request them |
| 3 intelligence | normalisation, multilingual tokens and aliases, tf-idf + nmf interests, entity resolution, eras, graph, constellations, discoveries, provenance on every object | done |
| 4 destinations | multiverse, museum, archive, library, observatory, all cross linked through shared evidence | done |
| 5 advanced exploration | unknown room, time travel, global search, discovery inbox, owner editing everywhere, chapter versions, corrections feeding the pipeline, markdown, html and print exports | done. personal collections have a table but no ui |
| 6 validation and deployment | 9 backend tests (formats, incremental, duplicates, provenance, edits survive rebuilds, rejection sticks, source deletion, guard, backup and restore, demo isolation), typecheck, browser checks desktop and mobile, live on launchd + tailscale serve | done, see PROGRESS.md for what was not verified |

## next, in order

1. approve claude code sessions in the studio. it is the richest local source and will make interests read like your words instead of commit jargon.
2. request the chatgpt, claude.ai, spotify and takeout exports and drop them in the inbox.
3. optional local llm narration with ollama (a text model such as qwen2.5 7b), behind the rules in PRIVACY.md, for chapter prose and self biographies. keep the deterministic draft as the fallback.
4. semantic search with a local embedding model, stored next to fts5.
5. off machine copy of `~/Backups/many-lives`.
6. a ui for personal collections and an artifact merge or split tool for selves.
