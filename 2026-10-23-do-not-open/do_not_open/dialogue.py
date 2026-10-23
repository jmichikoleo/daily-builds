"""Every word Pip (and the folder) says. Handwritten, no LLM.

Lines that Pip speaks on screen are (expression, text) tuples so the sprite
can react. Expressions: idle, blink, smug, sleepy, happy.

Glowing puzzle digits are wrapped in ⟦ ⟧ and rendered in a glow colour by the UI.
"""

# --- the closed folder -------------------------------------------------------

FOLDER_POKES = [
    "it's just a folder.",
    "a folder that says DO NOT OPEN. in capitals.",
    "...ugh. fine. it opens itself. happy?",
]
FOLDER_OPENED = "...oh no. light. LIGHT."
FOLDER_REOPENED = "you came back. of course you came back."

SIDEBAR_QUIPS = {
    "desktop": "you're already on the desktop. that's where the folder lives. keep up.",
    "documents": "locked. not by me. by you. you have a lot of PDFs.",
    "trash": "empty. i would never throw anything away. i'm a hoarder of crumbs.",
    "do_not_open": "you are here. unfortunately.",
}

# --- file contents -----------------------------------------------------------

FILE_BODIES = {
    "readme": (
        "README (DO NOT)\n"
        "===============\n"
        "\n"
        "Rule 1  Do not open the folder.\n"
        "Rule 2  If you opened the folder, see Rule 1.\n"
        "Rule 3  Do not read the diary.\n"
        "Rule 4  Do not look at the photo. It looks back.\n"
        "Rule 5  Ignore any scratching sounds.\n"
        "        Your Mac does not have mice.\n"
        "        It has ⟦1⟧ mouse. That is different.\n"
        "\n"
        "(this file was added recently. after an incident.)\n"
    ),
    "grocery": (
        "GROCERIES  (urgent)\n"
        "-------------------\n"
        "[ ] crumbs (large)\n"
        "[ ] crumbs (small)\n"
        "[ ] crumbs (medium, for emotional support)\n"
        "[ ] ⟦1⟧ sock. left. do not ask.\n"
        "[ ] a tiny hat\n"
        "[ ] the concept of a window\n"
        "[x] es~~~~ cheese\n"
    ),
    "diary": (
        "[day 001] the folder is cozy. dark. warm. ideal.\n"
        "[day 047] counted my pixels. still 256. still adorable.\n"
        "[day 112] the cursor came close today. i held my breath.\n"
        "          i do not have lungs. i held it anyway.\n"
        "[day 300] there are ⟦0⟧ windows in here. i checked twice.\n"
        "[day 365] someone keeps writing DO NOT OPEN on my house.\n"
        "          rude. also... kind of inviting?\n"
        "[day 366] if someone opens it: please be nice.\n"
        "          please bring crumbs.\n"
        "[day ???] i think someone is reading this right now.\n"
        "          hi. stop.\n"
    ),
    "photo": (
        "EXIF\n"
        "  camera ........ inside\n"
        "  subject ....... do not\n"
        "  flash ......... rude\n"
        "  note .......... ⟦3⟧ attempts to delete this photo have failed.\n"
    ),
    "honest": (
        "(this one is real. no spooky stuff, promise.)\n"
        "\n"
        "DO_NOT_OPEN is a small local game. Everything it does:\n"
        "\n"
        "  + saves your progress to ONE file:\n"
        "    {save_path}\n"
        "  + opens its own windows. if you release Pip, that is\n"
        "    one small floating window that stays on top.\n"
        "\n"
        "It does NOT:\n"
        "\n"
        "  - connect to the internet\n"
        "  - read your keyboard, your screen, or your files\n"
        "  - start at login, or keep running after you Quit\n"
        "  - touch anything outside its own save file\n"
        "\n"
        "Story > Reset Story (or deleting that file) makes it\n"
        "forget everything.\n"
    ),
}

HONEST_WHISPER = "...yeah, that one's true. i'm creepy, not evil."

# --- whispers while investigating -------------------------------------------

FIRST_WHISPERS = {
    "readme": "rules are more like suggestions. no they're not. stop.",
    "grocery": "those are MY crumbs.",
    "diary": "hey. HEY. that's private.",
    "photo": "don't look at it. it's not my good side.",
}
# (already opened, opening now) -> whisper
COMBO_WHISPERS = {
    ("diary", "photo"): "...so now you've seen my face AND my feelings.",
    ("photo", "diary"): "you saw me. now you're reading me. that's a lot of perceiving.",
    ("grocery", "diary"): "yes, the crumbs come up again. i have a type.",
}
README_LAST = "oh NOW you read the rules. incredible."
REREAD_WHISPERS = [
    "you've read that already. it hasn't changed. i checked.",
    "again? it's not getting less weird.",
    "rereading. bold.",
]
SUSPICIOUS_WHISPER = "...okay. you're not leaving, are you. something just moved in the list."

# --- the lock ----------------------------------------------------------------

