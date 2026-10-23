"""Pip and friends, drawn as pixel grids. This file IS the art source.

Each grid row is a string; each character is a palette key ('.' = transparent).
Expressions are small overlays stamped onto Pip's body, so every frame shares
one silhouette. `python tools/export_sprites.py` writes the PNG sprite sheet.
"""
from __future__ import annotations

from functools import lru_cache

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QIcon, QImage, QPainter, QPixmap

PALETTE = {
    "k": "#2b2530",  # charcoal outline
    "p": "#f8dfe4",  # pearl pink body
    "r": "#d99aa8",  # dusty rose shading
    "l": "#b8a6d9",  # muted lavender
    "m": "#ddd2ee",  # pale lavender
    "w": "#fffbfd",  # highlight
    "e": "#1f1a24",  # eyes
    "b": "#f08da4",  # blush
    "d": "#3b3242",  # deep shadow
    "g": "#ff6f91",  # glow
}

PIP_BODY = [
    "...l........l...",
    "..lml......lml..",
    "...k........k...",
    "...k........k...",
    "..kkkkkkkkkkkk..",
    ".kppppppppppppk.",
    "kpwppppppppppppk",
    "kwpppppppppppppk",
    "kppppppppppppppk",
    "kppppppppppppppk",
    "kppppppppppppprk",
    "kppppppppppppprk",
    ".kpppppppppprrk.",
    ".krrppppppprrrk.",
    "..kkrrkkkkrrkk..",
    "...kkk....kkk...",
]

# (row, col, pixels) stamps; '.' inside a stamp means "leave as is"
_BLUSH = [(10, 2, "bb"), (10, 12, "bb")]
_SMILE = [(11, 6, "k..k"), (12, 7, "kk")]
EXPRESSIONS: dict[str, list[tuple[int, int, str]]] = {
    "idle": [(7, 4, "we"), (8, 4, "ee"), (9, 4, "ee"),
             (7, 10, "we"), (8, 10, "ee"), (9, 10, "ee"), *_BLUSH, *_SMILE],
    "blink": [(9, 4, "ee"), (9, 10, "ee"), *_BLUSH, *_SMILE],
    "smug": [(8, 3, "kkk"), (9, 4, "ee"), (8, 10, "kkk"), (9, 10, "ee"),
             *_BLUSH, (12, 7, "kk"), (11, 9, "k")],
    "sleepy": [(9, 3, "e..e"), (10, 4, "ee"), (9, 9, "e..e"), (10, 10, "ee"),
               (10, 1, "b"), (10, 14, "b"), (12, 7, "rr"),
               (0, 13, "lll"), (1, 14, "l"), (2, 13, "lll")],
    "happy": [(7, 4, "ee"), (8, 3, "e..e"), (7, 10, "ee"), (8, 9, "e..e"),
              *_BLUSH, (11, 6, "kbbk"), (12, 7, "kk")],
}
EXPRESSION_NAMES = tuple(EXPRESSIONS)

FOLDER = [
    ".kkkkkk...........",
    "kmmmmmmk..........",
    "kllllllkkkkkkkkkk.",
    "kmmmmmmmmmmmmmmmmk",
    "kddddddddddddddddk",
    "kllllllllllllllllk",
    "kllllllllllllllllk",
    "kbbkkbbkkbbkkbbkkk",
    "kllllllllllllllllk",
    "kllllllllllllllllk",
    "kllllllllllllllllk",
    "krrrrrrrrrrrrrrrrk",
    ".kkkkkkkkkkkkkkkk.",
]
FOLDER_EYES = [(4, 7, "w"), (4, 10, "w")]

PAGE = [
    "kkkkkkk...",
    "kwwwwwkk..",
    "kwwwwwkwk.",
    "kwwwwwkkkk",
    "kwccccwwwk",
    "kwwwwwwwwk",
    "kwccccccwk",
    "kwwwwwwwwk",
    "kwcccccwwk",
    "kwwwwwwwwk",
    "kwccccccwk",
    "kkkkkkkkkk",
]
LOCK_ICON = [
    "...kkkk...",
    "..k....k..",
    "..k....k..",
    "..k....k..",
    "kkkkkkkkkk",
    "kllllllllk",
    "kllldelllk",
    "kllleellk.",
    "kllleelllk",
    "kllllllllk",
    "kmmmmmmmmk",
    "kkkkkkkkkk",
]
PHOTO_ICON = [
    "kkkkkkkkkk",
    "kddddddddk",
    "kdwddddwdk",
    "kdeddddedk",
    "kddddddddk",
    "kdddkkdddk",
    "kddddddddk",
    "kllllllllk",
    "klmmmmmmlk",
    "kllllllllk",
    "kkkkkkkkkk",
    "..........",
]
# per-file accent for the page icon's text lines ('c')
ICON_ACCENTS = {"readme": "#ff6f91", "grocery": "#d99aa8", "diary": "#b8a6d9", "honest": "#7fb7a4"}


def _stamp(grid: list[str], stamps) -> list[str]:
    rows = [list(r) for r in grid]
    for row, col, pixels in stamps:
        for i, ch in enumerate(pixels):
            if ch != ".":
                rows[row][col + i] = ch
    return ["".join(r) for r in rows]


def pip_grid(expression: str) -> list[str]:
    return _stamp(PIP_BODY, EXPRESSIONS[expression])


def grid_image(grid: list[str], palette: dict[str, str] | None = None) -> QImage:
    palette = palette or PALETTE
    img = QImage(len(grid[0]), len(grid), QImage.Format.Format_ARGB32)
    img.fill(Qt.GlobalColor.transparent)
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch != ".":
                img.setPixelColor(x, y, QColor(palette[ch]))
    return img


def scaled(img: QImage, scale: int) -> QPixmap:
    return QPixmap.fromImage(img.scaled(img.width() * scale, img.height() * scale,
                                        Qt.AspectRatioMode.IgnoreAspectRatio,
                                        Qt.TransformationMode.FastTransformation))


@lru_cache(maxsize=None)
def pip_pixmap(expression: str, scale: int) -> QPixmap:
    return scaled(grid_image(pip_grid(expression)), scale)


def folder_pixmap(scale: int, eyes: bool) -> QPixmap:
    grid = _stamp(FOLDER, FOLDER_EYES) if eyes else FOLDER
    return scaled(grid_image(grid), scale)


def file_icon(key: str) -> QIcon:
    if key == "pip_home":
        return QIcon(pip_pixmap("idle", 2))
    if key == "lock":
        grid = LOCK_ICON
    elif key == "photo":
        grid = PHOTO_ICON
    else:
        grid = PAGE
    palette = {**PALETTE, "c": ICON_ACCENTS.get(key, "#d99aa8")}
    return QIcon(scaled(grid_image(grid, palette), 2))


def sprite_sheet(scale: int = 1, padding: int = 2) -> QImage:
    """All expressions side by side, for the exported PNG asset."""
    cell = 16 + padding * 2
    sheet = QImage(cell * len(EXPRESSIONS) * scale, cell * scale, QImage.Format.Format_ARGB32)
    sheet.fill(Qt.GlobalColor.transparent)
    painter = QPainter(sheet)
    for i, name in enumerate(EXPRESSIONS):
        painter.drawPixmap((i * cell + padding) * scale, padding * scale, pip_pixmap(name, scale))
    painter.end()
    return sheet
