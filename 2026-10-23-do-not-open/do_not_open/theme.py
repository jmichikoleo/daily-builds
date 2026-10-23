"""Colours and the Qt stylesheet. Pearl pink, dusty rose, lavender, charcoal."""

PEARL = "#fbf1f3"
PEARL_DEEP = "#f3e1e6"
ROSE = "#d99aa8"
ROSE_DEEP = "#b46c7e"
LAVENDER = "#b8a6d9"
LAVENDER_SOFT = "#e6def2"
CHARCOAL = "#2b2530"
CHARCOAL_SOFT = "#5a4f60"
GLOW = "#ff6f91"

MONO = "Menlo, 'SF Mono', Monaco, 'Courier New', monospace"

STYLESHEET = f"""
QWidget {{ color: {CHARCOAL}; font-size: 13px; }}
QMainWindow {{ background: {PEARL}; }}

#Panel {{
    background: rgba(255, 251, 252, 0.72);
    border: 1px solid rgba(180, 108, 126, 0.28);
    border-radius: 14px;
}}
#Header {{
    background: rgba(43, 37, 48, 0.88);
    border-radius: 12px;
}}
#HeaderPath {{ color: {PEARL}; font-family: {MONO}; font-size: 13px; }}
#ChapterChip {{
    color: {CHARCOAL}; background: {ROSE}; border-radius: 9px;
    padding: 3px 10px; font-family: {MONO}; font-size: 11px; font-weight: 700;
}}

#SidebarTitle {{ color: {CHARCOAL_SOFT}; font-size: 11px; font-weight: 700; letter-spacing: 1px; }}
#SidebarItem {{
    text-align: left; padding: 6px 10px; border: none; border-radius: 8px;
    background: transparent; color: {CHARCOAL};
}}
#SidebarItem:hover {{ background: rgba(184, 166, 217, 0.30); }}
#SidebarItem[active="true"] {{ background: rgba(217, 154, 168, 0.45); font-weight: 700; }}
#CaseCard {{
    background: rgba(43, 37, 48, 0.06); border-radius: 10px;
    font-family: {MONO}; font-size: 11px; color: {CHARCOAL_SOFT}; padding: 8px;
}}

QTreeWidget {{
    background: transparent; border: none; outline: none;
    font-family: {MONO}; font-size: 12px;
}}
QTreeWidget::item {{ padding: 5px 2px; border-radius: 6px; }}
QTreeWidget::item:hover {{ background: rgba(184, 166, 217, 0.25); }}
QTreeWidget::item:selected {{ background: rgba(217, 154, 168, 0.55); color: {CHARCOAL}; }}
QHeaderView::section {{
    background: transparent; border: none; border-bottom: 1px solid rgba(43,37,48,0.12);
    padding: 4px; color: {CHARCOAL_SOFT}; font-size: 11px; font-weight: 700;
}}

#FileTitle {{ font-family: {MONO}; font-size: 15px; font-weight: 700; color: {CHARCOAL}; }}
#FileMeta {{ font-family: {MONO}; font-size: 11px; color: {CHARCOAL_SOFT}; }}
#FileBody {{ font-family: {MONO}; font-size: 13px; color: {CHARCOAL}; }}
#Muted {{ color: {CHARCOAL_SOFT}; font-style: italic; }}
#BigTitle {{ font-family: {MONO}; font-size: 30px; font-weight: 800; color: {CHARCOAL}; letter-spacing: 2px; }}

#WhisperBar {{
    background: rgba(43, 37, 48, 0.88); border-radius: 12px;
}}
#Whisper {{ color: {PEARL_DEEP}; font-style: italic; font-size: 13px; }}
#WhisperMark {{ color: {GLOW}; font-size: 15px; }}
#Progress {{ color: {ROSE}; font-family: {MONO}; font-size: 11px; }}

QPushButton {{
    background: {PEARL}; border: 1px solid {ROSE}; border-radius: 10px;
    padding: 7px 16px; color: {CHARCOAL}; font-weight: 600;
}}
QPushButton:hover {{ background: {LAVENDER_SOFT}; border-color: {LAVENDER}; }}
QPushButton:pressed {{ background: {ROSE}; }}
QPushButton#Primary {{ background: {CHARCOAL}; color: {PEARL}; border-color: {CHARCOAL}; }}
QPushButton#Primary:hover {{ background: {ROSE_DEEP}; border-color: {ROSE_DEEP}; }}
QPushButton#Ghost {{ background: transparent; border: none; color: {CHARCOAL_SOFT}; font-weight: 500; }}
QPushButton#Ghost:hover {{ color: {ROSE_DEEP}; }}

QLineEdit#Digit {{
    font-family: {MONO}; font-size: 28px; font-weight: 800; color: {CHARCOAL};
    background: rgba(255,255,255,0.85); border: 2px solid {LAVENDER};
    border-radius: 10px; padding: 4px; selection-background-color: {ROSE};
}}
QLineEdit#Digit:focus {{ border-color: {GLOW}; }}
#LockFeedback {{ font-family: {MONO}; color: {ROSE_DEEP}; font-size: 13px; }}
#LockHint {{ font-family: {MONO}; color: {CHARCOAL_SOFT}; font-size: 12px; }}

#Bubble {{
    background: rgba(255, 251, 252, 0.96); border: 2px solid {CHARCOAL};
    border-radius: 14px; padding: 10px 14px; font-size: 14px; color: {CHARCOAL};
}}
#Permission {{
    background: rgba(230, 222, 242, 0.75); border: 1px dashed {LAVENDER};
    border-radius: 10px; padding: 10px 12px;
    font-family: {MONO}; font-size: 11px; color: {CHARCOAL};
}}

QMenu {{
    background: {PEARL}; border: 1px solid {ROSE}; border-radius: 8px; padding: 4px;
}}
QMenu::item {{ padding: 6px 18px; border-radius: 6px; }}
QMenu::item:selected {{ background: {LAVENDER_SOFT}; color: {CHARCOAL}; }}
QScrollArea {{ background: transparent; border: none; }}
QScrollArea > QWidget > QWidget {{ background: transparent; }}
QSplitter::handle {{ background: transparent; width: 8px; }}
"""
