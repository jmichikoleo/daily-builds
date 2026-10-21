#!/usr/bin/env python3
"""Folder Oracle: ask a folder a question, get its most relevant files back.

Ranks local text files against a query with Okapi BM25, implemented from
scratch using only the Python standard library. Fully offline.
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
import textwrap
from collections import Counter
from dataclasses import dataclass, field

# BM25 parameters (standard values)
K1 = 1.5
B = 0.75

SUPPORTED_EXTENSIONS = {".txt", ".md", ".py", ".json"}
SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", ".mypy_cache", ".pytest_cache"}
MAX_FILE_BYTES = 2 * 1024 * 1024  # skip anything larger than 2 MB

TOKEN_RE = re.compile(r"[a-z0-9]+")

# A tiny stopword list so filler words like "how" or "does" do not drive rankings.
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
    "for", "from", "has", "have", "how", "i", "if", "in", "into", "is", "it",
    "its", "of", "on", "or", "so", "that", "the", "their", "then", "there",
    "these", "this", "to", "was", "what", "when", "where", "which", "who",
    "why", "will", "with", "you", "your",
}

SNIPPET_TARGET = 160  # aim for roughly 120 to 180 characters


@dataclass
class Document:
    path: str
    text: str
    tokens: list[str]
    tf: Counter = field(default_factory=Counter)

    def __post_init__(self) -> None:
        self.tf = Counter(self.tokens)


# ---------------------------------------------------------------- tokenizing

def fold_plural(token: str) -> str:
    """Very light normalization so "works" matches "work" (not a full stemmer)."""
    if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumerics, drop stopwords, fold plurals."""
    return [fold_plural(t) for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS]


# ---------------------------------------------------------------- scanning

def read_text_file(path: str) -> str | None:
    """Return the file's text, or None if it is binary, huge or unreadable."""
    try:
        if os.path.getsize(path) > MAX_FILE_BYTES:
            return None
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError:
        return None
    if b"\x00" in raw[:8192]:  # null bytes: almost certainly binary
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None


def scan_folder(root: str) -> list[Document]:
    """Recursively collect supported text files under root (no symlinked dirs)."""
    docs: list[Document] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if os.path.splitext(name)[1].lower() not in SUPPORTED_EXTENSIONS:
                continue
            path = os.path.join(dirpath, name)
            if os.path.islink(path) or not os.path.isfile(path):
                continue
            text = read_text_file(path)
            if text is None:
                continue
            docs.append(Document(path=path, text=text, tokens=tokenize(text)))
    return docs


# ---------------------------------------------------------------- BM25

class BM25:
    """Okapi BM25 over an in-memory corpus."""

    def __init__(self, docs: list[Document], k1: float = K1, b: float = B) -> None:
        self.docs = docs
        self.k1 = k1
        self.b = b
        self.n = len(docs)
        self.avgdl = (sum(len(d.tokens) for d in docs) / self.n) if self.n else 0.0
        self.df: Counter = Counter()
        for d in docs:
            self.df.update(set(d.tokens))

    def idf(self, term: str) -> float:
        # Nonnegative IDF (as used by Lucene): log(1 + (N - df + 0.5) / (df + 0.5))
        df = self.df.get(term, 0)
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def score(self, doc: Document, query_terms: list[str]) -> float:
        dl = len(doc.tokens)
        if dl == 0 or self.avgdl == 0:
            return 0.0
        total = 0.0
        for term in query_terms:
            tf = doc.tf.get(term, 0)
            if tf == 0:
                continue
            norm = 1 - self.b + self.b * dl / self.avgdl
            total += self.idf(term) * (tf * (self.k1 + 1)) / (tf + self.k1 * norm)
        return total

    def rank(self, query_terms: list[str]) -> list[tuple[Document, float]]:
        scored = [(d, self.score(d, query_terms)) for d in self.docs]
        scored = [(d, s) for d, s in scored if s > 0]
        scored.sort(key=lambda pair: (-pair[1], pair[0].path))
        return scored


# ---------------------------------------------------------------- snippets

