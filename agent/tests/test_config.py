from simrace_agent import config


def test_env_file_sets_server_url(tmp_path, monkeypatch):
    monkeypatch.delenv("SIMRACE_SERVER_URL", raising=False)
    env = tmp_path / ".env"
    env.write_text('# commentaire\nSIMRACE_SERVER_URL="http://192.168.1.50:8000"\n', encoding="utf-8")
    config.load_env_file(env)
    assert config.server_url() == "http://192.168.1.50:8000"


def test_real_environment_wins_over_env_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SIMRACE_SERVER_URL", "http://serveur:9000")
    env = tmp_path / ".env"
    env.write_text("SIMRACE_SERVER_URL=http://autre:1\n", encoding="utf-8")
    config.load_env_file(env)
    assert config.server_url() == "http://serveur:9000"


def test_default_when_nothing_set(monkeypatch):
    monkeypatch.delenv("SIMRACE_SERVER_URL", raising=False)
    assert config.server_url() == config.DEFAULT_SERVER_URL
