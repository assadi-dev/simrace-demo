import asyncio

import pytest
from fastapi.testclient import TestClient

from app.hub import Hub
from app.main import create_app

SESSION = {"track": "monza", "car": "ferrari_296_gt3", "driver": "A B"}


def sample(**overrides) -> dict:
    base = {
        "t_ms": 1, "packet_id": 1, "speed_kmh": 120.0, "gas": 0.5, "brake": 0.0, "gear": 3,
        "rpm": 6000, "steer": 0.1, "status": 2, "completed_laps": 1, "lap_time_ms": 30_000,
        "last_lap_ms": 0, "best_lap_ms": 0, "sector": 0, "in_pit": False, "track_pos": 0.4,
    }
    return base | overrides


def batch(seq: int, samples: list[dict] | None = None, run_id: str = "run-1") -> dict:
    return {
        "station_id": "sim-1", "run_id": run_id, "seq": seq, "session": SESSION,
        "samples": samples if samples is not None else [sample()],
    }


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_accepts_valid_batch(client):
    response = client.post("/ingest/batches", json=batch(1))
    assert response.status_code == 200
    assert response.json() == {
        "station_id": "sim-1", "run_id": "run-1", "seq": 1,
        "status": "accepted", "accepted": 1, "rejected": 0,
    }


def test_duplicate_batch_is_acknowledged_but_not_counted(client):
    client.post("/ingest/batches", json=batch(1))
    response = client.post("/ingest/batches", json=batch(1))
    assert response.json()["status"] == "duplicate"
    station = client.get("/stations").json()[0]
    assert station["batches"] == 1
    assert station["duplicates"] == 1


def test_gap_is_counted(client):
    client.post("/ingest/batches", json=batch(1))
    client.post("/ingest/batches", json=batch(4))
    assert client.get("/stations").json()[0]["gaps"] == 2


def test_new_run_id_restarts_numbering(client):
    client.post("/ingest/batches", json=batch(1))
    client.post("/ingest/batches", json=batch(2))
    response = client.post("/ingest/batches", json=batch(1, run_id="run-2"))
    assert response.json()["status"] == "accepted"


def test_invalid_samples_are_rejected_individually(client):
    samples = [sample(), sample(speed_kmh=900), sample(lap_time_ms=-5), sample(track_pos=0.9)]
    ack = client.post("/ingest/batches", json=batch(1, samples)).json()
    assert (ack["accepted"], ack["rejected"]) == (2, 2)
    reasons = client.get("/stations").json()[0]["reject_reasons"]
    assert set(reasons) == {"speed_kmh:less_than_equal", "lap_time_ms:greater_than_equal"}


def test_malformed_envelope_is_a_422(client):
    assert client.post("/ingest/batches", json={"seq": 1}).status_code == 422


def test_station_goes_offline_after_silence():
    from datetime import UTC, datetime, timedelta

    now = [datetime(2026, 10, 9, tzinfo=UTC)]
    app = create_app()
    app.state.registry._clock = lambda: now[0]
    client = TestClient(app)
    client.post("/ingest/batches", json=batch(1))
    assert client.get("/stations").json()[0]["online"] is True
    now[0] += timedelta(seconds=30)
    assert client.get("/stations").json()[0]["online"] is False


def test_hub_slow_subscriber_loses_oldest_events():
    async def scenario():
        hub = Hub(queue_size=2)
        queue = hub.subscribe()
        for i in range(4):
            hub.publish("samples", {"n": i})
        return [queue.get_nowait().data["n"] for _ in range(2)]

    assert asyncio.run(scenario()) == [2, 3]
