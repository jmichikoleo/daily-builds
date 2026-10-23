"""Write Pip's sprite sheet to assets/ as PNG (1x and 8x).

    python tools/export_sprites.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PySide6.QtGui import QGuiApplication  # noqa: E402

from do_not_open import sprites  # noqa: E402


def main() -> None:
    app = QGuiApplication(sys.argv)  # noqa: F841 — QPixmap needs an app
    out = ROOT / "assets"
    out.mkdir(exist_ok=True)
    for scale, name in ((1, "pip_sprite_sheet.png"), (8, "pip_sprite_sheet@8x.png")):
        sprites.sprite_sheet(scale).save(str(out / name))
        print("wrote", out / name)
    print("frames:", ", ".join(sprites.EXPRESSION_NAMES))


if __name__ == "__main__":
    main()