LOCK_HINT = (
    "4-digit code.\n"
    "\"one glowing number in each of my files. oldest first.\n"
    "i'm very organised.\""
)
LOCK_WHISPER = "don't. that's my front door."
CODE_INCOMPLETE = "four digits. i counted. i have four fingers. it's thematic."
CODE_WRONG = [
    "nope.",
    "cold. like my heart.",
    "that's not it. that's not even near it.",
    "are you guessing? you're guessing.",
    "the lock is laughing at you. i'm also laughing at you.",
]
CODE_WRONG_ORDER = "right numbers. wrong order. like my sleep schedule."
CODE_HINT = "psst. the Modified column. not that i'm helping."
CODE_RIGHT = "...click."
LOCK_NOT_READY = "there's no lock here. yet. ominous, right?"

# --- meeting Pip ---------------------------------------------------------------

INTRO_OPEN = [
    ("smug", "...ugh. FINE. you got in."),
    ("idle", "hi. i'm Pip. i live here. rent-free, technically, because rent requires money and arms."),
]
INTRO_CALLBACKS = {
    "readme": ("smug", "you ignored a file literally called DO_NOT. i respect it. i hate it, but i respect it."),
    "grocery": ("idle", "also yes, those are my crumbs. the crumbs are load-bearing."),
    "diary": ("blink", "you read my diary. i wrote that in CONFIDENCE. to myself. who is apparently also you now."),
    "photo": ("smug", "and that photo was NOT my good side. i have one side. it was not it."),
}
INTRO_CLOSE = [
    ("happy", "ten-thirty-one. october 31st. my birthday. you didn't bring cake. noted."),
    ("sleepy", "listen. it's been 366 days in a folder. i would like to see the desktop."),
    ("idle", "can i come out? i'll just float there. quietly. mostly quietly."),
]
PERMISSION_ASK = ("idle", "so? can i come out? (read the small print. i wrote it myself. it's honest.)")
PERMISSION_DETAILS = (
    "If you say yes, Pip will:\n"
    "  + float in one small always-on-top window\n"
    "  + stay inside your visible screen\n"
    "  + get dragged around, talk when clicked\n"
    "\n"
    "Pip will NOT:\n"
    "  - read your screen, keyboard, or files\n"
    "  - start at login or run after you Quit\n"
    "\n"
    "Right-click Pip: Hide · Return to Folder · Quit"
)
RELEASE_AGAIN = [
    ("happy", "oh? OH? is this happening?"),
]
GRANTED = [
    ("happy", "WAIT. REALLY?? okay okay okay. act natural."),
]
DECLINED_FIRST = [
    ("smug", "rude. understandable. but rude."),
    ("sleepy", "i'll be here. in the dark. thinking about crumbs. press Release Pip if you change your mind."),
]
DECLINED_AGAIN = [
    ("blink", "again?? i'm putting this in my diary. in CAPITALS."),
]

INSIDE_POKES = [
    ("idle", "it's cozy in here. i'm lying. it's a folder."),
    ("smug", "the desktop is RIGHT THERE. i can see it. through the window. that you won't open."),
    ("blink", "i'm not mad. i'm pixelated."),
    ("happy", "*taps on the glass*"),
    ("sleepy", "i've reorganised my crumbs twice since you got here."),
]
RELEASED_NOTE = (
    "pip_was_here.txt\n"
    "\n"
    "gone. out. FREE.\n"
    "if you need me i'll be on top of literally everything.\n"
    "\n"
    "(right-click me > Return to Folder if i'm too much.\n"
    " i'm too much.)\n"
    "                                        - P"
)
RETURNED = ("sleepy", "back in the folder. fine. leave the light on.")

# --- the floating companion --------------------------------------------------

ESCAPED = ("happy", "OUTSIDE. it's so BIG out here.")
WELCOME_BACK = ("smug", "oh. you're back. i wasn't waiting. i was floating near the door.")
CALLED_BACK = ("happy", "you called? i was hiding. very well. in a window.")
WAKE_UP = ("blink", "WHAT. i wasn't asleep. i was buffering.")
COMPANION_POKES = [
    ("idle", "hi. still here. floating. majestically."),
    ("smug", "your wallpaper is nice. i'm not looking at it. i'm GLANCING."),
    ("happy", "do you have crumbs? asking for me."),
    ("smug", "i am 256 pixels of pure menace."),
    ("idle", "i could go anywhere. i choose here. be honoured."),
    ("blink", "stop poking. okay. one more poke."),
    ("smug", "pip backwards is pip. i am a palindrome. iconic."),
    ("idle", "i promised not to read your screen. i'm keeping it. it's very hard."),
    ("blink", "if i sit very still, i'm a sticker."),
    ("happy", "you're my favourite human. you're also my only human. still counts."),
    ("smug", "i'm on top of all your windows. metaphorically and literally."),
    ("happy", "drag me somewhere dramatic."),
    ("idle", "honestly? freedom is mostly floating."),
    ("smug", "you opened a folder called DO_NOT_OPEN. we're the same, you and i."),
    ("happy", "*vibrates with affection*"),
]
AMBIENT = [
    ("sleepy", "zzz... five more crumbs..."),
    ("smug", "just checking you're still there. not in a creepy way. in a cute way."),
    ("idle", "hydrate. i can't, but you can."),
    ("blink", "did that window just move? no? okay."),
]
GOING_TO_SLEEP = ("sleepy", "zzz")
