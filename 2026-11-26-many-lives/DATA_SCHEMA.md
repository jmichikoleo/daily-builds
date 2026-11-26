# data schema

all of it is in one sqlite file, `universe.sqlite`, created by `backend/app/db.py`. the layers never mix.

## imported (evidence)

| table | purpose |
| --- | --- |
| `source` | per connector state. enabled, paused, approved_at, categories (sub permissions), last and next sync, last error, record count, earliest and latest dates |
| `approved_path` | folders the owner approved per source |
| `raw_record` | one row per source item. `source_id` + `ext_id` is the provenance key. `ts` original time, `imported_at`, `updated_at`, `content_hash`, `processing_version`, `sensitive`, `hidden`, `meta` json |
| `file_index` | path, size, mtime and sha256 per file per source, for change detection |
| `sync_job` | every run, its reason (manual or scheduled), counts, error and log |
| `meta` | cursors (`cursor:<source>:<key>`), pipeline stats, the dirty flag, the global pause, oauth tokens |

## derived (rebuilt by the pipeline, never edited by hand)

`derived(type, key, title, ts_start, ts_end, data)` holds every derived object as json. types are

| type | maps to the spec's |
| --- | --- |
| `interest` | Interest, Topic |
| `project` | Project, Entity |
| `era` | Era |
| `self` | AlternateSelf |
| `artifact` | Artifact |
| `exhibition` | Exhibition |
| `constellation` | Constellation |
| `discovery` | Discovery |
| `report` | ArchiveReport |
| `chapter` | AutobiographyChapter |
| `question` | unknown room prompts |
| `gap` | missing periods |

each object keeps `evidence` (raw record ids, negative ids are owner memories), dates, sources and, where it fits, a confidence. `edge(a, b, kind, weight, why)` is the Relationship table for the knowledge graph. `accession(key, number)` keeps museum numbers stable across rebuilds. `search_index` is fts5 over raw records and derived objects.

## owner layer (never rebuilt)

| table | purpose |
| --- | --- |
| `annotation(target, field, value)` | UserAnnotation. renames, rewritten descriptions, favourites, hidden flags |
| `chapter_text` | your version of a chapter, kept apart from the draft |
| `chapter_version` | version history of drafts and your edits |
| `exhibition_curation` | your titles, intros and artifact order, and exhibitions you made |
| `discovery_state` | new, seen, confirmed, corrected, saved, rejected, hidden, plus your note |
| `correction` | Evidence feedback. rejected interests and discoveries shape the next build |
| `memory` | your own memories and answers. they flow back in as evidence marked as your words |
| `collection` | personal collections (table ready, ui not built) |
| `snapshot` | UniverseSnapshot. one captured snapshot per build. reconstructions are computed on request and labelled |
| `visit` | exploration history |
| `audit` | every approval, sync, deletion, edit, export and restore |
