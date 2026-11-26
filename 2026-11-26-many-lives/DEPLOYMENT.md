# deployment

## the live install (2026-11-26)

| piece | value |
| --- | --- |
| url | https://your-mac.your-tailnet.ts.net:8680 (tailnet only, your login only) |
| process | launchd agent `com.mochi.many-lives` runs `node scripts/serve.mjs`, which supervises uvicorn on 127.0.0.1:4680 with `--no-proxy-headers` |
| plist | `~/Library/LaunchAgents/com.mochi.many-lives.plist` (template without the login in `scripts/launchd/`) |
| data | `~/Library/Application Support/many-lives/universe.sqlite`, demo in `demo/`, export inbox in `inbox/` |
| logs | `~/Library/Logs/many-lives/server.log` |
| backups | `~/Backups/many-lives`, nightly at 4 by the in app scheduler, 14 scheduled kept |
| tailscale | `tailscale serve --bg --https=8680 http://127.0.0.1:4680` |

`--no-proxy-headers` matters. without it uvicorn rewrites the client address from `x-forwarded-for` and the loopback check fails for every tailnet request.

the live agent serves `frontend/dist` from this folder, so `npm run build` in `frontend/` is live right away. python changes need a restart.

## everyday commands

```bash
launchctl kickstart -k gui/$(id -u)/com.mochi.many-lives
```

```bash
tail -f ~/Library/Logs/many-lives/server.log
```

```bash
cd ~/Desktop/mochis-project/many-lives/frontend && npm run build
```

## backup and restore

from the app, sources, backups and audit, back up now or restore. restore checks the backup's integrity, saves the current universe as `universe-before-restore-*.sqlite`, then copies the backup in page by page with the sqlite backup api.

by hand, with the agent stopped

```bash
launchctl bootout gui/$(id -u)/com.mochi.many-lives
```

```bash
sqlite3 ~/Backups/many-lives/universe-manual-YYYYMMDD-HHMMSS.sqlite ".backup '$HOME/Library/Application Support/many-lives/universe.sqlite'"
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mochi.many-lives.plist
```

backups stay on this mac. copying `~/Backups/many-lives` somewhere off the machine (icloud, like research lab does) is not set up yet.

## remove it completely

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=8680 off
```

```bash
launchctl bootout gui/$(id -u)/com.mochi.many-lives
```

then delete the plist and, only if you mean it, `~/Library/Application Support/many-lives`.

## docker

not used. orbstack was off and one python process does not need a container. the stack has no system dependencies beyond python 3.13, node and git.