def clean_for_snippet(text: str, markdown: bool = True) -> str:
    """Drop markdown headings and fences, strip light markup, collapse whitespace."""
    if not markdown:
        return re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"^\s*#.*$", " ", text, flags=re.M)        # headings still count for BM25
    text = re.sub(r"^\s*(?:[-+*]|\d+\.)\s+", " ", text, flags=re.M)  # list markers
    text = re.sub(r"\*\*|__|`|^\s*>", "", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def best_snippet(text: str, query_terms: list[str], idf: dict[str, float],
                 markdown: bool = True) -> str:
    """Pick the ~160-character window with the strongest query-term overlap."""
    clean = clean_for_snippet(text, markdown) or clean_for_snippet(text, markdown=False)
    words = clean.split(" ")
    if len(clean) <= SNIPPET_TARGET + 20:
        return clean

    wanted = set(query_terms)
    best_start, best_end, best_score = 0, 0, -1.0
    for start in range(len(words)):
        end, length = start, 0
        while end < len(words) and length + len(words[end]) + 1 <= SNIPPET_TARGET:
            length += len(words[end]) + 1
            end += 1
        if end == start:
            end = start + 1
        hits = [t for w in words[start:end] for t in tokenize(w) if t in wanted]
        distinct = set(hits)
        # Reward covering many different (and rarer) query terms, then raw hits,
        # with a tiny bonus for windows that start a sentence.
        score = sum(idf.get(t, 0) for t in distinct) * 10 + len(hits)
        if start == 0 or words[start - 1].endswith((".", "!", "?", ":")):
            score += 1.5
        if score > best_score:
            best_start, best_end, best_score = start, end, score
        if end >= len(words):
            break

    snippet = " ".join(words[best_start:best_end])
    if best_start > 0:
        snippet = "..." + snippet
    if best_end < len(words):
        snippet = snippet.rstrip(",;:") + "..."
    return snippet


# ---------------------------------------------------------------- output

class Style:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def _wrap(self, code: str, s: str) -> str:
        return f"\033[{code}m{s}\033[0m" if self.enabled else s

    def title(self, s: str) -> str:
        return self._wrap("1;35", s)

    def dim(self, s: str) -> str:
        return self._wrap("2", s)

    def path(self, s: str) -> str:
        return self._wrap("1;36", s)

    def score(self, s: str) -> str:
        return self._wrap("33", s)

    def quote(self, s: str) -> str:
        return self._wrap("3", s)


def supports_color(stream) -> bool:
    if os.environ.get("NO_COLOR") or os.environ.get("TERM") == "dumb":
        return False
    return hasattr(stream, "isatty") and stream.isatty()


def display_path(path: str, root: str) -> str:
    rel = os.path.relpath(path)
    if rel.startswith(".."):
        rel = os.path.relpath(path, root)
    return rel


def print_results(query: str, results: list[tuple[Document, float]], root: str,
                  query_terms: list[str], idf: dict[str, float], st: Style) -> None:
    print()
    print(st.title("✦ FOLDER ORACLE ✦"))
    print()
    print(st.dim("Consulting the archives..."))
    print(f'Query: "{query}"')
    print()
    if not results:
        print("The oracle is silent. No scroll speaks of this.")
        print(st.dim("✧ Try different or fewer words. BM25 matches words, not meanings."))
        print()
        return
    print("The oracle has spoken:")
    print()
    for i, (doc, score) in enumerate(results, 1):
        is_md = doc.path.lower().endswith(".md")
        snippet = best_snippet(doc.text, query_terms, idf, markdown=is_md)
        lines = textwrap.wrap(f'"{snippet}"', width=56, break_on_hyphens=False) or ['""']
        print(f"{i:02d}. {st.path(display_path(doc.path, root))}")
        print(f"    Relevance: {st.score(f'{score:.3f}')}")
        print("    " + st.quote(lines[0]))
        for line in lines[1:]:
            print("     " + st.quote(line))
        print()
    noun = "scroll" if len(results) == 1 else "scrolls"
    print(st.dim(f"✧ {len(results)} relevant {noun} discovered."))
    print()


# ---------------------------------------------------------------- CLI

def positive_int(value: str) -> int:
    try:
        n = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"'{value}' is not a whole number")
    if n < 1:
        raise argparse.ArgumentTypeError("--top must be 1 or greater")
    return n


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="oracle.py",
        description="Folder Oracle: rank the text files in a folder against a query "
                    "using BM25. Offline, read-only, standard library only.",
        epilog='example: python3 oracle.py ~/notes "how does attention work" --top 3',
    )
    parser.add_argument("folder", help="folder to search (scanned recursively)")
    parser.add_argument("query", help="what to ask the oracle (quote multi-word queries)")
    parser.add_argument("--top", type=positive_int, default=5, metavar="N",
                        help="number of results to show (default: 5)")
    return parser


def folder_problem(root: str) -> str | None:
    """Explain why root cannot be searched, or return None if it is fine."""
    try:
        if not os.path.isdir(root):
            return "is a file, not a folder." if os.path.exists(root) else "does not exist."
        os.listdir(root)
    except PermissionError:
        return ("cannot be read (permission denied). On macOS, allow your terminal app in "
                "System Settings > Privacy & Security > Files and Folders.")
    except OSError as exc:
        return f"cannot be read ({exc.strerror})."
    return None


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = os.path.expanduser(args.folder)
    problem = folder_problem(root)
    if problem:
        print(f"oracle.py: error: '{args.folder}' {problem}", file=sys.stderr)
        return 2

    query_terms = tokenize(args.query)
    if not query_terms:
        print("oracle.py: error: the query has no searchable words "
              "(it is empty or only common filler words).", file=sys.stderr)
        return 2

    docs = scan_folder(root)
    if not docs:
        print(f"The archives are empty. No readable "
              f"{', '.join(sorted(SUPPORTED_EXTENSIONS))} files found in '{args.folder}'.")
        return 1

    engine = BM25(docs)
    idf = {t: engine.idf(t) for t in set(query_terms)}
    results = engine.rank(query_terms)[: args.top]
    print_results(args.query, results, root, query_terms, idf, Style(supports_color(sys.stdout)))
    return 0 if results else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
