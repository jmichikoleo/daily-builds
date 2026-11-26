# backend/app/text.py: tokenizing english, indonesian and korean text, plus cross language aliases.
# The same interest can show up as "music", "musik", "음악" or "lagu". aliases fold them into one term.
import re
import unicodedata

STOP_EN = set("""a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her here
hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once
only or other our ours out over own same she should so some such than that the their them then there these they this
those through to too under until up very was we were what when where which while who whom why will with would you your
yours yourself yourselves let lets get got make made use used using new add added adds update updated updates fix fixed
fixes one two three via per etc ok okay yes like want need please thanks thank hi hello also still back way thing things
much many really well even every let's i'm it's don't can't i've you're that's what's there's dont cant im ive into onto
first last next than then them also other others another such each both any every lot lots bit kind sure maybe might
must shall may done doing go going gone come came see seen look looks looking show shows shown try tried tries
file files line lines page pages set sets run runs ran work works worked change changes changed move moved remove removed
keep kept start started stop stopped open opened close closed check checks checked test tests tested make makes
claude code session main phase doc docs readme commit commits merge merged branch md json ts tsx js py css html
co authored authored noreply anthropic com https http www github sonnet opus fable haiku null true false none""".split())
STOP_ID = set("""yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau ada saya kamu kita mereka
sudah belum bisa harus jadi karena seperti lebih sangat hanya oleh agar supaya kalau jika bagaimana apa siapa mana""".split())
STOP_KO = set("""그리고 그런데 하지만 그래서 이것 저것 그것 있는 없는 하는 합니다 입니다 있습니다 해주세요 해줘 수정 추가 확인 부탁
이거 저거 그거 이렇게 저렇게 그렇게 좀 더 잘 다시 지금 오늘 내일 어제 우리 저는 제가 나는 내가 너는""".split())
STOP = STOP_EN | STOP_ID | STOP_KO

ALIASES = {
    # music
    "musik": "music", "음악": "music", "lagu": "song", "노래": "song", "songs": "song", "songwriting": "song",
    "lyrics": "lyric", "가사": "lyric", "lirik": "lyric", "melody": "music", "spotify": "music", "playlist": "music",
    # research
    "논문": "paper", "papers": "paper", "penelitian": "research", "riset": "research", "연구": "research",
    "researcher": "research", "thesis": "paper", "manuscript": "paper", "arxiv": "paper", "citation": "paper",
    "citations": "paper", "실험": "experiment", "experiments": "experiment", "eksperimen": "experiment",
    "patents": "patent", "특허": "patent", "paten": "patent", "benchmark": "benchmark", "benchmarks": "benchmark",
    # study
    "공부": "study", "belajar": "study", "studying": "study", "courses": "course", "수업": "course", "kuliah": "course",
    "강의": "lecture", "lectures": "lecture", "exam": "exam", "시험": "exam", "ujian": "exam", "grades": "grade", "gpa": "grade",
    # making
    "games": "game", "게임": "game", "permainan": "game", "arcade": "game", "puzzle": "game", "puzzles": "game",
    "designs": "design", "디자인": "design", "desain": "design", "ui": "design", "ux": "design", "typography": "design",
    "photos": "photo", "사진": "photo", "foto": "photo", "camera": "photo", "recipes": "recipe", "레시피": "recipe",
    "resep": "recipe", "cooking": "recipe", "baking": "recipe", "travel": "travel", "여행": "travel", "perjalanan": "travel",
    "deploy": "deploy", "deployed": "deploy", "deployment": "deploy", "launchd": "deploy", "tailscale": "deploy",
    "netlify": "deploy", "server": "server", "servers": "server", "backups": "backup", "restore": "backup",
    "ai": "ai", "llm": "ai", "llms": "ai", "gpt": "ai", "openai": "ai", "model": "model", "models": "model",
    "agents": "agent", "agentic": "agent", "iphone": "ios", "swiftui": "ios", "ipad": "ios", "xcode": "ios",
    "notes": "note", "노트": "note", "catatan": "note", "journal": "journal", "일기": "journal", "diary": "journal",
}

WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9\-']{1,}|[가-힣]{2,}")
HANGUL_PARTICLES = re.compile(r"(은|는|이|가|을|를|에|에서|으로|로|와|과|의|도|만|까지|부터|하고|이랑|랑|에게|한테)$")


def tokens(text: str) -> list[str]:
    text = unicodedata.normalize("NFKC", text or "").lower()
    text = re.sub(r"https?://\S+|`[^`]*`|\b[0-9a-f]{7,40}\b", " ", text)
    out = []
    for w in WORD.findall(text):
        w = w.strip("-'")
        if re.match(r"[가-힣]", w):
            w = HANGUL_PARTICLES.sub("", w) if len(w) > 2 else w
        elif w.endswith("'s"):
            w = w[:-2]
        if len(w) < 2 or w in STOP or w.isdigit():
            continue
        w = ALIASES.get(w, w)
        if w in STOP:
            continue
        out.append(w)
    return out


def normalize_name(name: str) -> str:
    """entity resolution key for projects: 'Mochi-Research Lab' and 'research-lab' meet at 'researchlab'."""
    n = unicodedata.normalize("NFKC", name or "").lower()
    n = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", n)       # dated daily build folders
    n = re.sub(r"(^mochi[s]?['’]?s?[\s._\-]*|[\s._\-]*mochi$)", "", n)
    n = re.sub(r"[^a-z0-9가-힣]", "", n)
    return n or re.sub(r"[^a-z0-9]", "", (name or "").lower())
