# progress

## 2026-11-26, first build, live

**live** at https://your-mac.your-tailnet.ts.net:8680 (tailnet only). launchd `com.mochi.many-lives`, data in `~/Library/Application Support/many-lives`.

connected in the live universe, all read only
- github through gh (84 repos incl. private names and descriptions, monthly contributions)
- local git history in `~/Desktop/mochis-project` and `~/Developer` (22 repos, about 1000 commits)
- project notes and readmes in the same folders (119 docs)

result on the first build. 1195 records, 9 interests, 66 projects, 8 eras, 8 selves, 68 artifacts, 13 discoveries.

### verified
- 9 backend tests pass (`backend/tests/test_core.py`), frontend typecheck and build clean
- live sync ran inside the launchd process, so macos let it read the desktop folders
- tailnet request with your login gets 200, spoofed or missing login gets 403, writes without `x-ml` get 403
- every destination opened in the browser pane at desktop size, universe and observatory also at 375 px with no sideways scroll
- observatory node panel, evidence drawer, search questions (earliest first, month ranges, forgotten projects, korean alias 논문 to paper)

### not verified
- the scheduled nightly backup at 4 has not run yet. manual backup and restore are tested in the test suite only, not on the live file
- chatgpt, claude.ai, spotify and takeout importers are tested on fixture files shaped like the official exports, never on your real archives
- spotify oauth was never run, there is no client id
- zotero reader never ran, no library on this mac
- claude code importer ran only in development on this machine's logs, not in the live universe (needs your approval)
- not opened on a real iphone or ipad, only the emulated phone width
- no screen reader pass. keyboard focus, labels and reduced motion are in place but untested with voiceover

### known rough edges
- interest labels are the topic model's top two words, so with only code sources they read like commit jargon ("classic & composer"). rename them, or connect conversations and notes
- era names come from templates, some are odd ("the projects era"). rename them in the library
- committed locally as 89e9dbb on 2026-11-26. no remote. the public daily-builds copy has the tailnet hostname scrubbed
