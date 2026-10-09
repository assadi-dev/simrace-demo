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
        lap_samples(2, last_lap_ms=9000)[:5],  # debut du tour 2: dans le premier secteur
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
        "pieces_enabled": True, "pieces_saved": 0, "duplicate_pieces": 0,
        "pieces_rejected": {}, "pieces_by_trigger": {},
    }


def test_laps_flow_from_ingestion_to_the_tracks_api(client):
    post_two_laps(client)
    # 2 tours complets, chacun coupe en 3 morceaux (2 changements de secteur + la ligne)
    assert client.get("/tracks").json() == [
        {"track": "monza", "lap_count": 2, "best_lap_ms": 9000, "piece_count": 6}
    ]
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


def test_pieces_are_listed_with_their_trigger_and_sector(client):
    post_two_laps(client)
    pieces = client.get("/tracks/monza/pieces").json()
    assert len(pieces) == 6
    assert {p["reason"] for p in pieces} == {"sector", "lap_end"}
    assert [(p["lap_number"], p["piece_index"]) for p in pieces[:3]] == [(0, 0), (0, 1), (0, 2)]
    assert all("points" not in p for p in pieces)
    assert all(p["start_pos"] < p["end_pos"] and p["length_m"] > 0 for p in pieces)


def test_get_a_piece_with_its_trace(client):
    post_two_laps(client)
    first = client.get("/tracks/monza/pieces").json()[0]
    piece = client.get(f"/tracks/monza/pieces/{first['piece_id']}").json()
    assert piece["piece_id"] == first["piece_id"]
    assert len(piece["points"]) == first["point_count"] > 10
    assert all(len(point) == 2 for point in piece["points"])


def test_recorder_status_counts_pieces_by_trigger(client):
    post_two_laps(client)
    status = client.get("/recorder/status").json()
    assert status["pieces_saved"] == 6
    assert status["pieces_by_trigger"] == {"sector": 4, "lap_end": 2}
    assert status["pieces_rejected"] == {}


def test_pause_mid_lap_saves_a_piece_even_though_no_lap_is_complete(client):
    half_lap = lap_samples(0)[:300]
    paused = [{**half_lap[-1], "status": 3, "t_ms": half_lap[-1]["t_ms"] + 16}]
    client.post("/ingest/batches", json=batch(1, half_lap + paused))
    assert client.get("/tracks").json() == [
        {"track": "monza", "lap_count": 0, "best_lap_ms": None, "piece_count": 2}
    ]
    assert client.get("/tracks/monza/laps").status_code == 404
    reasons = [p["reason"] for p in client.get("/tracks/monza/pieces").json()]
    assert reasons == ["sector", "pause"]


def test_unknown_piece_and_track_are_404_and_bad_ids_are_422(client):
    assert client.get("/tracks/spa/pieces").status_code == 404
    post_two_laps(client)
    response = client.get("/tracks/monza/pieces/nope")
    assert (response.status_code, response.json()["error"]) == (404, "PieceNotFoundError")
    assert client.get("/tracks/monza/pieces/UPPER").status_code == 422


def test_pieces_can_be_disabled_while_laps_still_record(tmp_path):
    settings = Settings(data_dir=tmp_path, track_points=200, record_pieces=False)
    client = TestClient(ApiApplication.create(settings))
    post_two_laps(client)
    status = client.get("/recorder/status").json()
    assert (status["laps_saved"], status["pieces_enabled"], status["pieces_saved"]) == (2, False, 0)
    assert client.get("/tracks").json()[0]["piece_count"] == 0


def test_pieces_are_files_in_a_pieces_folder_and_survive_a_restart(settings, clock):
    first = TestClient(ApiApplication.create(settings, clock))
    post_two_laps(first)
    folder = settings.data_dir / "tracks" / "monza" / "pieces"
    assert len(list(folder.glob("*.json"))) == 6
    restarted = TestClient(ApiApplication.create(settings, clock))
    assert len(restarted.get("/tracks/monza/pieces").json()) == 6


def test_replaying_the_same_run_does_not_duplicate_pieces(settings, clock):
    post_two_laps(TestClient(ApiApplication.create(settings, clock)))
    restarted = TestClient(ApiApplication.create(settings, clock))
    post_two_laps(restarted)
    status = restarted.get("/recorder/status").json()
    assert (status["pieces_saved"], status["duplicate_pieces"]) == (0, 6)
    assert len(list((settings.data_dir / "tracks" / "monza" / "pieces").glob("*.json"))) == 6


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
