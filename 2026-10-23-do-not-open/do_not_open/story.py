"""Story engine for DO_NOT_OPEN.

Pure Python, no Qt, so progression is easy to test. The UI asks the story what
to show and tells it what the player did; the story mutates GameState and
calls `on_change` so the app can save.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Callable, NamedTuple

from . import dialogue as d

CLOSED = "closed"            # folder not opened yet
INVESTIGATING = "investigating"
SUSPICIOUS = "suspicious"    # 3 files read, lock.sys appeared
MET = "met"                  # puzzle solved, Pip introducing itself
INSIDE = "inside"            # player said "not yet" (or Pip came back)
RELEASED = "released"        # Pip floats on the desktop
CHAPTERS = (CLOSED, INVESTIGATING, SUSPICIOUS, MET, INSIDE, RELEASED)

CHAPTER_TITLES = {
    CLOSED: "0 · DO NOT OPEN",
    INVESTIGATING: "1 · INVESTIGATION",
    SUSPICIOUS: "2 · SOMETHING IS IN HERE",
    MET: "3 · HELLO, PIP",
    INSIDE: "4 · CONTAINED",
    RELEASED: "5 · LOOSE",
}

LOCK_CODE = "1031"     # digits in the files, sorted by Modified date
FILES_NEEDED = 3       # mystery files read before the lock shows up

Line = tuple[str, str]  # (expression, text)


@dataclass(frozen=True)
class FileEntry:
    key: str
    name: str
    modified: str
    size: str
    kind: str


MYSTERY_FILES = (
    FileEntry("readme", "readme_DO_NOT.txt", "2026-10-22", "1 KB", "Plain Text"),
    FileEntry("grocery", "grocery_list.txt", "2019-03-02", "1 KB", "Plain Text"),
    FileEntry("diary", "diary_0x03.log", "2021-07-19", "2 KB", "Log File"),
    FileEntry("photo", "photo_0001.png", "2023-12-08", "256 B", "PNG Image"),
)
HONEST = FileEntry("honest", "honest_permissions.txt", "—", "1 KB", "Plain Text (real)")
LOCK = FileEntry("lock", "lock.sys", "????-??-??", "4 B", "Locked System File")
PIP_HOME = FileEntry("pip_home", "pip_home", "2026-10-31", "—", "Folder (occupied)")
PIP_HOME_EMPTY = FileEntry("pip_home", "pip_home", "just now", "—", "Folder (empty)")

MYSTERY_KEYS = tuple(f.key for f in MYSTERY_FILES)
READABLE_KEYS = MYSTERY_KEYS + (HONEST.key,)


@dataclass
class GameState:
    chapter: str = CLOSED
    opened_files: list[str] = field(default_factory=list)
    puzzle_solved: bool = False
    pip_released: bool = False
    wrong_attempts: int = 0
    times_declined: int = 0

    def to_dict(self) -> dict:
        return {"version": 1, **asdict(self)}

    @classmethod
    def from_dict(cls, data: object) -> "GameState":
        """Build a state from saved JSON, falling back to a fresh story on junk."""
        if not isinstance(data, dict) or data.get("chapter") not in CHAPTERS:
            return cls()
        opened: list[str] = []
        for key in data.get("opened_files") or []:
            if key in READABLE_KEYS and key not in opened:
                opened.append(key)
        chapter = data["chapter"]
        return cls(
            chapter=chapter,
            opened_files=opened,
            puzzle_solved=chapter in (MET, INSIDE, RELEASED),
            pip_released=chapter == RELEASED,
            wrong_attempts=_int(data.get("wrong_attempts")),
            times_declined=_int(data.get("times_declined")),
        )


def _int(value: object) -> int:
    return value if isinstance(value, int) and value >= 0 else 0


class FileView(NamedTuple):
    body: str
    whisper: str
    became_suspicious: bool = False


class CodeResult(NamedTuple):
    ok: bool
    line: str
    show_hint: bool = False


class Story:
    def __init__(self, state: GameState | None = None,
                 on_change: Callable[[GameState], None] | None = None):
        self.state = state or GameState()
        self.on_change = on_change
        self._rereads = 0

    def _changed(self) -> None:
        if self.on_change:
            self.on_change(self.state)

    # --- queries -------------------------------------------------------------

    @property
    def chapter(self) -> str:
        return self.state.chapter

    @property
    def released(self) -> bool:
        return self.state.chapter == RELEASED

    def mystery_opened(self) -> list[str]:
        return [k for k in self.state.opened_files if k in MYSTERY_KEYS]

    def visible_files(self) -> list[FileEntry]:
        chapter = self.state.chapter
        if chapter == CLOSED:
            return []
        files = [*MYSTERY_FILES, HONEST]
        if chapter == SUSPICIOUS:
            files.append(LOCK)
        elif chapter in (MET, INSIDE):
            files.append(PIP_HOME)
        elif chapter == RELEASED:
            files.append(PIP_HOME_EMPTY)
        return files

    # --- actions -------------------------------------------------------------

    def open_folder(self) -> str:
        if self.state.chapter != CLOSED:
            return d.FOLDER_REOPENED
        self.state.chapter = INVESTIGATING
        self._changed()
        return d.FOLDER_OPENED

    def open_file(self, key: str) -> FileView:
        if key not in {f.key for f in self.visible_files()}:
            raise KeyError(f"{key!r} is not in the folder right now")
        if key == "lock":
            return FileView("", d.LOCK_WHISPER)
        if key == "pip_home":
            return FileView("", "")
        if key == HONEST.key:
            if key not in self.state.opened_files:
                self.state.opened_files.append(key)
                self._changed()
            return FileView(d.FILE_BODIES[key], d.HONEST_WHISPER)

        if key in self.state.opened_files:
            whisper = d.REREAD_WHISPERS[self._rereads % len(d.REREAD_WHISPERS)]
            self._rereads += 1
            return FileView(d.FILE_BODIES[key], whisper)

        whisper = self._first_whisper(key)
        self.state.opened_files.append(key)
        became_suspicious = (self.state.chapter == INVESTIGATING
                             and len(self.mystery_opened()) >= FILES_NEEDED)
        if became_suspicious:
            self.state.chapter = SUSPICIOUS
            whisper = f"{whisper}  ...  {d.SUSPICIOUS_WHISPER}"
        self._changed()
        return FileView(d.FILE_BODIES[key], whisper, became_suspicious)

    def _first_whisper(self, key: str) -> str:
        before = self.mystery_opened()
        if key == "readme" and len(before) == len(MYSTERY_KEYS) - 1:
            return d.README_LAST
        for (seen, now), line in d.COMBO_WHISPERS.items():
            if now == key and seen in before:
                return line
        return d.FIRST_WHISPERS[key]

    def try_code(self, code: str) -> CodeResult:
        if self.state.chapter != SUSPICIOUS:
            return CodeResult(self.state.puzzle_solved, d.LOCK_NOT_READY)
        code = "".join(ch for ch in code if ch.isdigit())
        hint = self.state.wrong_attempts >= 3
        if len(code) != len(LOCK_CODE):
            return CodeResult(False, d.CODE_INCOMPLETE, hint)
        if code == LOCK_CODE:
            self.state.puzzle_solved = True
            self.state.chapter = MET
            self._changed()
            return CodeResult(True, d.CODE_RIGHT)
        self.state.wrong_attempts += 1
        if sorted(code) == sorted(LOCK_CODE):
            line = d.CODE_WRONG_ORDER
        else:
            line = d.CODE_WRONG[(self.state.wrong_attempts - 1) % len(d.CODE_WRONG)]
        self._changed()
        return CodeResult(False, line, self.state.wrong_attempts >= 3)

    def pip_intro(self) -> list[Line]:
        """Pip's introduction, which calls back to the files the player read."""
        callbacks = [d.INTRO_CALLBACKS[k] for k in self.mystery_opened()]
        return [*d.INTRO_OPEN, *callbacks, *d.INTRO_CLOSE]

    def decide(self, granted: bool) -> list[Line]:
        """Answer Pip's request to escape."""
        if self.state.chapter not in (MET, INSIDE):
            return []
        if granted:
            self.state.chapter = RELEASED
            self.state.pip_released = True
            self._changed()
            return list(d.GRANTED)
        self.state.times_declined += 1
        self.state.chapter = INSIDE
        self._changed()
        return list(d.DECLINED_FIRST if self.state.times_declined == 1 else d.DECLINED_AGAIN)

    def return_to_folder(self) -> Line:
        if self.state.chapter == RELEASED:
            self.state.chapter = INSIDE
            self.state.pip_released = False
            self._changed()
        return d.RETURNED

    def reset(self) -> None:
        self.state = GameState()
        self._rereads = 0
        self._changed()
