from do_not_open import dialogue as d
from do_not_open import story as st
from do_not_open.story import GameState, Story


def keys(story):
    return [f.key for f in story.visible_files()]


def solved_story():
    s = Story()
    s.open_folder()
    for key in ("grocery", "diary", "photo"):
        s.open_file(key)
    assert s.try_code(st.LOCK_CODE).ok
    return s


def test_fresh_story_starts_closed_with_no_files():
    s = Story()
    assert s.chapter == st.CLOSED
    assert keys(s) == []


def test_opening_folder_shows_files_but_no_lock():
    s = Story()
    assert s.open_folder() == d.FOLDER_OPENED
    assert s.chapter == st.INVESTIGATING
    assert "lock" not in keys(s)
    assert set(st.MYSTERY_KEYS) <= set(keys(s))
    assert s.open_folder() == d.FOLDER_REOPENED


def test_three_files_reveal_the_lock():
    s = Story()
    s.open_folder()
    s.open_file("readme")
    s.open_file("grocery")
    assert s.chapter == st.INVESTIGATING
    view = s.open_file("diary")
    assert view.became_suspicious
    assert s.chapter == st.SUSPICIOUS
    assert "lock" in keys(s)


def test_honest_file_and_rereads_do_not_count():
    s = Story()
    s.open_folder()
    s.open_file("honest")
    s.open_file("readme")
    s.open_file("readme")
    s.open_file("readme")
    assert s.chapter == st.INVESTIGATING
    assert s.mystery_opened() == ["readme"]


def test_rereading_gets_a_reread_whisper():
    s = Story()
    s.open_folder()
    s.open_file("grocery")
    assert s.open_file("grocery").whisper in d.REREAD_WHISPERS


def test_whispers_depend_on_what_was_already_opened():
    a = Story()
    a.open_folder()
    a.open_file("diary")
    assert a.open_file("photo").whisper == d.COMBO_WHISPERS[("diary", "photo")]

    b = Story()
    b.open_folder()
    assert b.open_file("photo").whisper == d.FIRST_WHISPERS["photo"]


def test_readme_opened_last_gets_special_line():
    s = Story()
    s.open_folder()
    for key in ("grocery", "diary", "photo"):
        s.open_file(key)
    assert s.open_file("readme").whisper == d.README_LAST


def test_cannot_open_files_that_are_not_there():
    s = Story()
    s.open_folder()
    try:
        s.open_file("lock")
    except KeyError:
        pass
    else:
        raise AssertionError("lock.sys should be hidden before 3 files are read")


def test_lock_code_is_digits_sorted_by_modified_date():
    by_date = sorted(st.MYSTERY_FILES, key=lambda f: f.modified)
    digits = ""
    for f in by_date:
        body = d.FILE_BODIES[f.key]
        digits += body[body.index("⟦") + 1]
    assert digits == st.LOCK_CODE


def test_wrong_codes_and_hints():
    s = Story()
    s.open_folder()
    for key in ("grocery", "diary", "photo"):
        s.open_file(key)
    assert s.try_code("12").line == d.CODE_INCOMPLETE
    assert s.state.wrong_attempts == 0
    assert s.try_code("1301").line == d.CODE_WRONG_ORDER
    r2 = s.try_code("9999")
    assert not r2.ok and not r2.show_hint
    r3 = s.try_code("0000")
    assert r3.show_hint
    assert s.state.wrong_attempts == 3
    assert s.chapter == st.SUSPICIOUS


def test_correct_code_meets_pip():
    s = solved_story()
    assert s.chapter == st.MET
    assert s.state.puzzle_solved
    assert "pip_home" in keys(s) and "lock" not in keys(s)


def test_intro_calls_back_to_opened_files_only():
    s = solved_story()  # grocery, diary, photo — no readme
    texts = [text for _, text in s.pip_intro()]
    assert d.INTRO_CALLBACKS["diary"][1] in texts
    assert d.INTRO_CALLBACKS["readme"][1] not in texts
    assert len(s.pip_intro()) >= 5


def test_decline_keeps_pip_inside_and_can_release_later():
    s = solved_story()
    assert s.decide(False) == d.DECLINED_FIRST
    assert s.chapter == st.INSIDE and not s.state.pip_released
    assert s.decide(False) == d.DECLINED_AGAIN
    assert s.decide(True) == d.GRANTED
    assert s.released and s.state.pip_released


def test_return_to_folder_and_release_again():
    s = solved_story()
    s.decide(True)
    s.return_to_folder()
    assert s.chapter == st.INSIDE and not s.state.pip_released
    s.decide(True)
    assert s.released


def test_reset_forgets_everything():
    s = solved_story()
    s.decide(True)
    s.reset()
    assert s.state == GameState()


def test_on_change_fires_for_progress():
    seen = []
    s = Story(on_change=lambda state: seen.append(state.chapter))
    s.open_folder()
    s.open_file("readme")
    assert seen == [st.INVESTIGATING, st.INVESTIGATING]


def test_at_least_twenty_handwritten_pip_lines():
    lines = (d.INTRO_OPEN + list(d.INTRO_CALLBACKS.values()) + d.INTRO_CLOSE
             + d.COMPANION_POKES + d.INSIDE_POKES + d.AMBIENT + d.DECLINED_FIRST)
    assert len({text for _, text in lines}) >= 20
