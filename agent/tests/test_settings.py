from simrace_agent import settings

DEFAULTS = {"server": "http://localhost:8000", "station": "PC-1", "folder": "C:/rec"}


def test_missing_file_gives_defaults(tmp_path):
    assert settings.load(tmp_path / "absent.json", DEFAULTS) == DEFAULTS


def test_saved_values_override_defaults(tmp_path):
    path = tmp_path / "sub" / "settings.json"
    settings.save(path, {"server": " http://10.0.0.5:8000 ", "station": "sim-2", "folder": "D:/r"})
    assert settings.load(path, DEFAULTS) == {
        "server": "http://10.0.0.5:8000", "station": "sim-2", "folder": "D:/r",
    }


def test_damaged_or_empty_values_fall_back_to_defaults(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text("{pas du json", encoding="utf-8")
    assert settings.load(path, DEFAULTS) == DEFAULTS

    path.write_text('{"server": "", "station": 3, "inconnu": "x"}', encoding="utf-8")
    assert settings.load(path, DEFAULTS) == DEFAULTS
