"""The fake file explorer where the whole mystery happens."""
from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from PySide6.QtCore import QUrl, Qt, QTimer, QVariantAnimation, Signal
from PySide6.QtGui import (QAction, QBrush, QColor, QDesktopServices, QFont,
                           QIntValidator, QLinearGradient, QPainter)
from PySide6.QtWidgets import (QFrame, QHBoxLayout, QHeaderView, QLabel, QLineEdit, QMainWindow,
                               QMessageBox, QPushButton, QScrollArea, QSplitter,
                               QStackedWidget, QTreeWidget, QTreeWidgetItem,
                               QVBoxLayout, QWidget)

from . import dialogue as d
from . import story as st
from . import theme
from .sprites import file_icon
from .widgets import (FolderIcon, GlitchLabel, GlitchOverlay, PhotoView, PipView,
                      TypewriterLabel, glow_html, strip_glow)

if TYPE_CHECKING:
    from .app import Game

KEY_ROLE = Qt.ItemDataRole.UserRole


def _panel(widget: QWidget | None = None) -> QFrame:
    frame = QFrame()
    frame.setObjectName("Panel")
    if widget is not None:
        lay = QVBoxLayout(frame)
        lay.setContentsMargins(14, 14, 14, 14)
        lay.addWidget(widget)
    return frame


class Backdrop(QWidget):
    """Pearl-to-lavender gradient with faint CRT scanlines."""

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        grad = QLinearGradient(0, 0, self.width(), self.height())
        grad.setColorAt(0, QColor(theme.PEARL))
        grad.setColorAt(0.6, QColor(theme.PEARL_DEEP))
        grad.setColorAt(1, QColor(theme.LAVENDER_SOFT))
        p.fillRect(self.rect(), QBrush(grad))
        line = QColor(theme.CHARCOAL)
        line.setAlpha(7)
        for y in range(0, self.height(), 3):
            p.fillRect(0, y, self.width(), 1, line)


class DigitEdit(QLineEdit):
    back = Signal()
    submit = Signal()

    def __init__(self):
        super().__init__()
        self.setObjectName("Digit")
        self.setMaxLength(1)
        self.setValidator(QIntValidator(0, 9, self))
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setFixedSize(56, 66)

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key.Key_Backspace and not self.text():
            self.back.emit()
        elif event.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
            self.submit.emit()
        else:
            super().keyPressEvent(event)


class LockPanel(QWidget):
    submitted = Signal(str)

    def __init__(self):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setSpacing(12)
        title = GlitchLabel(st.LOCK.name, intensity=0.6)
        title.setObjectName("FileTitle")
        meta = QLabel(f"{st.LOCK.kind} · {st.LOCK.size} · owner: ???")
        meta.setObjectName("FileMeta")
        hint = QLabel(d.LOCK_HINT)
        hint.setObjectName("LockHint")

        self.row = QWidget()
        row = QHBoxLayout(self.row)
        row.setContentsMargins(0, 8, 0, 8)
        self.digits = [DigitEdit() for _ in range(4)]
        for i, edit in enumerate(self.digits):
            row.addWidget(edit)
            edit.textEdited.connect(lambda text, i=i: self._advance(i, text))
            edit.back.connect(lambda i=i: self.digits[max(0, i - 1)].setFocus())
            edit.submit.connect(self._submit)
        unlock = QPushButton("Unlock")
        unlock.setObjectName("Primary")
        unlock.clicked.connect(self._submit)
        row.addSpacing(10)
        row.addWidget(unlock)
        row.addStretch()

        self.feedback = QLabel(" ")
        self.feedback.setObjectName("LockFeedback")
        self.extra = QLabel(d.CODE_HINT)
        self.extra.setObjectName("Muted")
        self.extra.hide()

        for w in (title, meta, hint, self.row, self.feedback, self.extra):
            lay.addWidget(w)
        lay.addStretch()

        self._shake = QVariantAnimation(self)
        self._shake.setStartValue(0.0)
        self._shake.setEndValue(1.0)
        self._shake.setDuration(380)
        self._shake.valueChanged.connect(self._shake_step)

    def reset(self, show_hint: bool) -> None:
        for edit in self.digits:
            edit.clear()
        self.feedback.setText(" ")
        self.extra.setVisible(show_hint)
        self.digits[0].setFocus()

    def _advance(self, i: int, text: str) -> None:
        if text and i < 3:
            self.digits[i + 1].setFocus()
            self.digits[i + 1].selectAll()
        elif text and i == 3:
            self._submit()

    def _submit(self) -> None:
        self.submitted.emit("".join(e.text() for e in self.digits))

    def show_result(self, result: st.CodeResult) -> None:
        self.feedback.setText(result.line)
        self.extra.setVisible(result.show_hint)
        if not result.ok:
            self._shake.start()
            for edit in self.digits:
                edit.clear()
            self.digits[0].setFocus()

    def _shake_step(self, t) -> None:
        import math
        t = float(t)
        off = int(math.sin(t * math.pi * 6) * (1 - t) * 10)
        self.row.layout().setContentsMargins(max(0, off), 8, max(0, -off), 8)


