import json

from do_not_open import save
from do_not_open import story as st
from do_not_open.story import GameState, Story


def test_round_trip(tmp_path):
    path = tmp_path / "save.json"
    s = Story(on_change=lambda state: save.save_state(state, path))
    s.open_folder()
    for key in ("readme", "photo", "diary"):
        s.open_file(key)
    s.try_code("0000")
    s.try_code(st.LOCK_CODE)
    s.decide(True)

    loaded = save.load_state(path)
    assert loaded == s.state
    assert loaded.chapter == st.RELEASED
    assert loaded.opened_files == ["readme", "photo", "diary"]
    assert loaded.puzzle_solved and loaded.pip_released
    assert loaded.wrong_attempts == 1


def test_saved_json_has_the_required_fields(tmp_path):
    path = tmp_path / "save.json"
    save.save_state(GameState(chapter=st.INVESTIGATING, opened_files=["grocery"]), path)
    data = json.loads(path.read_text())
    for field in ("chapter", "opened_files", "puzzle_solved", "pip_released"):
        assert field in data
    assert not (tmp_path / "save.json.tmp").exists()


def test_missing_or_corrupt_save_gives_fresh_story(tmp_path):
    assert save.load_state(tmp_path / "nope.json") == GameState()
    bad = tmp_path / "bad.json"
    bad.write_text("{ this is not json")
    assert save.load_state(bad) == GameState()
    bad.write_text(json.dumps({"chapter": "the void"}))
    assert save.load_state(bad) == GameState()


def test_load_cleans_up_tampered_values(tmp_path):
    path = tmp_path / "save.json"
    path.write_text(json.dumps({
        "chapter": "inside",
        "opened_files": ["diary", "diary", "/etc/passwd", "photo"],
        "wrong_attempts": -5,
        "pip_released": True,
    }))
    state = save.load_state(path)
    assert state.opened_files == ["diary", "photo"]
    assert state.wrong_attempts == 0
    assert state.puzzle_solved and not state.pip_released


def test_save_dir_is_app_data_not_cwd(monkeypatch, tmp_path):
    monkeypatch.setenv("DO_NOT_OPEN_HOME", str(tmp_path))
    assert save.save_path() == tmp_path / "save.json"
    monkeypatch.delenv("DO_NOT_OPEN_HOME")
    monkeypatch.setattr(save.sys, "platform", "darwin")
    assert "Application Support" in str(save.app_data_dir())
