import json

import pytest

from app.features.tracks.repository import (
    CorruptLapError,
    InMemoryPieceRepository,
    JsonLapRepository,
    JsonPieceRepository,
    PieceAlreadyExistsError,
)
from app.shared.slug import Slug
from tests.features.tracks.helpers import lap, piece


@pytest.fixture(params=["json", "memory"])
def repository(request, tmp_path):
    return JsonPieceRepository(tmp_path) if request.param == "json" else InMemoryPieceRepository()


def test_saves_and_reads_a_piece_back(repository):
    saved = piece(pts=((1.5, 2.5), (3.0, 4.0)))
    repository.save(saved)
    assert repository.get(Slug("monza"), Slug("sim-1-run-1-p1000")) == saved


def test_unknown_piece_is_none(repository):
    assert repository.get(Slug("monza"), Slug("nope")) is None


def test_a_piece_is_never_overwritten(repository):
    repository.save(piece(reason="sector"))
    with pytest.raises(PieceAlreadyExistsError):
        repository.save(piece(reason="pause"))  # meme identifiant, autre contenu
    assert repository.get(Slug("monza"), Slug("sim-1-run-1-p1000")).summary.reason == "sector"


def test_lists_pieces_and_tracks(repository):
    repository.save(piece("a-p1", track="monza"))
    repository.save(piece("b-p2", track="monza"))
    repository.save(piece("c-p1", track="spa"))
    assert {str(s.piece_id) for s in repository.list_summaries(Slug("monza"))} == {"a-p1", "b-p2"}
    assert [str(t) for t in repository.list_tracks()] == ["monza", "spa"]
    assert repository.list_summaries(Slug("zandvoort")) == []


def test_json_layout_one_file_per_piece_in_a_pieces_folder(tmp_path):
    JsonPieceRepository(tmp_path).save(piece("a-p1"))
    path = tmp_path / "tracks" / "monza" / "pieces" / "a-p1.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    assert document["version"] == 1
    assert document["reason"] == "sector"
    assert document["points"] == [[0.0, 0.0], [5.0, 0.0], [10.0, 0.0]]


def test_pieces_and_laps_do_not_mix_in_the_same_data_folder(tmp_path):
    pieces, laps = JsonPieceRepository(tmp_path), JsonLapRepository(tmp_path)
    pieces.save(piece("a-p1"))
    laps.save(lap("a-lap001"))
    assert [str(s.lap_id) for s in laps.list_summaries(Slug("monza"))] == ["a-lap001"]
    assert [str(s.piece_id) for s in pieces.list_summaries(Slug("monza"))] == ["a-p1"]
    # un circuit qui n'a que des morceaux n'apparait pas parmi ceux qui ont des tours
    pieces.save(piece("z-p1", track="spa"))
    assert [str(t) for t in laps.list_tracks()] == ["monza"]
    assert [str(t) for t in pieces.list_tracks()] == ["monza", "spa"]


def test_json_save_leaves_no_temporary_file(tmp_path):
    repository = JsonPieceRepository(tmp_path)
    repository.save(piece("a-p1"))
    with pytest.raises(PieceAlreadyExistsError):
        repository.save(piece("a-p1"))
    assert [p.name for p in (tmp_path / "tracks" / "monza" / "pieces").iterdir()] == ["a-p1.json"]


def test_corrupt_piece_is_skipped_in_listings_and_reported_on_read(tmp_path):
    repository = JsonPieceRepository(tmp_path)
    repository.save(piece("a-p1"))
    (tmp_path / "tracks" / "monza" / "pieces" / "b-p2.json").write_text("{pas du json", "utf-8")
    assert [str(s.piece_id) for s in repository.list_summaries(Slug("monza"))] == ["a-p1"]
    with pytest.raises(CorruptLapError):
        repository.get(Slug("monza"), Slug("b-p2"))


def test_unknown_reason_in_a_file_is_corrupt_not_a_crash(tmp_path):
    repository = JsonPieceRepository(tmp_path)
    repository.save(piece("a-p1"))
    path = tmp_path / "tracks" / "monza" / "pieces" / "a-p1.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    document["reason"] = "inconnu"
    path.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(CorruptLapError):
        repository.get(Slug("monza"), Slug("a-p1"))