class PipStage(QWidget):
    """Where Pip talks inside the folder: intro, the big question, and after."""
    grant = Signal()
    decline = Signal()
    release_again = Signal()
    call_back = Signal()

    def __init__(self):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setSpacing(10)
        self.bubble = TypewriterLabel(step=1, interval=22)
        self.bubble.setObjectName("Bubble")
        self.bubble.setMinimumHeight(64)
        self.bubble.setCursor(Qt.CursorShape.PointingHandCursor)
        self.bubble.clicked.connect(self._advance)
        self.bubble.finished.connect(self._line_done)

        self.pip = PipView(scale=8)
        self.pip.clicked.connect(self._pip_clicked)
        self.cont = QLabel("click Pip or the bubble to continue ▸")
        self.cont.setObjectName("Muted")
        self.cont.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.permission = QLabel(d.PERMISSION_DETAILS)
        self.permission.setObjectName("Permission")
        self.permission.setWordWrap(True)
        self.note = TypewriterLabel(step=3)
        self.note.setObjectName("FileBody")

        self.yes = QPushButton("Let Pip out")
        self.yes.setObjectName("Primary")
        self.no = QPushButton("Not yet")
        self.release_btn = QPushButton("Release Pip")
        self.release_btn.setObjectName("Primary")
        self.call_btn = QPushButton("Call Pip back")
        self.call_btn.setObjectName("Primary")
        self.yes.clicked.connect(self.grant)
        self.no.clicked.connect(self.decline)
        self.release_btn.clicked.connect(self.release_again)
        self.call_btn.clicked.connect(self.call_back)

        buttons = QHBoxLayout()
        buttons.addStretch()
        for b in (self.no, self.yes, self.release_btn, self.call_btn):
            buttons.addWidget(b)
        buttons.addStretch()

        lay.addWidget(self.bubble)
        lay.addWidget(self.pip, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self.cont)
        lay.addWidget(self.note)
        lay.addWidget(self.permission)
        lay.addLayout(buttons)
        lay.addStretch()

        self._queue: list[st.Line] = []
        self._then: Callable[[], None] | None = None
        self._auto = False
        self._mode = ""
        self._pokes = 0
        self._auto_timer = QTimer(self)
        self._auto_timer.setSingleShot(True)
        self._auto_timer.timeout.connect(self._advance)
        self._set_visible()

    def _set_visible(self, *shown: QWidget) -> None:
        for w in (self.cont, self.permission, self.note, self.yes, self.no,
                  self.release_btn, self.call_btn):
            w.setVisible(w in shown)
        self.pip.setVisible(self._mode != "released")
        self.bubble.setVisible(self._mode != "released")

    def say(self, line: st.Line) -> None:
        expression, text = line
        self.pip.show_expression(expression, 2600)
        self.pip.hop()
        self.bubble.type_text(text)

    def play(self, lines: list[st.Line], then: Callable[[], None], auto: bool = False) -> None:
        self._mode = "talking"
        self._queue, self._then, self._auto = list(lines), then, auto
        self._set_visible(*([] if auto else [self.cont]))
        self._advance()

    def _advance(self) -> None:
        if self.bubble.is_typing():
            self.bubble.skip()
            return
        if self._mode != "talking":
            return
        if self._queue:
            self.say(self._queue.pop(0))
        elif self._then:
            then, self._then = self._then, None
            then()

    def _line_done(self) -> None:
        if self._mode == "talking" and self._auto:
            self._auto_timer.start(1100)

    def _pip_clicked(self) -> None:
        if self._mode == "talking":
            self._advance()
        elif self._mode == "inside":
            self._pokes += 1
            self.say(d.INSIDE_POKES[(self._pokes - 1) % len(d.INSIDE_POKES)])
        else:
            self.pip.show_expression("happy", 900)
            self.pip.hop()

    def show_ask(self) -> None:
        self._mode = "ask"
        self._set_visible(self.permission, self.yes, self.no)
        self.say(d.PERMISSION_ASK)

    def show_inside(self, line: st.Line | None = None) -> None:
        self._mode = "inside"
        self.pip.set_resting("idle")
        self._set_visible(self.release_btn)
        self.say(line or ("idle", "still here. still in a folder. click me, i'm bored."))

    def show_released(self, hidden: bool) -> None:
        self._mode = "released"
        self._set_visible(self.note, *([self.call_btn] if hidden else []))
        self.note.type_text(d.RELEASED_NOTE)


