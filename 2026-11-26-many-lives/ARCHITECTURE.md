# architecture

one python process and one static frontend. the simplest thing that covers the whole vision on one mac mini.

```
 your devices ──tailnet──> tailscale serve https :8680 ──> 127.0.0.1:4680  (launchd com.mochi.many-lives, node supervisor)
                                                              │
                                    fastapi  backend/app/main.py  (api + built frontend from frontend/dist)
                                        │            │                         │
                              connectors/*      sync.py scheduler thread   pipeline.py (intelligence)
                                        │            │                         │
                                        └──── sqlite universe.sqlite (wal, fts5) ┘   ~/Library/Application Support/many-lives
                                                     demo/universe.sqlite (pip, fictional)
```

## why this stack

- **python for ingestion and intelligence.** git, zip archives, pdf and docx extraction and scikit-learn all sit naturally here.
- **sqlite instead of postgres.** one owner, a few hundred thousand rows at most, wal mode, fts5 for search. backups are a single consistent file. postgres would add a service to babysit for no gain.
- **mochi cloud is not the database.** it is a fastify file store with its own auth (see `../cloud`). it has no query layer, so structured data stays in sqlite. raw exports stay where you dropped them and are only read, never copied into mochi cloud. a later phase could archive original export zips there.
- **react + vite, plain css.** each place has its own paper, ink and type. fonts are bundled so no font cdn sees the page.
- **no external ai by default.** the pipeline is deterministic and statistical. ollama is installed on the mac mini but only a vision model (qwen2.5vl) was present and the server was off, so no local llm is wired in yet. see PRIVACY.md for the rules an llm step must follow when it is added.

## the flow of a record

1. a connector (`backend/app/connectors/`) reads an approved source and writes through `Ctx.put()`. text is redacted, content is hashed, unchanged rows are skipped, so every sync is idempotent and incremental. files are tracked by size, mtime and sha256, git repos by last seen commit, exports by archive hash.
2. a successful sync with changes marks the universe dirty. the scheduler (or the sync button) runs `pipeline.build()`.
3. `pipeline.build()` reads raw records and rebuilds every derived object from scratch in about a second. derived rows are keyed by stable keys, so the owner's notes, renames, edits, curation and discovery states (separate tables) reattach after every rebuild.
4. the api applies owner annotations on read and returns objects that always carry evidence ids. `/api/evidence` resolves them back to the original records.

## the intelligence pipeline (the agents, as plain functions)

| role | function | method |
| --- | --- | --- |
| normaliser | `load`, `build_units` | commits grouped per repo and month, plays per month, cloned repos merged by root commit, duplicate shas dropped |
| topic finder | `discover_interests` | tf-idf over units with a multilingual tokenizer (english, indonesian, korean, alias folding), nmf topics |
| entity resolver | `build_projects` | `normalize_name` joins local folders, github repos, docs and sessions. root commit joins clones |
| change point finder | `build_eras` | monthly interest vectors, a new era when cosine similarity to the running era drops below 0.3, gaps of 2 plus empty months |
| worldbuilder | `build_selves` | interests mapped to archetypes by keyword overlap, plus a night self from timestamps and a keeper self for abandoned projects. lore is template fiction, labelled |
| curator | `build_artifacts`, `build_exhibitions` | projects, first releases, writing, long conversations, era songs. stable accession numbers |
| astronomer | `build_graph` | co-occurrence jaccard between interests, project to interest weights, constellations as connected components |
| investigator | `build_discoveries` | talked before built, cross source interests, returning interests, forgotten projects, burst months, shared rooms, twin births. capped per family, rejected ones suppressed |
| archivist | `build_reports` | dossiers per interest, hours, contradictions (documented live but silent), eras, coverage |
| biographer | `build_chapters` | era chapters and year retrospectives as typed blocks (fact, stat, discovery, owner, interpretation) with evidence. versions stored when the draft changes |
| fact checker | structural | every block, discovery and report carries record ids, and tests check every evidence id resolves |

user corrections feed back in. rejecting an interest bans its words from the topic vocabulary, rejecting a discovery keeps it from returning, memories and answers from the unknown room are evidence marked as the owner's own words.

## frontend

`frontend/src/pages/` has one file per place. `components/Art.tsx` is the illustration system (objects, doors, rooms, place drawings, all inline svg). `components/Evidence.tsx` is the shared evidence drawer and the fact or fiction tags. routing is hash based.
