"""Entry point and the little controller that connects the folder and Pip."""
from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QObject
from PySide6.QtWidgets import QApplication

from . import dialogue as d
from .companion import CompanionWindow
from .folder_window import FolderWindow
from .save import load_state, save_path, save_state
from .story import GameState, Story
from .theme import STYLESHEET


class Game(QObject):
    def __init__(self, app: QApplication, save_file: Path | None = None):
        super().__init__()
        self.app = app
        self.save_file = save_file or save_path()
        self.story = Story(load_state(self.save_file), on_change=self._save)
        self.companion: CompanionWindow | None = None
        self.folder = FolderWindow(self)

    def _save(self, state: GameState) -> None:
        try:
            save_state(state, self.save_file)
        except OSError as exc:  # the game still works, it just forgets
            print(f"DO_NOT_OPEN: could not save ({exc})", file=sys.stderr)

    def save_now(self) -> None:
        self._save(self.story.state)

    def start(self) -> None:
        self.folder.show()
        if self.story.released:
            self.show_companion(d.WELCOME_BACK)

    # --- Pip on the desktop --------------------------------------------------

    def show_companion(self, line=d.ESCAPED) -> None:
        if self.companion is None:
            self.companion = CompanionWindow()
            self.companion.hide_requested.connect(self.hide_pip)
            self.companion.return_requested.connect(self.return_pip)
            self.companion.quit_requested.connect(self.quit)
        self.companion.show()
        self.companion.say(line)

    def hide_pip(self) -> None:
        if self.companion:
            self.companion.hide()
        self.folder.on_pip_hidden()

    def call_pip(self) -> None:
        self.show_companion(d.CALLED_BACK)
        self.folder.on_pip_called()

    def return_pip(self) -> None:
        self._close_companion()
        self.folder.on_pip_returned(self.story.return_to_folder())

    def _close_companion(self) -> None:
        if self.companion is not None:
            self.companion.close()
            self.companion.deleteLater()
            self.companion = None

    # --- app lifecycle -------------------------------------------------------

    def reset(self) -> None:
        self._close_companion()
        self.story.reset()
        self.folder.on_reset()

    def folder_closed(self) -> None:
        # Pip floating on its own keeps the app open; otherwise closing = quitting
        if self.companion is None or not self.companion.isVisible():
            self.quit()

    def quit(self) -> None:
        self.save_now()
        self._close_companion()
        self.app.quit()


def main(argv: list[str] | None = None) -> int:
    QApplication.setApplicationName("DO_NOT_OPEN")
    app = QApplication(argv if argv is not None else sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setStyleSheet(STYLESHEET)
    game = Game(app)
    game.start()
    return app.exec()