class FolderWindow(QMainWindow):
    def __init__(self, game: "Game"):
        super().__init__()
        self.game = game
        self.story = game.story
        self._current: str | None = None
        self._pokes = 0
        self.setWindowTitle("DO_NOT_OPEN")
        self.resize(1120, 660)
        self.setMinimumSize(820, 540)

        root = Backdrop()
        self.setCentralWidget(root)
        outer = QVBoxLayout(root)
        outer.setContentsMargins(14, 14, 14, 14)
        outer.setSpacing(10)
        outer.addWidget(self._build_header())
        body = QHBoxLayout()
        body.setSpacing(10)
        body.addWidget(self._build_sidebar())
        self.pages = QStackedWidget()
        self.pages.addWidget(self._build_closed_page())
        self.pages.addWidget(self._build_explorer())
        body.addWidget(self.pages, 1)
        outer.addLayout(body, 1)
        outer.addWidget(self._build_whisper_bar())
        self.overlay = GlitchOverlay(root)
        self._build_menu()

        self._flicker_key: str | None = None
        self._flicker_left = 0
        self._flicker = QTimer(self)
        self._flicker.timeout.connect(self._flicker_step)

        self.refresh()
        self.whisper(self._opening_whisper())
        if self.story.chapter in (st.MET, st.INSIDE):
            self.select("pip_home")

    # --- construction --------------------------------------------------------

    def _build_header(self) -> QWidget:
        header = QFrame()
        header.setObjectName("Header")
        lay = QHBoxLayout(header)
        lay.setContentsMargins(14, 8, 10, 8)
        self.path = GlitchLabel("~/Desktop/DO_NOT_OPEN", intensity=0.2)
        self.path.setObjectName("HeaderPath")
        self.chip = QLabel()
        self.chip.setObjectName("ChapterChip")
        lay.addWidget(self.path)
        lay.addStretch()
        lay.addWidget(self.chip)
        return header

    def _build_sidebar(self) -> QWidget:
        side = _panel()
        side.setFixedWidth(200)
        lay = QVBoxLayout(side)
        lay.setContentsMargins(10, 12, 10, 12)
        title = QLabel("LOCATIONS")
        title.setObjectName("SidebarTitle")
        lay.addWidget(title)
        for key, label in (("desktop", "🖥  Desktop"), ("documents", "📄  Documents"),
                           ("do_not_open", "📁  DO_NOT_OPEN"), ("trash", "🗑  Trash")):
            btn = QPushButton(label)
            btn.setObjectName("SidebarItem")
            btn.setProperty("active", key == "do_not_open")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda _=False, k=key: self._sidebar(k))
            lay.addWidget(btn)
        lay.addStretch()
        self.case = QLabel()
        self.case.setObjectName("CaseCard")
        lay.addWidget(self.case)
        reset = QPushButton("↺  Reset Story")
        reset.setObjectName("Ghost")
        reset.clicked.connect(self.confirm_reset)
        lay.addWidget(reset)
        return side

    def _build_closed_page(self) -> QWidget:
        page = _panel()
        lay = QVBoxLayout(page)
        lay.addStretch()
        self.folder_icon = FolderIcon(scale=10)
        self.folder_icon.clicked.connect(self._poke_folder)
        lay.addWidget(self.folder_icon, alignment=Qt.AlignmentFlag.AlignHCenter)
        title = GlitchLabel("DO_NOT_OPEN", intensity=0.5)
        title.setObjectName("BigTitle")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sub = QLabel("5 items · modified yesterday at 3:13 AM · owner: ???")
        sub.setObjectName("FileMeta")
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        open_btn = QPushButton("Open anyway")
        open_btn.setObjectName("Primary")
        open_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        open_btn.clicked.connect(self._open_folder)
        lay.addSpacing(8)
        lay.addWidget(title)
        lay.addWidget(sub)
        lay.addSpacing(14)
        lay.addWidget(open_btn, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addStretch()
        return page

    def _build_explorer(self) -> QWidget:
        split = QSplitter(Qt.Orientation.Horizontal)
        split.setChildrenCollapsible(False)

        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Name", "Modified", "Size", "Kind"])
        self.tree.setRootIsDecorated(False)
        self.tree.setSortingEnabled(True)
        self.tree.sortByColumn(0, Qt.SortOrder.AscendingOrder)
        self.tree.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        header = self.tree.header()
        header.setStretchLastSection(False)
        for col in (0, 1, 2):
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.tree.currentItemChanged.connect(self._item_changed)
        split.addWidget(_panel(self.tree))

        self.preview = QStackedWidget()
        empty = QLabel("select a file.\nor don't.\n(please don't.)")
        empty.setObjectName("Muted")
        empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview.addWidget(empty)

        text_page = QWidget()
        tl = QVBoxLayout(text_page)
        self.text_title = GlitchLabel("")
        self.text_title.setObjectName("FileTitle")
        self.text_meta = QLabel()
        self.text_meta.setObjectName("FileMeta")
        self.text_body = TypewriterLabel(step=3, interval=12)
        self.text_body.setObjectName("FileBody")
        self.text_body.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.text_body)
        tl.addWidget(self.text_title)
        tl.addWidget(self.text_meta)
        tl.addSpacing(6)
        tl.addWidget(scroll, 1)
        self.preview.addWidget(text_page)

        photo_page = QWidget()
        pl = QVBoxLayout(photo_page)
        self.photo_title = GlitchLabel(st.MYSTERY_FILES[3].name, intensity=0.5)
        self.photo_title.setObjectName("FileTitle")
        photo_meta = QLabel("PNG Image · 16 × 16 · corrupted? · hover over it. go on.")
        photo_meta.setObjectName("FileMeta")
        self.photo = PhotoView()
        self.photo_caption = TypewriterLabel(step=3, interval=12)
        self.photo_caption.setObjectName("FileBody")
        pl.addWidget(self.photo_title)
        pl.addWidget(photo_meta)
        pl.addWidget(self.photo, 1)
        pl.addWidget(self.photo_caption)
        self.preview.addWidget(photo_page)

        self.lock = LockPanel()
        self.lock.submitted.connect(self._try_code)
        self.preview.addWidget(self.lock)

        self.stage = PipStage()
        self.stage.grant.connect(self._grant)
        self.stage.decline.connect(self._decline)
        self.stage.release_again.connect(
            lambda: self.stage.play(d.RELEASE_AGAIN, self.stage.show_ask, auto=True))
        self.stage.call_back.connect(self.game.call_pip)
        self.preview.addWidget(self.stage)

        preview_panel = _panel(self.preview)
        preview_panel.setMinimumWidth(400)
        split.addWidget(preview_panel)
        split.setStretchFactor(0, 3)
        split.setStretchFactor(1, 2)
        split.setSizes([600, 420])
        return split

    def _build_whisper_bar(self) -> QWidget:
        bar = QFrame()
        bar.setObjectName("WhisperBar")
        lay = QHBoxLayout(bar)
        lay.setContentsMargins(14, 8, 14, 8)
        mark = QLabel("✦")
        mark.setObjectName("WhisperMark")
        self.whisper_label = TypewriterLabel(step=1, interval=24)
        self.whisper_label.setObjectName("Whisper")
        self.progress = QLabel()
        self.progress.setObjectName("Progress")
        lay.addWidget(mark)
        lay.addWidget(self.whisper_label, 1)
        lay.addWidget(self.progress)
        return bar

    def _build_menu(self) -> None:
        menu = self.menuBar().addMenu("Story")
        reset = QAction("Reset Story…", self)
        reset.triggered.connect(self.confirm_reset)
        reveal = QAction("Show Save File in Finder", self)
        reveal.triggered.connect(self._reveal_save)
        honest = QAction("What Does This App Actually Do?", self)
        honest.triggered.connect(self._show_honest)
        for action in (honest, reveal, reset):
            menu.addAction(action)

    # --- state -> screen -----------------------------------------------------

    def refresh(self) -> None:
        chapter = self.story.chapter
        self.pages.setCurrentIndex(0 if chapter == st.CLOSED else 1)
        self.chip.setText(st.CHAPTER_TITLES[chapter])
        self.path.intensity = 0.6 if chapter == st.SUSPICIOUS else 0.2
        self._update_status()
        self._rebuild_tree()

    def _update_status(self) -> None:
        chapter = self.story.chapter
        read = len(self.story.mystery_opened())
        lock = {st.CLOSED: "???", st.INVESTIGATING: "???", st.SUSPICIOUS: "found"}.get(chapter, "open")
        subject = {st.MET: "Pip", st.INSIDE: "Pip (contained)",
                   st.RELEASED: "Pip (loose)"}.get(chapter, "unknown")
        self.case.setText(f"CASE FILE\nfiles read  {read}/4\nlock.sys    {lock}\nsubject     {subject}")
        self.progress.setText(f"{read}/4 read")

    def _rebuild_tree(self) -> None:
        opened = self.story.state.opened_files
        self.tree.blockSignals(True)
        self.tree.clear()
        for f in self.story.visible_files():
            item = QTreeWidgetItem([f.name, f.modified, f.size, f.kind])
            item.setData(0, KEY_ROLE, f.key)
            item.setIcon(0, file_icon(f.key))
            self._style_item(item, f.key)
            self.tree.addTopLevelItem(item)
            if f.key == self._current:
                self.tree.setCurrentItem(item)
        self.tree.blockSignals(False)

    def _style_item(self, item: QTreeWidgetItem, key: str) -> None:
        """Unread mystery files are bold; read ones turn dusty rose."""
        opened = key in self.story.state.opened_files
        font = QFont(item.font(0))
        font.setBold(key in st.MYSTERY_KEYS and not opened)
        item.setFont(0, font)
        if opened:
            item.setForeground(0, QColor(theme.ROSE_DEEP))

    def _item_for(self, key: str) -> QTreeWidgetItem | None:
        for i in range(self.tree.topLevelItemCount()):
            item = self.tree.topLevelItem(i)
            if item.data(0, KEY_ROLE) == key:
                return item
        return None

    def select(self, key: str) -> None:
        item = self._item_for(key)
        if item is not None:
            self.tree.setCurrentItem(item)  # triggers _item_changed

    def whisper(self, text: str) -> None:
        if text:
            self.whisper_label.type_text(text)

    def _opening_whisper(self) -> str:
        return {
            st.CLOSED: "(it's quiet. too quiet. it's a folder.)",
            st.INVESTIGATING: d.FOLDER_REOPENED,
            st.SUSPICIOUS: "lock.sys is still there. waiting. like me. i mean. like IT.",
            st.MET: "...you left in the middle of my introduction. rude. pip_home.",
            st.INSIDE: "pip is waiting in pip_home. pip is not sulking. pip is sulking.",
            st.RELEASED: "the folder feels emptier. crumbier, too.",
        }[self.story.chapter]

    # --- player actions ------------------------------------------------------

    def _poke_folder(self) -> None:
        self._pokes += 1
        if self._pokes >= len(d.FOLDER_POKES):
            self.whisper(d.FOLDER_POKES[-1])
            QTimer.singleShot(700, self._open_folder)
        else:
            self.whisper(d.FOLDER_POKES[self._pokes - 1])

    def _open_folder(self) -> None:
        if self.story.chapter != st.CLOSED:
            return
        self.whisper(self.story.open_folder())
        self.overlay.flash(300)
        self.refresh()

    def _sidebar(self, key: str) -> None:
        self.whisper(d.SIDEBAR_QUIPS[key])

    def _item_changed(self, item: QTreeWidgetItem | None, _prev) -> None:
        if item is None:
            return
        key = item.data(0, KEY_ROLE)
        self._current = key
        view = self.story.open_file(key)
        if key == "lock":
            self.preview.setCurrentWidget(self.lock)
            self.lock.reset(self.story.state.wrong_attempts >= 3)
        elif key == "pip_home":
            self.preview.setCurrentWidget(self.stage)
            self._enter_pip_home()
        elif key == "photo":
            self.preview.setCurrentIndex(2)
            self.photo_caption.type_text(strip_glow(view.body), glow_html(view.body))
            self.photo_title.burst()
        else:
            entry = next(f for f in self.story.visible_files() if f.key == key)
            body = view.body.replace("{save_path}", str(self.game.save_file))
            self.preview.setCurrentIndex(1)
            self.text_title.set_base(entry.name)
            self.text_meta.setText(f"{entry.kind} · {entry.size} · modified {entry.modified}")
            self.text_body.type_text(strip_glow(body), glow_html(body))
        self.whisper(view.whisper)
        self._style_item(item, key)
        self._update_status()
        if view.became_suspicious:
            # don't rebuild the tree from inside its own signal; do it next tick
            QTimer.singleShot(0, self._on_suspicious)

    def _on_suspicious(self) -> None:
        self.refresh()
        self.overlay.flash()
        self.path.burst()
        self._start_flicker("lock")

    def _enter_pip_home(self) -> None:
        chapter = self.story.chapter
        if chapter == st.MET:
            self.stage.play(self.story.pip_intro(), self.stage.show_ask)
        elif chapter == st.INSIDE:
            self.stage.show_inside()
        elif chapter == st.RELEASED:
            companion = self.game.companion
            self.stage.show_released(hidden=companion is None or not companion.isVisible())

    def _try_code(self, code: str) -> None:
        result = self.story.try_code(code)
        self.lock.show_result(result)
        self.whisper(result.line)
        if result.ok:
            self.overlay.flash(700)
            self.path.burst()
            self.refresh()
            self._start_flicker("pip_home")
            QTimer.singleShot(650, lambda: self.select("pip_home"))

    def _grant(self) -> None:
        lines = self.story.decide(True)
        self.refresh()
        self.whisper("the folder door creaks open. (it's a window. it doesn't creak. it's for vibes.)")

        def escape() -> None:
            self.game.show_companion()
            self.stage.show_released(hidden=False)
        self.stage.play(lines, escape, auto=True)

    def _decline(self) -> None:
        lines = self.story.decide(False)
        self.refresh()
        self.stage.play(lines, self.stage.show_inside)

    # --- flicker a newly appeared file ---------------------------------------

    def _start_flicker(self, key: str) -> None:
        self._flicker_key, self._flicker_left = key, 8
        self._flicker.start(90)

    def _flicker_step(self) -> None:
        item = self._item_for(self._flicker_key or "")
        self._flicker_left -= 1
        if item is None or self._flicker_left <= 0:
            if item is not None:
                item.setHidden(False)
            self._flicker.stop()
            return
        item.setHidden(not item.isHidden())

    # --- called by Game ------------------------------------------------------

    def on_pip_hidden(self) -> None:
        self.bring_forward()
        self.select("pip_home")
        self.stage.show_released(hidden=True)
        self.whisper("pip is hiding. pip is bad at hiding. (Call Pip back in pip_home.)")

    def on_pip_called(self) -> None:
        if self._current == "pip_home":
            self.stage.show_released(hidden=False)

    def on_pip_returned(self, line: st.Line) -> None:
        self.refresh()
        self.bring_forward()
        self.select("pip_home")
        self.stage.show_inside(line)

    def on_reset(self) -> None:
        self._current = None
        self._pokes = 0
        self.preview.setCurrentIndex(0)
        self.refresh()
        self.overlay.flash(500)
        self.whisper("...huh. did something just happen? anyway. there's a folder.")

    def bring_forward(self) -> None:
        self.show()
        self.raise_()
        self.activateWindow()

    def confirm_reset(self) -> None:
        answer = QMessageBox.question(
            self, "Reset Story?",
            "Forget everything: opened files, the lock, and Pip.\n"
            "Pip goes back in the folder and pretends you never met.\n\n"
            "(Only the game's own save file is changed.)")
        if answer == QMessageBox.StandardButton.Yes:
            self.game.reset()

    def _reveal_save(self) -> None:
        self.game.save_now()  # make sure the file exists before showing it
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.game.save_file.parent)))

    def _show_honest(self) -> None:
        text = d.FILE_BODIES["honest"].replace("{save_path}", str(self.game.save_file))
        QMessageBox.information(self, "What DO_NOT_OPEN actually does", text)

    def closeEvent(self, event) -> None:
        event.accept()
        QTimer.singleShot(0, self.game.folder_closed)
