import json

import pytest

from app.features.tracks.repository import (
    CorruptLapError,
    InMemoryLapRepository,
    JsonLapRepository,
    LapAlreadyExistsError,
)
from app.shared.slug import Slug
from tests.features.tracks.helpers import lap


@pytest.fixture(params=["json", "memory"])
def repository(request, tmp_path):
    return JsonLapRepository(tmp_path) if request.param == "json" else InMemoryLapRepository()


def test_saves_and_reads_a_lap_back(repository):
    saved = lap(pts=((1.5, 2.5), (3.0, 4.0)))
    repository.save(saved)
    loaded = repository.get(Slug("monza"), Slug("sim-1-run-1-lap001"))
    assert loaded == saved


def test_unknown_lap_is_none(repository):
    assert repository.get(Slug("monza"), Slug("nope")) is None


def test_a_lap_is_never_overwritten(repository):
    repository.save(lap(lap_time_ms=9600))
    with pytest.raises(LapAlreadyExistsError):
        repository.save(lap(lap_time_ms=1))  # meme identifiant, autre contenu
    assert repository.get(Slug("monza"), Slug("sim-1-run-1-lap001")).summary.lap_time_ms == 9600


def test_lists_laps_and_tracks(repository):
    repository.save(lap("a-lap001", track="monza"))
    repository.save(lap("b-lap002", track="monza"))
    repository.save(lap("c-lap001", track="spa"))
    assert {str(s.lap_id) for s in repository.list_summaries(Slug("monza"))} == {"a-lap001", "b-lap002"}
    assert [str(t) for t in repository.list_tracks()] == ["monza", "spa"]
    assert repository.list_summaries(Slug("zandvoort")) == []


def test_json_file_layout_one_file_per_lap(tmp_path):
    JsonLapRepository(tmp_path).save(lap("a-lap001"))
    path = tmp_path / "tracks" / "monza" / "a-lap001.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    assert document["version"] == 1
    assert document["points"] == [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]]


def test_json_save_leaves_no_temporary_file(tmp_path):
    repository = JsonLapRepository(tmp_path)
    repository.save(lap("a-lap001"))
    with pytest.raises(LapAlreadyExistsError):
        repository.save(lap("a-lap001"))
    assert [p.name for p in (tmp_path / "tracks" / "monza").iterdir()] == ["a-lap001.json"]


def test_corrupt_file_is_skipped_in_listings_and_reported_on_read(tmp_path):
    repository = JsonLapRepository(tmp_path)
    repository.save(lap("a-lap001"))
    (tmp_path / "tracks" / "monza" / "b-lap002.json").write_text("{pas du json", encoding="utf-8")
    assert [str(s.lap_id) for s in repository.list_summaries(Slug("monza"))] == ["a-lap001"]
    with pytest.raises(CorruptLapError):
        repository.get(Slug("monza"), Slug("b-lap002"))


def test_a_tampered_file_does_not_break_the_listing(tmp_path):
    repository = JsonLapRepository(tmp_path)
    repository.save(lap("a-lap001"))
    repository.save(lap("b-lap002"))
    path = tmp_path / "tracks" / "monza" / "b-lap002.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    document["track"] = "../evil"
    path.write_text(json.dumps(document), encoding="utf-8")
    assert [str(s.lap_id) for s in repository.list_summaries(Slug("monza"))] == ["a-lap001"]


def test_file_with_a_tampered_identifier_is_corrupt(tmp_path):
    repository = JsonLapRepository(tmp_path)
    repository.save(lap("a-lap001"))
    path = tmp_path / "tracks" / "monza" / "a-lap001.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    document["lap_id"] = "../../evil"
    path.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(CorruptLapError):
        repository.get(Slug("monza"), Slug("a-lap001"))
