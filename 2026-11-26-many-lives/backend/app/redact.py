# backend/app/redact.py: keep secrets and other people's contact details out of the universe.
# Applied to every text body before it is stored. Also decides which files are never read.
import re
from pathlib import Path

PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S), "[private key removed]"),
    (re.compile(r"\b(sk-(?:proj-|ant-)?[A-Za-z0-9_\-]{16,})"), "[api key removed]"),
    (re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{20,})"), "[token removed]"),
    (re.compile(r"\b(xox[abpr]-[A-Za-z0-9\-]{10,})"), "[token removed]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[key removed]"),
    (re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}"), "[key removed]"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"), "[token removed]"),
    (re.compile(r"(?i)\b(password|passwd|secret|api[_-]?key|token|bearer)\b(\s*[:=]\s*|\s+)([^\s'\"]{6,})"), r"\1\2[removed]"),
    (re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"), "[email]"),
    (re.compile(r"(?<!\d)(\+?\d{1,3}[\s\-]?)?(\(?\d{2,4}\)?[\s\-]?)\d{3,4}[\s\-]\d{4}(?!\d)"), "[phone]"),
    (re.compile(r"\b\d{6}-\d{7}\b"), "[id number]"),             # korean resident registration number shape
    (re.compile(r"\b(?:\d[ \-]?){13,19}\b"), "[number removed]"),  # card-like digit runs
]

NEVER_READ_NAMES = {
    ".env", ".env.local", ".env.production", ".npmrc", ".netrc", ".pypirc", "id_rsa", "id_ed25519",
    "credentials", "credentials.json", "secrets.json", "keychain", "cookies", "cookies.sqlite",
    "login data", "known_hosts", "authorized_keys", ".git-credentials", "token.json",
}
NEVER_READ_SUFFIX = (".pem", ".key", ".p12", ".pfx", ".keychain", ".keychain-db", ".kdbx", ".gpg", ".asc", ".mobileprovision")
NEVER_READ_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist", "build", ".ssh", ".gnupg",
                   "Library", ".Trash", ".cache", "DerivedData", "Pods", ".turbo", ".pnpm-store", "target"}


def redact(text: str | None) -> str:
    if not text:
        return ""
    for pat, rep in PATTERNS:
        text = pat.sub(rep, text)
    return text


def is_forbidden(path: Path) -> bool:
    name = path.name.lower()
    if name in NEVER_READ_NAMES or name.startswith(".env") or name.endswith(NEVER_READ_SUFFIX):
        return True
    return any(part in NEVER_READ_DIRS for part in path.parts[:-1])


SENSITIVE_HINTS = re.compile(
    r"(?i)(?<![a-z])(passport|bank ?statement|bank ?account|salary|payslip|tax ?return|tax ?invoice|medical|diagnosis|"
    r"health ?record|insurance|visa|transcript of records|academic transcript|residence card|alien registration)(?![a-z])"
    r"|여권|주민등록|계좌|급여|세금|진단|보험|성적증명|비자|외국인등록"
)


def looks_sensitive(name: str, text: str = "") -> bool:
    return bool(SENSITIVE_HINTS.search(name)) or bool(SENSITIVE_HINTS.search(text[:2000]))
