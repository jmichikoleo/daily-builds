"""Pip, loose on the desktop: a small transparent, frameless, always-on-top window.

What it does: floats, gets dragged, talks when clicked, naps when ignored.
What it doesn't: no keyboard hooks, no screen reading, no launch-at-login.
It only sees mouse events that land on its own little window.
"""
from __future__ import annotations

import random
import time

from PySide6.QtCore import QPoint, Qt, QTimer, Signal
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import QMenu, QVBoxLayout, QWidget

from . import dialogue as d
from .story import Line
from .widgets import PipView, TypewriterLabel

DRAG_THRESHOLD = 4       # px before a press counts as a drag, not a click
SLEEP_AFTER = 75         # seconds without attention before Pip naps


class CompanionWindow(QWidget):
    hide_requested = Signal()
    return_requested = Signal()
    quit_requested = Signal()

    def __init__(self):
        super().__init__(None, Qt.WindowType.FramelessWindowHint
                         | Qt.WindowType.WindowStaysOnTopHint
                         | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        # macOS hides Tool windows when the app loses focus; Pip should stay put
        self.setAttribute(Qt.WidgetAttribute.WA_MacAlwaysShowToolWindow)
        self.setWindowTitle("Pip")
        self.setFixedSize(250, 230)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 6, 4)
        self.bubble = TypewriterLabel(step=1, interval=24)
        self.bubble.setObjectName("Bubble")
        self.bubble.setFixedWidth(238)
        self.bubble.clicked.connect(self._hide_bubble)
        self.bubble.finished.connect(self._schedule_bubble_hide)
        self.bubble.hide()
        self.pip = PipView(scale=6)
        # the window handles mouse input so Pip can be dragged from anywhere on it
        self.pip.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        lay.addStretch()  # the bubble grows upward, right above Pip
        lay.addWidget(self.bubble)
        lay.addWidget(self.pip, alignment=Qt.AlignmentFlag.AlignHCenter)

        self._press: QPoint | None = None
        self._grab = QPoint()
        self._dragging = False
        self._last_attention = time.monotonic()
        self._pokes = random.sample(d.COMPANION_POKES, len(d.COMPANION_POKES))

        self._bubble_timer = QTimer(self)
        self._bubble_timer.setSingleShot(True)
        self._bubble_timer.timeout.connect(self._hide_bubble)
        self._life = QTimer(self)
        self._life.timeout.connect(self._idle_tick)
        self._life.start(1000)
        self._next_hop = time.monotonic() + random.uniform(12, 25)
        self._next_ambient = time.monotonic() + random.uniform(120, 240)

        self._hold_bubble = False
        # Dock / resolution / monitor changes: stay visible
        for screen in QGuiApplication.screens():
            screen.availableGeometryChanged.connect(self.keep_on_screen)
        QGuiApplication.instance().screenRemoved.connect(lambda _s: self.keep_on_screen())
        self._place_initially()

    # --- placement -----------------------------------------------------------

    def _place_initially(self) -> None:
        screen = QGuiApplication.primaryScreen()
        if screen is None:
            return
        geo = screen.availableGeometry()
        self.move(geo.right() - self.width() - 40, geo.bottom() - self.height() - 40)

    def clamped(self, pos: QPoint) -> QPoint:
        """Keep the whole window on whichever screen its centre is on."""
        centre = pos + QPoint(self.width() // 2, self.height() // 2)
        screen = (QGuiApplication.screenAt(centre) or self.screen()
                  or QGuiApplication.primaryScreen())
        if screen is None:
            return pos
        geo = screen.availableGeometry()
        x = max(geo.left(), min(pos.x(), geo.right() - self.width() + 1))
        y = max(geo.top(), min(pos.y(), geo.bottom() - self.height() + 1))
        return QPoint(x, y)

    def keep_on_screen(self) -> None:
        self.move(self.clamped(self.pos()))

    def showEvent(self, event) -> None:
        super().showEvent(event)
        self.keep_on_screen()

    # --- talking -------------------------------------------------------------

    def say(self, line: Line, hold: bool = False) -> None:
        expression, text = line
        self._bubble_timer.stop()
        self._hold_bubble = hold
        self.bubble.show()
        self.bubble.type_text(text)
        if expression == "sleepy" and hold:
            self.pip.set_resting("sleepy")
        else:
            self.pip.show_expression(expression, 2400)

    def _schedule_bubble_hide(self) -> None:
        if not self._hold_bubble:
            self._bubble_timer.start(2600 + 45 * len(self.bubble.text()))

    def _hide_bubble(self) -> None:
        self.bubble.hide()

    def _attention(self) -> None:
        self._last_attention = time.monotonic()

    def poke(self) -> None:
        """Pip was clicked."""
        if self.pip.resting == "sleepy":
            self.pip.set_resting("idle")
            self.say(d.WAKE_UP)
        else:
            if not self._pokes:
                self._pokes = random.sample(d.COMPANION_POKES, len(d.COMPANION_POKES))
            self.say(self._pokes.pop())
        self.pip.hop()
        self._attention()

    def _idle_tick(self) -> None:
        now = time.monotonic()
        idle = now - self._last_attention
        if idle > SLEEP_AFTER and self.pip.resting != "sleepy":
            self.say(d.GOING_TO_SLEEP, hold=True)
            return
        if self.pip.resting == "sleepy":
            return
        if now >= self._next_hop:
            self.pip.hop()
            if random.random() < 0.3:
                self.pip.show_expression("smug", 1200)
            self._next_hop = now + random.uniform(12, 25)
        if now >= self._next_ambient and self.bubble.isHidden():
            self.say(random.choice(d.AMBIENT))
            self._next_ambient = now + random.uniform(120, 240)

    # --- mouse: drag, click, menu -------------------------------------------

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._press = event.globalPosition().toPoint()
            self._grab = self._press - self.frameGeometry().topLeft()
            self._dragging = False

    def mouseMoveEvent(self, event) -> None:
        if self._press is None:
            return
        pos = event.globalPosition().toPoint()
        if not self._dragging and (pos - self._press).manhattanLength() > DRAG_THRESHOLD:
            self._dragging = True
            self.pip.show_expression("happy", 100000)
        if self._dragging:
            self.move(self.clamped(pos - self._grab))

    def mouseReleaseEvent(self, event) -> None:
        if event.button() != Qt.MouseButton.LeftButton or self._press is None:
            return
        if self._dragging:
            self.keep_on_screen()
            self.pip.show_expression("smug", 1400)
            self._attention()
        else:
            self.poke()
        self._press = None
        self._dragging = False

    def contextMenuEvent(self, event) -> None:
        menu = QMenu(self)
        menu.addAction("Hide", self.hide_requested.emit)
        menu.addAction("Return to Folder", self.return_requested.emit)
        menu.addSeparator()
        menu.addAction("Quit", self.quit_requested.emit)
        self.pip.show_expression("blink", 600)
        menu.exec(event.globalPos())
