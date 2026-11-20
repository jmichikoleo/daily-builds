# jarvis

a small click-to-talk console for claude code and codex. click the ring, talk, click again. the words go to the agent in the project you picked and the reply streams back.

the bridge runs on the mac mini. windows and the mac both open the same private https address through tailscale. the mic records on whichever computer you click on.

## try it first with the mock

```bash
npm install
npm run mock
```

then open http://localhost:8470/auth?token=mock-token-for-local-testing-only once. if the real bridge is already running on 8470, start the mock with `JARVIS_PORT=8471` and use that port. that sets a cookie and drops you on the console. the mock agent streams fake replies, asks for an approval when you say fix or edit, and fakes the transcript. nothing touches your real projects.

## set it up for real

1. copy the example config

```bash
cp jarvis.config.example.json jarvis.config.json
```

2. edit `jarvis.config.json`
   - put your tailnet login in `auth.allowedLogins`. `tailscale whois $(tailscale ip -4)` shows it, it looks like `you@github`. on this mini the cli lives at `/Applications/Tailscale.app/Contents/MacOS/Tailscale`
   - add each project as an id, a name and an absolute path on the mac mini. the browser only ever sends the id. the bridge checks every path when it starts and refuses anything missing, relative, `/` or your home folder
   - point `agents.claude.executable` and `agents.codex.executable` at the real binaries (`which claude`, `which codex`)

3. build the page and start the bridge

```bash
npm run build
```

```bash
npm start
```

the bridge only listens on 127.0.0.1. it never opens a public port.

4. put it on your tailnet with tailscale serve. this uses https port 8480, pick any free one

```bash
tailscale serve --bg --https=8480 http://127.0.0.1:8470
```

5. open `https://<your-mini>.ts.net:8480` on windows and on the mac. same address on both. allow the mic when the browser asks

### make it a small window

a normal browser tab can't get smaller than about 500 wide, so install jarvis as an app. it then opens in its own window with no tabs or toolbar, shrinks to about 240 by 160 when collapsed and grows when you press e

- chrome or edge. open the menu, then cast, save and share, then install page as app. edge calls it apps, install this site as an app
- safari on the mac. file, add to dock

the console always fills its window, so a bigger window just gets a bigger ring

serve sends a `Tailscale-User-Login` header for people on your tailnet and strips any copy a client sends. the bridge only lets in logins from `allowedLogins`, so tagged devices and other users get a 401. never use `tailscale funnel` for this, that makes it public.

### keep it running

`scripts/com.mochi.jarvis.plist` is a launchd template. swap `/Users/you` for your home folder, copy it to `~/Library/LaunchAgents/` and load it

```bash
launchctl load ~/Library/LaunchAgents/com.mochi.jarvis.plist
```

logs go to `~/Library/Logs/jarvis.log`. if claude says it isn't signed in when started this way, run `npm start` from a terminal tab instead.

## voice with whisper.cpp

transcription runs on the mac mini. without it the ring shows an error and you can still type.

```bash
brew install whisper-cpp
```

```bash
mkdir -p ~/.jarvis/models && curl -L -o ~/.jarvis/models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

then set `transcription.command` to `/opt/homebrew/bin/whisper-cli` and `transcription.model` to the file you downloaded, and restart the bridge. `ggml-small.en.bin` is slower but catches more. set `"backend": "none"` to turn voice off.

the browser records raw audio and sends a 16 khz wav, so chrome, edge and safari all work the same and no ffmpeg is needed. the bridge writes it to a temp folder, runs whisper, and deletes it right after. the mic only turns on after you click the ring and turns off on the second click.

## using it

- click the ring to talk, click again to send. space or enter does the same when the ring has focus. esc throws the recording away
- the top row shows the project and the agent. cc is claude code, cx is codex. your last pick is remembered on each computer
- the dot in the top row is the bridge link. blue is fine, amber is reconnecting, red is down
- e opens the full view with the conversation, an editable transcript box, stop and new session
- turn on review before sending if you want to fix the transcript first
- when an agent wants to run a command or edit a file the ring turns amber and allow and deny show up right in the small view

## how sessions work

every project and agent pair has its own session. a voice follow-up continues the session jarvis started there. switching agents switches the conversation. new session forgets the old one for that pair only. jarvis never attaches to a claude or codex session you have open in a terminal, it only continues the ones it started.

one project runs one thing at a time. a second submit while it's busy is refused, and a retried submit with the same request id returns the same run instead of starting another. if the page loses the bridge it reconnects, replays what it missed and never resends your prompt.

## permissions

- claude code runs through the agent sdk using your installed `claude` binary, in the project folder, with your user, project and local settings and your claude.md. its normal permission prompts come to the console as allow or deny. questions and plan approvals can't be passed along yet, so jarvis says so and you finish those in a terminal with `claude --resume`
- codex runs `codex app-server` in the project folder with your own `~/.codex/config.toml`. command and file approvals come to the console. extra sandbox permission requests and questions are declined with a note pointing you to a codex terminal
- the config refuses `bypassPermissions`, `danger-full-access` and `never` approvals. there is no shell endpoint. agents are started straight from their binary with fixed arguments and a folder the bridge picks

## checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
node scripts/smoke.ts claude
```

```bash
node scripts/smoke.ts codex
```

the smoke script makes a throwaway folder, asks for a harmless reply, resumes the session, asks to write a file and denies it, then cancels a long reply.
