# privacy and security

this app holds the most personal data i have. privacy is part of the architecture, not a setting.

## who can reach it

- the server binds to 127.0.0.1 only. the middleware also refuses anything that is not loopback.
- tailnet devices reach it through `tailscale serve` (https, tailnet only, never funnel). serve adds `Tailscale-User-Login`. when a request came through the proxy, the login must equal `ML_OWNER_LOGIN`, which is set in the launchd plist and not in the repo. shared node users and anything else get 403.
- there is no registration and no password database.
- every write needs the `x-ml` header, which a cross site form cannot send. there is no cors. responses send a strict csp, `x-frame-options deny`, `no-referrer` and `no-store` for api calls.

## what is read

- read only, everywhere. originals are never modified, moved or deleted.
- folder sources read only approved folders. the home folder itself, `~/Library` (except this app's own folder), `.ssh`, `.gnupg` and keychains cannot be approved.
- files and folders never read, even inside approved folders: `.env*`, keys (`.pem`, `.key`, `.p12`, `id_rsa` ...), credentials and token files, cookie stores, `.git`, `node_modules`, build output, hidden folders.
- git sources read commit metadata, never source code. project docs are limited to readme, plan, progress and release style files.
- conversation sources keep only your own messages. assistant replies and tool output are counted, not stored.
- photos are names and dates only. no pixels, no exif location.
- google search history is off unless ticked. health, money, location, browser history and private messages are not connected at all.

## what is stored

- every text body passes `redact()` first. api keys, github, slack, aws and google keys, jwts, private key blocks, `password=` style values, emails, phone numbers, korean resident numbers and card like digit runs are replaced.
- files whose name or opening text looks like a passport, bank, tax, medical, insurance, visa or transcript document are marked sensitive. sensitive records are never turned into museum objects and their text is hidden in the evidence drawer.
- spotify oauth tokens, if you add them, sit in the private sqlite file under `~/Library/Application Support/many-lives`, which only your mac user can read.

## ai processing

- no external ai provider is called. there is no api key in the app.
- the pipeline is deterministic (tf-idf, nmf, counting, dates). generated text comes from templates over verified facts, so it cannot invent memories.
- if a local or external llm step is added later, it must get only the evidence excerpts for one object, after redaction, wrapped as data with an instruction that it is untrusted. it must answer in a schema that is validated, store its prompt version, and be switchable off per source. external providers stay off unless configured, and the studio must show which provider saw what.
- imported content is data. nothing in a record is ever executed or followed as an instruction.

## deletion and retention

- disconnect stops syncing and forgets approved folders. delete imported data removes every raw record, file index and cursor of that source, then rebuilds every derived object, graph edge and search entry, so nothing built from it survives.
- hide a single record from the studio preview and it drops out of the next build.
- backups run nightly at 4 to `~/Backups/many-lives` (14 scheduled kept, manual ones never deleted). a deletion is not retroactive into older backups. delete those files if you need it gone everywhere.

## never in git

`.gitignore` blocks `*.sqlite`, `.env*` and data folders. the repo has no remote. personal data, generated chapters and tokens live only under `~/Library/Application Support/many-lives`. the demo universe is a made up person and lives in its own database file.
