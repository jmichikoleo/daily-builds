# ✦ Folder Oracle ✦

Ask a folder a question. Folder Oracle ranks the text files inside it by relevance using BM25, implemented from scratch in pure Python, and shows you the passage that matters.

```
$ python3 oracle.py sample-notes "attention mechanism"
✦ FOLDER ORACLE ✦

Consulting the archives...
Query: "attention mechanism"

The oracle has spoken:

01. sample-notes/attention.md
    Relevance: 3.316
    "The attention mechanism allows a model to focus on
     relevant parts of an input when producing each part of
     its output. Instead of squeezing a whole sentence..."

02. sample-notes/transformers.md
    Relevance: 1.843
    "...Decoder layers add masked self-attention, so a
     position cannot peek at future tokens, plus
     cross-attention over the encoder output. Encoder-only
     models such as..."

✧ 2 relevant scrolls discovered.
```

## Features

- Real Okapi BM25 ranking (k1 = 1.5, b = 0.75) written from scratch, no libraries
- Recursive scan of `.txt`, `.md`, `.py` and `.json` files
- Best-passage snippets: picks the ~160 character window with the strongest query-term overlap
- `--top N` to control how many results you get (default 5)
- Skips `.git`, `node_modules`, `venv`, `.venv` and `__pycache__`, never follows directory symlinks
- Ignores binary, non-UTF-8, unreadable and very large (over 2 MB) files without crashing
- Read-only and fully offline: no network, no APIs, nothing executed or modified
- Quiet colors on real terminals, plain text when piped or when `NO_COLOR` is set

## Installation

Nothing to install. You only need Python 3.8 or newer (the one that ships with macOS works).

```bash
git clone https://github.com/jmichikoleo/daily-builds.git
cd daily-builds/2026-10-21-folder-oracle
python3 oracle.py sample-notes "how does attention work"
```

## Usage

```bash
python3 oracle.py <folder> "<query>" [--top N]

python3 oracle.py sample-notes "attention mechanism"
python3 oracle.py sample-notes "neural networks" --top 3
python3 oracle.py sample-notes "python"
python3 oracle.py ~/notes "how does attention work"
```

Exit codes: `0` results found, `1` no matches or no readable files, `2` bad arguments or folder.

Tip: add an alias so the oracle is always one word away.

```bash
alias oracle='python3 ~/Developer/daily-builds/2026-10-21-folder-oracle/oracle.py'
oracle ~/Documents/notes "exam schedule"
```

## How BM25 works

For a query with terms q1 ... qn, the score of a document D is

```
score(D, Q) = Σ  IDF(qi) · tf(qi, D) · (k1 + 1)
                 ─────────────────────────────────────────────
                 tf(qi, D) + k1 · (1 − b + b · |D| / avgdl)

IDF(qi) = ln( 1 + (N − df(qi) + 0.5) / (df(qi) + 0.5) )
```

| Symbol | Meaning |
| --- | --- |
| `tf(qi, D)` | Term frequency: how many times the term appears in the document |
| `df(qi)` | Document frequency: how many documents contain the term |
| `N` | Total number of documents scanned |
| `IDF` | Inverse document frequency: rare terms count more than common ones. The `1 +` inside the log keeps it nonnegative, so a matching term never lowers a score |
| `k1 = 1.5` | Term frequency saturation: the 10th mention of a word adds much less than the 2nd |
| `b = 0.75` | Length normalization strength: long documents do not win just by being long |
| `\|D\| / avgdl` | Document length compared with the average document length |

Tokenization is lowercase alphanumeric words, a small stopword list (so "how" and "does" do not drive results), and light plural folding ("works" matches "work").

## Supported files

`.txt`, `.md`, `.py`, `.json`, decoded as UTF-8. Everything else is skipped.

## Limitations

- BM25 is lexical, not semantic. It matches words, not meanings: "car" will not find "automobile". There are no embeddings or synonyms here.
- No real stemming. Only simple plurals are folded, so "running" and "run" are different words.
- The whole folder is re-read on every query with no index, which is fine for notes folders but slow for huge trees.
- English-oriented tokenization. Non-Latin scripts are not tokenized well.

## Project structure

```
2026-10-21-folder-oracle/
├── oracle.py          # scanner, BM25, snippets and CLI in one file
├── README.md
├── .gitignore
└── sample-notes/      # five demo notes with distinct topics
    ├── transformers.md
    ├── attention.md
    ├── machine-learning.md
    ├── python-tips.md
    └── daily-thoughts.md
```

## Why

RAG systems start with retrieval, and BM25 is still the baseline that fancy embedding retrievers get compared against (and often combined with). Building it by hand in about 300 lines makes the "R" in RAG concrete, and leaves behind a small tool that is actually handy for searching a messy notes folder.

Built on October 21, 2026, as part of my daily builds challenge: one small, useful project every weekday.
