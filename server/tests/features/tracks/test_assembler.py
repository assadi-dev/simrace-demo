from app.features.tracks.assembler import LapAssembler
from app.shared.contract import Sample
from tests.features.tracks.helpers import SESSION
from tests.support import lap_samples, sample


def feed(assembler: LapAssembler, raw: list[dict]):
    return [r for s in raw if (r := assembler.push(Sample.model_validate(s), SESSION)) is not None]


def test_no_lap_until_the_counter_increases():
    assert feed(LapAssembler("sim-1", "run-1"), lap_samples(0)) == []


def test_lap_completes_when_the_counter_goes_up_by_one():
    assembler = LapAssembler("sim-1", "run-1")
    results = feed(assembler, lap_samples(0) + lap_samples(1, last_lap_ms=9600))
    [result] = results
    candidate = result.candidate
    assert candidate.lap_number == 0
    assert candidate.lap_time_ms == 9600  # annonce par le premier echantillon du tour suivant
    assert len(candidate.points) == 600
    assert candidate.track == "monza"


def test_lap_time_falls_back_to_the_lap_timer_when_not_announced():
    assembler = LapAssembler("sim-1", "run-1")
    [result] = feed(assembler, lap_samples(0) + lap_samples(1, last_lap_ms=0))
    assert result.candidate.lap_time_ms == 599 * 16


def test_next_lap_starts_with_the_sample_that_closed_the_previous_one():
    assembler = LapAssembler("sim-1", "run-1")
    feed(assembler, lap_samples(0) + lap_samples(1, last_lap_ms=9600))
    [result] = feed(assembler, lap_samples(2, last_lap_ms=9000))
    assert result.candidate.lap_number == 1
    assert len(result.candidate.points) == 600


def test_lap_is_detected_from_the_position_wrap_when_acc_does_not_count_it():
    """Constate sur un vrai jeu: le tour de sortie des stands ne fait pas avancer completed_laps."""
    assembler = LapAssembler("sim-1", "run-1")
    results = feed(assembler, lap_samples(0) + lap_samples(0, last_lap_ms=0))
    [result] = results
    assert result.candidate.lap_number == 0
    assert len(result.candidate.points) == 600


def test_counter_and_wrap_on_the_same_crossing_give_a_single_lap():
    assembler = LapAssembler("sim-1", "run-1")
    # tour de sortie (compteur 0), tour lance (compteur 0), tour suivant (compteur 1)
    raw = lap_samples(0) + lap_samples(0) + lap_samples(1, last_lap_ms=9600)
    results = feed(assembler, raw)
    assert [r.candidate.lap_number for r in results] == [0, 1]


def test_counter_catching_up_after_a_wrap_does_not_create_a_phantom_lap():
    assembler = LapAssembler("sim-1", "run-1")
    next_lap = lap_samples(0)  # premier echantillon: le compteur n'a pas encore bouge
    next_lap[1:] = [{**s, "completed_laps": 1} for s in next_lap[1:]]  # il rattrape ensuite
    results = feed(assembler, lap_samples(0) + next_lap + lap_samples(2, last_lap_ms=9600))
    assert [r.candidate.lap_number for r in results] == [0, 1]
    assert all(len(r.candidate.points) == 600 for r in results)


def test_lap_numbers_follow_the_order_of_laps_not_the_acc_counter():
    assembler = LapAssembler("sim-1", "run-1")
    raw = lap_samples(4, count=600) + lap_samples(5, last_lap_ms=9000) + lap_samples(6)
    assert [r.candidate.lap_number for r in feed(assembler, raw)] == [0, 1]


def test_wrap_before_the_halfway_point_is_not_a_lap():
    assembler = LapAssembler("sim-1", "run-1")
    first_part = lap_samples(0)[:100]  # reste dans le premier sixieme du circuit
    assert feed(assembler, first_part + lap_samples(0)[:50]) == []


def test_pause_and_replay_samples_are_ignored():
    assembler = LapAssembler("sim-1", "run-1")
    paused = [sample(status=3, completed_laps=5), sample(status=1, completed_laps=6)]
    assert feed(assembler, paused) == []
    # le compteur n'a pas ete pris en compte: le tour 0 se deroule normalement
    [result] = feed(assembler, lap_samples(0) + lap_samples(1, last_lap_ms=1))
    assert result.candidate.lap_number == 0


def test_counter_jump_discards_the_lap_in_progress():
    assembler = LapAssembler("sim-1", "run-1")
    feed(assembler, lap_samples(0))
    [result] = feed(assembler, lap_samples(5, count=10))[:1]
    assert result.candidate is None
    assert result.discarded_reason == "lap_counter_jump"


def test_counter_going_back_discards_the_lap_in_progress():
    assembler = LapAssembler("sim-1", "run-1")
    feed(assembler, lap_samples(3, count=50))
    [result] = feed(assembler, lap_samples(0, count=10))[:1]
    assert result.discarded_reason == "lap_counter_jump"


def test_lap_that_never_ends_is_dropped_to_protect_memory(monkeypatch):
    monkeypatch.setattr(LapAssembler, "MAX_POINTS", 20)
    results = feed(LapAssembler("sim-1", "run-1"), lap_samples(0, count=30))
    assert [r.discarded_reason for r in results] == ["lap_too_long"]
