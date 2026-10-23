"""Small reusable widgets: typewriter text, glitchy labels, Pip, the folder, the photo."""
from __future__ import annotations

import html
import math
import random
import re

from PySide6.QtCore import QPointF, QRectF, Qt, QTimer, QVariantAnimation, Signal
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import QLabel, QWidget

from . import sprites, theme

GLITCH_CHARS = "▓▒░█#%&@$?!"
GLOW_RE = re.compile(r"⟦(.+?)⟧")


def strip_glow(text: str) -> str:
    return GLOW_RE.sub(r"\1", text)


def glow_html(text: str) -> str:
    """Plain text -> <pre> HTML with ⟦digits⟧ lit up."""
    escaped = html.escape(text)
    lit = GLOW_RE.sub(
        lambda m: (f'<span style="color:{theme.GLOW}; background:{theme.CHARCOAL}; '
                   f'font-weight:800;">&nbsp;{m.group(1)}&nbsp;</span>'),
        escaped)
    return f'<pre style="font-family:Menlo,monospace; white-space:pre-wrap; margin:0;">{lit}</pre>'


class TypewriterLabel(QLabel):
    """Reveals text a few characters at a time. Click to finish instantly."""
    finished = Signal()
    clicked = Signal()

    def __init__(self, parent=None, interval: int = 16, step: int = 2):
        super().__init__(parent)
        self.setWordWrap(True)
        self.setTextFormat(Qt.TextFormat.PlainText)
        self.setTextInteractionFlags(Qt.TextInteractionFlag.NoTextInteraction)
        self._full = ""
        self._html: str | None = None
        self._pos = 0
        self._step = step
        self._timer = QTimer(self)
        self._timer.setInterval(interval)
        self._timer.timeout.connect(self._tick)

    def type_text(self, text: str, html_final: str | None = None) -> None:
        self._full, self._html, self._pos = text, html_final, 0
        self.setTextFormat(Qt.TextFormat.PlainText)
        self.setText("")
        if text:
            self._timer.start()
        else:
            self._finish()

    def is_typing(self) -> bool:
        return self._timer.isActive()

    def skip(self) -> None:
        if self.is_typing():
            self._finish()

    def _tick(self) -> None:
        self._pos = min(len(self._full), self._pos + self._step)
        self.setText(self._full[:self._pos])
        if self._pos >= len(self._full):
            self._finish()

    def _finish(self) -> None:
        self._timer.stop()
        if self._html is not None:
            self.setTextFormat(Qt.TextFormat.RichText)
            self.setText(self._html)
        else:
            self.setText(self._full)
        self.finished.emit()

    def mousePressEvent(self, event) -> None:
        if self.is_typing():
            self.skip()
        else:
            self.clicked.emit()
        event.accept()


class GlitchLabel(QLabel):
    """A label that occasionally corrupts a few characters for a split second."""

    def __init__(self, text: str = "", parent=None, intensity: float = 0.25):
        super().__init__(text, parent)
        self._base = text
        self.intensity = intensity
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._glitch)
        self._restore = QTimer(self)
        self._restore.setSingleShot(True)
        self._restore.timeout.connect(lambda: self.setText(self._base))
        self._timer.start(random.randint(1200, 4000))

    def set_base(self, text: str) -> None:
        self._base = text
        self.setText(text)

    def burst(self) -> None:
        """Glitch right now, harder."""
        self._corrupt(4)

    def _corrupt(self, n: int) -> None:
        if not self._base.strip():
            return
        chars = list(self._base)
        for _ in range(n):
            i = random.randrange(len(chars))
            if chars[i] != " ":
                chars[i] = random.choice(GLITCH_CHARS)
        self.setText("".join(chars))
        self._restore.start(110)

    def _glitch(self) -> None:
        if random.random() < self.intensity:
            self._corrupt(random.randint(1, 3))
        self._timer.start(random.randint(900, 4000))


