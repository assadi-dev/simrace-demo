from app.features.tracks.domain import PieceReason
from app.features.tracks.pieces import PieceCutter
from app.features.tracks.strategy import DistanceThinningResampler
from app.shared.contract import Sample
from tests.features.tracks.helpers import SESSION, points
from tests.support import sample


def feed(cutter: PieceCutter, raw: list[dict], lap_closed_at: set[int] = frozenset()):
    """Pousse des echantillons un par un; `lap_closed_at` = indices ou le LapAssembler a ferme un tour."""
    pieces = []
    for i, s in enumerate(raw):
        pieces += cutter.push(Sample.model_validate(s), SESSION, lap_closed=i in lap_closed_at)
    return pieces


def run(n: int, sector: int = 0, start: int = 0, **extra) -> list[dict]:
    """n echantillons en conduite, sur la piste, avec coordonnees qui avancent."""
    return [
        sample(
            t_ms=(start + i) * 16, track_pos=(start + i) / 10_000, sector=sector,
            x=float(start + i), z=0.0, **extra,
        )
        for i in range(n)
    ]


def test_nothing_is_emitted_while_driving_in_the_same_sector():
    assert feed(PieceCutter("sim-1", "run-1"), run(200)) == []


def test_crossing_a_sector_closes_a_piece():
    cutter = PieceCutter("sim-1", "run-1")
    [piece] = feed(cutter, run(100, sector=0) + run(50, sector=1, start=100))
    assert piece.reason is PieceReason.SECTOR
    assert piece.sector == 0
    assert len(piece.points) == 100
    assert (piece.lap_number, piece.piece_index) == (0, 0)


def test_pause_closes_the_piece_and_resuming_starts_another():
    cutter = PieceCutter("sim-1", "run-1")
    raw = run(80) + [sample(status=3, track_pos=0.008)] * 5 + run(60, start=80)
    [piece] = feed(cutter, raw)
    assert piece.reason is PieceReason.PAUSE
    assert len(piece.points) == 80
    # reprise: le morceau suivant porte l'index suivant
    [next_piece] = feed(cutter, run(10, sector=2, start=140))
    assert next_piece.piece_index == 1
    assert len(next_piece.points) == 60


def test_repeated_pause_samples_emit_only_one_piece():
    cutter = PieceCutter("sim-1", "run-1")
    assert len(feed(cutter, run(80) + [sample(status=3)] * 50)) == 1


def test_entering_the_pits_closes_the_piece_and_pit_lane_is_not_recorded():
    cutter = PieceCutter("sim-1", "run-1")
    raw = run(80) + run(40, start=80, in_pit=True)
    [piece] = feed(cutter, raw)
    assert piece.reason is PieceReason.PIT_ENTRY
    assert len(piece.points) == 80
    assert not any(p.in_pit for p in piece.points)


def test_leaving_the_pits_starts_a_new_piece():
    cutter = PieceCutter("sim-1", "run-1")
    feed(cutter, run(80) + run(10, start=80, in_pit=True))
    [piece] = feed(cutter, run(70, start=90) + [sample(status=3)])
    assert len(piece.points) == 70
    assert piece.points[0].t_ms == 90 * 16  # la voie des stands n'en fait pas partie


def test_lap_end_closes_the_last_piece_and_numbers_the_next_lap():
    cutter = PieceCutter("sim-1", "run-1")
    raw = run(100) + run(100, start=100)
    pieces = feed(cutter, raw, lap_closed_at={100})  # le tour se ferme au 101e echantillon
    [piece] = pieces
    assert piece.reason is PieceReason.LAP_END
    assert len(piece.points) == 100
    [after] = feed(cutter, [sample(status=3)])
    assert (after.lap_number, after.piece_index) == (1, 0)


def test_sector_change_on_the_line_does_not_emit_a_second_piece():
    """Au passage de la ligne le secteur repasse a 0 en meme temps: un seul morceau est ferme."""
    cutter = PieceCutter("sim-1", "run-1")
    raw = run(100, sector=2) + run(100, sector=0, start=100)
    assert len(feed(cutter, raw, lap_closed_at={100})) == 1


def test_stopped_session_closes_the_piece_with_its_own_reason():
    cutter = PieceCutter("sim-1", "run-1")
    [piece] = feed(cutter, run(80) + [sample(status=0)])
    assert piece.reason is PieceReason.STOPPED


def test_size_limit_flushes_a_piece_that_never_changes_sector(monkeypatch):
    monkeypatch.setattr(PieceCutter, "MAX_POINTS", 50)
    pieces = feed(PieceCutter("sim-1", "run-1"), run(120))
    assert [p.reason for p in pieces] == [PieceReason.SIZE_LIMIT, PieceReason.SIZE_LIMIT]
    assert [len(p.points) for p in pieces] == [50, 50]


def test_piece_carries_track_car_and_run():
    cutter = PieceCutter("sim-1", "run-9")
    [piece] = feed(cutter, run(10) + [sample(status=3)])
    assert (piece.station_id, piece.run_id, piece.track) == ("sim-1", "run-9", "monza")
    assert piece.car == SESSION.car


# --- reechantillonnage par distance ---


def test_thinning_keeps_one_point_every_few_meters_and_the_last_one():
    pts = points(count=100, with_xz=True)  # x = pos * 1000: environ 10 m entre deux points
    thinned = DistanceThinningResampler(25.0).resample(pts)
    assert 20 < len(thinned) < 50
    assert thinned[-1] == (round(pts[-1].x, 2), round(pts[-1].z, 2))


def test_thinning_with_a_large_step_still_returns_first_and_last():
    thinned = DistanceThinningResampler(10_000.0).resample(points(count=50))
    assert len(thinned) == 2
