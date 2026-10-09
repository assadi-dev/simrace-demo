from app.features.ingestion.events import SamplesAccepted
from tests.support import batch, sample


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
    assert client.get("/stations").json()[0]["gaps"] == 0


def test_invalid_samples_are_rejected_individually(client):
    samples = [sample(), sample(speed_kmh=900), sample(lap_time_ms=-5), sample(track_pos=0.9)]
    ack = client.post("/ingest/batches", json=batch(1, samples)).json()
    assert (ack["accepted"], ack["rejected"]) == (2, 2)
    reasons = client.get("/stations").json()[0]["reject_reasons"]
    assert set(reasons) == {"speed_kmh:less_than_equal", "lap_time_ms:greater_than_equal"}


def test_batch_of_only_invalid_samples_is_still_a_sign_of_life(client, clock):
    client.post("/ingest/batches", json=batch(1, [sample(speed_kmh=900)]))
    clock.advance(1)
    assert client.get("/stations").json()[0]["online"] is True


def test_malformed_envelope_is_a_422(client):
    assert client.post("/ingest/batches", json={"seq": 1}).status_code == 422


def test_batch_too_large_is_a_422(client):
    too_many = [sample() for _ in range(601)]
    assert client.post("/ingest/batches", json=batch(1, too_many)).status_code == 422


def test_machine_name_is_exposed_and_kept_when_omitted(client):
    client.post("/ingest/batches", json=batch(1, machine="PC-SIM-01"))
    assert client.get("/stations").json()[0]["machine"] == "PC-SIM-01"
    client.post("/ingest/batches", json=batch(2))  # ancien agent: pas de nom
    assert client.get("/stations").json()[0]["machine"] == "PC-SIM-01"


def test_machine_name_is_optional(client):
    client.post("/ingest/batches", json=batch(1))
    assert client.get("/stations").json()[0]["machine"] is None


def test_publishes_accepted_samples_but_not_rejected_ones(client, container):
    events: list[SamplesAccepted] = []
    container.event_bus.subscribe(SamplesAccepted, events.append)
    client.post("/ingest/batches", json=batch(1, [sample(), sample(speed_kmh=900)]))
    assert len(events) == 1
    assert len(events[0].samples) == 1
    assert events[0].station_id == "sim-1"


def test_duplicate_batch_publishes_nothing(client, container):
    events: list[SamplesAccepted] = []
    container.event_bus.subscribe(SamplesAccepted, events.append)
    client.post("/ingest/batches", json=batch(1))
    client.post("/ingest/batches", json=batch(1))
    assert len(events) == 1


def test_broken_subscriber_never_fails_ingestion(client, container):
    def broken(_event):
        raise RuntimeError("boom")

    container.event_bus.subscribe(SamplesAccepted, broken)
    assert client.post("/ingest/batches", json=batch(1)).status_code == 200


def test_health_reports_subscribers(client):
    assert client.get("/health").json() == {"status": "ok", "subscribers": 0}
