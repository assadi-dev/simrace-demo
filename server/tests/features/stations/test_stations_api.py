from tests.support import batch


def test_no_station_before_any_batch(client):
    assert client.get("/stations").json() == []


def test_lists_a_station_with_its_session_and_machine(client):
    client.post("/ingest/batches", json=batch(1, machine="PC-SIM-01"))
    [station] = client.get("/stations").json()
    assert station["station_id"] == "sim-1"
    assert station["machine"] == "PC-SIM-01"
    assert station["session"]["track"] == "monza"
    assert station["online"] is True


def test_get_one_station(client):
    client.post("/ingest/batches", json=batch(1))
    assert client.get("/stations/sim-1").json()["station_id"] == "sim-1"


def test_unknown_station_is_a_404(client):
    response = client.get("/stations/nope")
    assert response.status_code == 404
    assert response.json()["error"] == "StationNotFoundError"


def test_station_goes_offline_after_silence(client, clock):
    client.post("/ingest/batches", json=batch(1))
    assert client.get("/stations/sim-1").json()["online"] is True
    clock.advance(30)
    assert client.get("/stations/sim-1").json()["online"] is False


def test_each_station_keeps_its_own_counters(client):
    client.post("/ingest/batches", json=batch(1, station_id="sim-1"))
    client.post("/ingest/batches", json=batch(1, station_id="sim-1"))
    client.post("/ingest/batches", json=batch(1, station_id="sim-2"))
    stations = {s["station_id"]: s for s in client.get("/stations").json()}
    assert stations["sim-1"]["duplicates"] == 1
    assert stations["sim-2"]["duplicates"] == 0
