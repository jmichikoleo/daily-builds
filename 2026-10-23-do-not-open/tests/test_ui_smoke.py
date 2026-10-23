"""Drive the real windows headlessly (Qt offscreen) through the whole story."""
import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
QtWidgets = pytest.importorskip("PySide6.QtWidgets")

from do_not_open import story as st  # noqa: E402
from do_not_open.app import Game  # noqa: E402
from do_not_open.save import load_state  # noqa: E402


@pytest.fixture(scope="module")
def qapp():
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    app.setQuitOnLastWindowClosed(False)
    return app


def test_full_playthrough(qapp, tmp_path):
    path = tmp_path / "save.json"
    game = Game(qapp, save_file=path)
    game.start()
    win = game.folder
    assert win.pages.currentIndex() == 0          # closed folder

    win._open_folder()
    assert win.pages.currentIndex() == 1
    for key in ("readme", "grocery", "diary", "photo"):
        win.select(key)
        qapp.processEvents()
    assert game.story.chapter == st.SUSPICIOUS
    assert win._item_for("lock") is not None

    win.select("lock")
    win._try_code("1234")
    assert game.story.chapter == st.SUSPICIOUS
    win._try_code(st.LOCK_CODE)
    assert game.story.chapter == st.MET

    win.select("pip_home")
    assert win.preview.currentWidget() is win.stage
    win._decline()
    assert game.story.chapter == st.INSIDE
    assert game.companion is None

    win._grant()
    assert game.story.released
    game.show_companion()                          # what the stage does after Pip's line
    assert game.companion.isVisible()
    from PySide6.QtCore import Qt
    flags = game.companion.windowFlags()
    assert flags & Qt.WindowType.WindowStaysOnTopHint
    assert flags & Qt.WindowType.FramelessWindowHint
    game.companion.poke()

    game.hide_pip()
    assert not game.companion.isVisible()
    game.call_pip()
    assert game.companion.isVisible()

    game.return_pip()
    assert game.companion is None
    assert game.story.chapter == st.INSIDE
    assert load_state(path).chapter == st.INSIDE

    game.reset()
    assert load_state(path).chapter == st.CLOSED
    win.close()


def test_companion_stays_on_screen(qapp, tmp_path):
    from PySide6.QtCore import QPoint
    from do_not_open.companion import CompanionWindow

    pip = CompanionWindow()
    geo = qapp.primaryScreen().availableGeometry()
    far = pip.clamped(QPoint(geo.right() + 5000, geo.bottom() + 5000))
    assert far.x() + pip.width() - 1 <= geo.right()
    assert far.y() + pip.height() - 1 <= geo.bottom()
    neg = pip.clamped(QPoint(-5000, -5000))
    assert neg.x() >= geo.left() and neg.y() >= geo.top()
    pip.close()
