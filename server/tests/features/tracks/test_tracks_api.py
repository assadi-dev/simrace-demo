import pytest
from fastapi.testclient import TestClient

from app.main import ApiApplication
from app.shared.config import Settings
from tests.support import batch, lap_samples


def post_two_laps(client: TestClient, run_id: str = "run-1", station_id: str = "sim-1") -> None:
    """Tours 0 (9600 ms) et 1 (9000 ms) complets, puis le debut du tour 2 qui cloture le 1."""
    batches = [
        lap_samples(0),
        lap_samples(1, last_lap_ms=9600),
        lap_samples(2, count=5, last_lap_ms=9000),
    ]
    for seq, samples in enumerate(batches, start=1):
        response = client.post(
            "/ingest/batches", json=batch(seq, samples, run_id=run_id, station_id=station_id)
        )
        assert response.status_code == 200


def test_nothing_recorded_yet(client):
    assert client.get("/tracks").json() == []
    assert client.get("/recorder/status").json() == {
        "enabled": True, "laps_saved": 0, "duplicate_laps": 0, "rejected": {}, "discarded": {},
    }


def test_laps_flow_from_ingestion_to_the_tracks_api(client):
    post_two_laps(client)
    assert client.get("/tracks").json() == [{"track": "monza", "lap_count": 2, "best_lap_ms": 9000}]
    assert client.get("/recorder/status").json()["laps_saved"] == 2


def test_lists_laps_newest_first_with_their_summary(client):
    post_two_laps(client)
    laps = client.get("/tracks/monza/laps").json()
    assert {lap["lap_id"] for lap in laps} == {"sim-1-run-1-lap000", "sim-1-run-1-lap001"}
    assert all(lap["track"] == "monza" and lap["station_id"] == "sim-1" for lap in laps)
    assert "points" not in laps[0]


def test_get_a_lap_with_its_trace(client):
    post_two_laps(client)
    lap = client.get("/tracks/monza/laps/sim-1-run-1-lap001").json()
    assert lap["lap_time_ms"] == 9000
    assert len(lap["points"]) == 200  # SIMRACE_TRACK_POINTS des tests
    assert all(len(point) == 2 for point in lap["points"])


def test_reference_is_the_best_lap_by_default(client):
    post_two_laps(client)
    reference = client.get("/tracks/monza/reference").json()
    assert reference["lap_id"] == "sim-1-run-1-lap001"
    assert reference["strategy"] == "best_time"
    assert len(reference["points"]) == 200


def test_reference_strategy_is_configurable(tmp_path):
    settings = Settings(data_dir=tmp_path, track_points=200, reference_strategy="latest")
    client = TestClient(ApiApplication.create(settings))
    post_two_laps(client)
    assert client.get("/tracks/monza/reference").json()["strategy"] == "latest"


def test_unknown_track_and_lap_are_404(client):
    assert client.get("/tracks/spa/reference").status_code == 404
    assert client.get("/tracks/spa/laps").status_code == 404
    post_two_laps(client)
    response = client.get("/tracks/monza/laps/nope")
    assert response.status_code == 404
    assert response.json()["error"] == "LapNotFoundError"


@pytest.mark.parametrize("path", ["/tracks/Bad Name/laps", "/tracks/monza/laps/UPPER", "/tracks/-x/reference"])
def test_malformed_identifiers_are_a_422_not_a_file_access(client, path):
    assert client.get(path).status_code == 422


def test_path_traversal_attempts_never_reach_the_disk(client, tmp_path):
    outside = tmp_path.parent / "secret.json"
    outside.write_text("{}", encoding="utf-8")
    for path in ("/tracks/..%2F..%2Fsecret/laps", "/tracks/monza/laps/..%2F..%2F..%2Fsecret"):
        assert client.get(path).status_code in (404, 422)


def test_recording_can_be_disabled(tmp_path):
    settings = Settings(data_dir=tmp_path, track_points=200, record_tracks=False)
    client = TestClient(ApiApplication.create(settings))
    post_two_laps(client)
    assert client.get("/tracks").json() == []
    assert client.get("/recorder/status").json()["enabled"] is False


def test_laps_are_persisted_as_one_file_each_and_survive_a_restart(settings, clock):
    first = TestClient(ApiApplication.create(settings, clock))
    post_two_laps(first)
    files = sorted((settings.data_dir / "tracks" / "monza").glob("*.json"))
    assert [f.name for f in files] == ["sim-1-run-1-lap000.json", "sim-1-run-1-lap001.json"]

    restarted = TestClient(ApiApplication.create(settings, clock))
    assert restarted.get("/tracks").json()[0]["lap_count"] == 2
    assert restarted.get("/tracks/monza/reference").status_code == 200


def test_replaying_the_same_run_does_not_duplicate_or_overwrite_files(settings, clock):
    first = TestClient(ApiApplication.create(settings, clock))
    post_two_laps(first)
    original = (settings.data_dir / "tracks" / "monza" / "sim-1-run-1-lap000.json").read_text("utf-8")

    restarted = TestClient(ApiApplication.create(settings, clock))
    post_two_laps(restarted)  # meme station, meme run_id: memes identifiants de tours
    status = restarted.get("/recorder/status").json()
    assert (status["laps_saved"], status["duplicate_laps"]) == (0, 2)
    assert (settings.data_dir / "tracks" / "monza" / "sim-1-run-1-lap000.json").read_text("utf-8") == original
    assert len(list((settings.data_dir / "tracks" / "monza").glob("*.json"))) == 2


def test_a_second_run_adds_new_files_next_to_the_first(client, settings):
    post_two_laps(client, run_id="run-1")
    post_two_laps(client, run_id="run-2")
    assert len(list((settings.data_dir / "tracks" / "monza").glob("*.json"))) == 4