class Shaker:
    """Gives a custom-painted widget a decaying horizontal shake offset."""

    def __init__(self, widget: QWidget, amplitude: float = 6.0, duration: int = 420):
        self.offset = 0.0
        self._amp = amplitude
        self._anim = QVariantAnimation(widget)
        self._anim.setStartValue(0.0)
        self._anim.setEndValue(1.0)
        self._anim.setDuration(duration)
        self._anim.valueChanged.connect(lambda t: self._step(widget, float(t)))
        self._anim.finished.connect(lambda: self._step(widget, 1.0))

    def shake(self) -> None:
        self._anim.stop()
        self._anim.start()

    def _step(self, widget: QWidget, t: float) -> None:
        self.offset = math.sin(t * math.pi * 8) * (1 - t) * self._amp
        widget.update()


class PipView(QWidget):
    """Pip, animated: gentle bob, random blinks, temporary expressions, hops."""
    clicked = Signal()

    def __init__(self, scale: int = 6, parent=None):
        super().__init__(parent)
        self.scale = scale
        self.resting = "idle"          # what Pip goes back to
        self.expression = "idle"
        self._phase = random.random() * math.tau
        self._hop = 0.0
        self.setFixedSize(16 * scale, 19 * scale)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        self._tick = QTimer(self)
        self._tick.timeout.connect(self._animate)
        self._tick.start(50)
        self._blink = QTimer(self)
        self._blink.setSingleShot(True)
        self._blink.timeout.connect(self._do_blink)
        self._blink.start(random.randint(1800, 4500))
        self._revert = QTimer(self)
        self._revert.setSingleShot(True)
        self._revert.timeout.connect(self._back_to_rest)
        self._hop_anim = QVariantAnimation(self)
        self._hop_anim.setStartValue(0.0)
        self._hop_anim.setEndValue(1.0)
        self._hop_anim.setDuration(360)
        self._hop_anim.valueChanged.connect(self._hop_step)
        self.shaker = Shaker(self, amplitude=scale * 0.8)

    def set_resting(self, name: str) -> None:
        self.resting = name
        if not self._revert.isActive():
            self.expression = name
            self.update()

    def show_expression(self, name: str, ms: int = 1800) -> None:
        self.expression = name
        self._revert.start(ms)
        self.update()

    def hop(self) -> None:
        self._hop_anim.stop()
        self._hop_anim.start()

    def _hop_step(self, t) -> None:
        self._hop = math.sin(float(t) * math.pi) * self.scale * 2
        self.update()

    def _back_to_rest(self) -> None:
        self.expression = self.resting
        self.update()

    def _do_blink(self) -> None:
        if self.expression in ("idle", "happy") and not self._revert.isActive():
            self.expression = "blink"
            self._revert.start(130)
            self.update()
        self._blink.start(random.randint(2200, 6000))

    def _animate(self) -> None:
        speed = 0.06 if self.resting == "sleepy" else 0.14
        self._phase = (self._phase + speed) % math.tau
        self.update()

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        s = self.scale
        bob = math.sin(self._phase) * s * 0.5
        lift = bob + self._hop
        # soft shadow shrinks as Pip rises
        shadow_w = 11 * s - lift * 0.8
        shadow = QColor(theme.CHARCOAL)
        shadow.setAlpha(40)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(shadow)
        p.drawEllipse(QRectF((self.width() - shadow_w) / 2 + self.shaker.offset,
                             17.6 * s, shadow_w, 1.2 * s))
        y = s * 1.2 - lift
        p.drawPixmap(QPointF(self.shaker.offset, round(y)), sprites.pip_pixmap(self.expression, s))

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton and self.rect().contains(event.position().toPoint()):
            self.clicked.emit()


class FolderIcon(QWidget):
    """The big pixel folder. Something peeks through the slit now and then."""
    clicked = Signal()

    def __init__(self, scale: int = 9, parent=None):
        super().__init__(parent)
        self.scale = scale
        self._eyes = False
        self.setFixedSize(18 * scale + 24, 13 * scale + 12)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.shaker = Shaker(self, amplitude=8)
        self._peek = QTimer(self)
        self._peek.setSingleShot(True)
        self._peek.timeout.connect(self._toggle_eyes)
        self._peek.start(random.randint(2500, 5000))

    def _toggle_eyes(self) -> None:
        self._eyes = not self._eyes
        self.update()
        self._peek.start(random.randint(500, 1100) if self._eyes else random.randint(3000, 7000))

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        p.drawPixmap(QPointF(12 + self.shaker.offset, 6), sprites.folder_pixmap(self.scale, self._eyes))

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.shaker.shake()
            self.clicked.emit()


