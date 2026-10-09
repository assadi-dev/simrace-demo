from dataclasses import replace

import pytest

from app.features.tracks.factory import ReferenceStrategyFactory, ValidationStrategyFactory
from app.features.tracks.strategy import (
    BestLapTimeStrategy,
    EndsAtLineRule,
    ForwardProgressRule,
    HasCoordinatesRule,
    KnownLapTimeRule,
    LatestLapStrategy,
    MinimumPointsRule,
    NoDataGapRule,
    NoPitRule,
    ResamplingError,
    StartsAtLineRule,
    TrackPositionBinResampler,
)
from tests.features.tracks.helpers import candidate, lap, points


def test_clean_lap_passes_every_rule():
    assert ValidationStrategyFactory.default().first_failure(candidate()) is None


@pytest.mark.parametrize(
    ("rule", "bad_candidate"),
    [
        (MinimumPointsRule(), candidate(points(count=50))),
        (HasCoordinatesRule(), candidate(points(with_xz=False))),
        (StartsAtLineRule(), candidate(points(start=0.4))),
        (EndsAtLineRule(), candidate(points(end=0.7))),
        (NoPitRule(), candidate(points(in_pit_at=100))),
        (NoDataGapRule(), candidate(points(step_ms=2000))),
        (KnownLapTimeRule(), candidate(lap_time_ms=0)),
    ],
)
def test_each_rule_rejects_its_case(rule, bad_candidate):
    assert rule.is_satisfied(bad_candidate) is False


def test_each_rule_accepts_a_clean_lap():
    clean = candidate()
    rules = [MinimumPointsRule(), HasCoordinatesRule(), StartsAtLineRule(), EndsAtLineRule(),
             NoPitRule(), NoDataGapRule(), ForwardProgressRule(), KnownLapTimeRule()]
    assert all(rule.is_satisfied(clean) for rule in rules)


def test_forward_progress_rejects_a_jump_back_but_tolerates_jitter():
    # un recul minuscule (bruit) est tolere, un grand recul ne l'est pas
    back_small = points()
    back_big = points()
    back_small[300] = replace(back_small[300], track_pos=back_small[299].track_pos - 0.001)
    back_big[300] = replace(back_big[300], track_pos=back_big[299].track_pos - 0.2)
    rule = ForwardProgressRule()
    assert rule.is_satisfied(candidate(back_small)) is True
    assert rule.is_satisfied(candidate(back_big)) is False


def test_strategy_reports_the_first_failing_reason():
    strategy = ValidationStrategyFactory.default()
    assert strategy.first_failure(candidate(points(with_xz=False))) == "no_coordinates"
    assert strategy.first_failure(candidate(points(start=0.4))) == "started_mid_lap"
    assert strategy.first_failure(candidate(points(in_pit_at=10))) == "pit_involved"


def test_partial_coordinates_are_tolerated_up_to_the_ratio():
    pts = points()
    for i in range(6):  # 1 % des points sans coordonnees
        pts[i] = replace(pts[i], x=None, z=None)
    assert HasCoordinatesRule(min_ratio=0.98).is_satisfied(candidate(pts)) is True
    assert HasCoordinatesRule(min_ratio=0.995).is_satisfied(candidate(pts)) is False


# --- reechantillonnage ---


def test_resampler_returns_exactly_n_points():
    assert len(TrackPositionBinResampler(200).resample(points())) == 200


def test_resampler_averages_points_of_a_bin():
    pts = points(count=600, start=0.0, end=0.998)
    result = TrackPositionBinResampler(100).resample(pts)
    # position 0.5 -> x = 500: le point central de la tranche est proche
    assert result[50][0] == pytest.approx(505, abs=10)


def test_resampler_fills_empty_bins_by_interpolation():
    pts = [p for p in points(count=600) if not 0.4 <= p.track_pos <= 0.6]
    result = TrackPositionBinResampler(100).resample(pts)
    assert len(result) == 100
    xs = [x for x, _ in result]
    assert xs == sorted(xs)  # la trace reste monotone: pas de trou ni de zero


def test_resampler_refuses_a_lap_without_coordinates():
    with pytest.raises(ResamplingError):
        TrackPositionBinResampler(100).resample(points(with_xz=False))


# --- carte de reference ---


def test_best_time_picks_the_fastest_lap():
    laps = [lap("a-lap001", 9600).summary, lap("b-lap002", 9000).summary, lap("c-lap003", 9300).summary]
    assert str(BestLapTimeStrategy().select(laps).lap_id) == "b-lap002"


def test_latest_picks_the_most_recent_lap():
    laps = [lap("a-lap001", 9600, minute=5).summary, lap("b-lap002", 9000, minute=1).summary]
    assert str(LatestLapStrategy().select(laps).lap_id) == "a-lap001"


def test_strategies_return_none_without_laps():
    assert BestLapTimeStrategy().select([]) is None
    assert LatestLapStrategy().select([]) is None


def test_reference_factory_builds_by_name_and_refuses_unknown():
    assert isinstance(ReferenceStrategyFactory.create("best_time"), BestLapTimeStrategy)
    assert isinstance(ReferenceStrategyFactory.create("latest"), LatestLapStrategy)
    with pytest.raises(ValueError):
        ReferenceStrategyFactory.create("random")
