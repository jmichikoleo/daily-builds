# the many lives of me

a private universe built from my own records. an interactive map with five places and one hidden room.

- **the multiverse** has alternate versions of me, found in the evidence and given fictional rooms
- **the museum** holds artifacts and exhibitions made from projects, releases, writing and conversations
- **the archive** keeps dossiers by a dry historian, with facts, statistics, interpretations, commentary and uncertainties kept apart
- **the library** is an autobiography in volumes and chapters that i can rewrite without it ever being overwritten
- **the observatory** shows the real knowledge graph as a sky, with a time slider
- **the unknown room** holds gaps, contradictions and questions only i can answer

it runs on the mac mini, only on 127.0.0.1, and reaches my devices through tailscale serve. nothing is public.

## run it for development

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install fastapi uvicorn scikit-learn pypdf python-docx pytest httpx
cd ../frontend && npm install && npm run build
node ../scripts/dev.mjs
```

then open http://127.0.0.1:4686. development data lives in `~/Library/Application Support/many-lives-dev`, never in the repo. the demo universe of a made up person called pip is one click away in the top bar.

for frontend work also run `npm run dev` in `frontend/` (vite on :4687 talks to the api on :4686).

## tests

```bash
cd backend && .venv/bin/python -m pytest -q
cd frontend && npm run typecheck
```

## documents

- [ARCHITECTURE.md](ARCHITECTURE.md) how the pieces fit
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) phases and what each one delivered
- [DATA_SOURCES.md](DATA_SOURCES.md) connector capability matrix, implemented versus unsupported
- [DATA_SCHEMA.md](DATA_SCHEMA.md) tables and derived objects
- [PRIVACY.md](PRIVACY.md) privacy and security model
- [DEPLOYMENT.md](DEPLOYMENT.md) the live install, backups and restore
- [PROGRESS.md](PROGRESS.md) where things stand

personal data, generated chapters and credentials never go into this repo. `.gitignore` blocks sqlite files and env files.