class PhotoView(QWidget):
    """photo_0001.png: corrupted static with two eyes that follow your cursor
    (only while it's over this widget — Pip promised no snooping)."""

    COLS, ROWS = 32, 20

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(320, 200)
        self.setMouseTracking(True)
        self._look = QPointF(0, 0)
        self._closed = False
        self._noise = self._make_noise()
        self._static = QTimer(self)
        self._static.timeout.connect(self._refresh_noise)
        self._static.start(120)
        self._blink = QTimer(self)
        self._blink.setSingleShot(True)
        self._blink.timeout.connect(self._toggle_blink)
        self._blink.start(2500)

    def _make_noise(self) -> list[list[QColor]]:
        palette = [QColor(theme.CHARCOAL), QColor("#3b3242"), QColor("#4a3f52"),
                   QColor(theme.LAVENDER).darker(260), QColor(theme.ROSE).darker(300)]
        return [[random.choice(palette) for _ in range(self.COLS)] for _ in range(self.ROWS)]

    def _refresh_noise(self) -> None:
        for _ in range(40):
            r, c = random.randrange(self.ROWS), random.randrange(self.COLS)
            self._noise[r][c] = random.choice([self._noise[random.randrange(self.ROWS)][c],
                                               QColor("#4a3f52"), QColor(theme.CHARCOAL)])
        self.update()

    def _toggle_blink(self) -> None:
        self._closed = not self._closed
        self.update()
        self._blink.start(140 if self._closed else random.randint(2000, 5000))

    def mouseMoveEvent(self, event) -> None:
        pos = event.position()
        self._look = QPointF((pos.x() / max(1, self.width())) - 0.5,
                             (pos.y() / max(1, self.height())) - 0.5)

    def leaveEvent(self, event) -> None:
        self._look = QPointF(0, 0)

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        cell = min(self.width() / self.COLS, self.height() / self.ROWS)
        ox = (self.width() - cell * self.COLS) / 2
        oy = (self.height() - cell * self.ROWS) / 2
        p.setPen(Qt.PenStyle.NoPen)
        for r, row in enumerate(self._noise):
            for c, color in enumerate(row):
                p.fillRect(QRectF(ox + c * cell, oy + r * cell, cell + 0.5, cell + 0.5), color)
        # a glitch bar now and then
        if random.random() < 0.15:
            bar = QColor(theme.ROSE)
            bar.setAlpha(70)
            p.fillRect(QRectF(ox, oy + random.randrange(self.ROWS) * cell, cell * self.COLS, cell), bar)
        # the eyes
        for ex in (12, 18):
            ey = 9
            if self._closed:
                p.fillRect(QRectF(ox + ex * cell, oy + (ey + 1) * cell, cell * 2, cell * 0.5), QColor(theme.PEARL))
                continue
            p.fillRect(QRectF(ox + ex * cell, oy + ey * cell, cell * 2, cell * 2), QColor(theme.PEARL))
            dx = round(self._look.x() * 2) * 0.5
            dy = round(self._look.y() * 2) * 0.5
            p.fillRect(QRectF(ox + (ex + 0.5 + dx) * cell, oy + (ey + 0.5 + dy) * cell, cell, cell),
                       QColor(theme.CHARCOAL))


class GlitchOverlay(QWidget):
    """Full-window flash of scanline glitch bars. Purely decorative."""

    def __init__(self, parent: QWidget):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        self.hide()
        self._timer = QTimer(self)
        self._timer.timeout.connect(self.update)
        self._stop = QTimer(self)
        self._stop.setSingleShot(True)
        self._stop.timeout.connect(self._end)

    def flash(self, ms: int = 480) -> None:
        self.setGeometry(self.parentWidget().rect())
        self.raise_()
        self.show()
        self._timer.start(40)
        self._stop.start(ms)

    def _end(self) -> None:
        self._timer.stop()
        self.hide()

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        for _ in range(random.randint(4, 9)):
            color = QColor(random.choice([theme.ROSE, theme.LAVENDER, theme.CHARCOAL, theme.GLOW]))
            color.setAlpha(random.randint(50, 140))
            h = random.randint(3, 18)
            y = random.randint(0, max(0, self.height() - h))
            x = random.randint(-40, 40)
            p.fillRect(x, y, self.width(), h, color)
