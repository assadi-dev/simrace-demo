import pytest
from pydantic import ValidationError

from app.shared.contract import Sample
from tests.support import sample


def test_coordinates_are_optional():
    parsed = Sample.model_validate(sample())
    assert parsed.x is None
    assert parsed.z is None


def test_coordinates_are_kept_when_present():
    parsed = Sample.model_validate(sample(x=12.5, z=-80.0))
    assert (parsed.x, parsed.z) == (12.5, -80.0)


@pytest.mark.parametrize("bad", [{"x": 1e9}, {"z": -1e9}, {"x": float("nan")}, {"z": float("inf")}])
def test_coordinates_out_of_bounds_or_not_finite_are_refused(bad):
    with pytest.raises(ValidationError):
        Sample.model_validate(sample(**bad))


@pytest.mark.parametrize(
    "bad",
    [{"speed_kmh": 900}, {"gas": 1.5}, {"track_pos": 1.2}, {"lap_time_ms": -5}, {"gear": 12}],
)
def test_existing_bounds_still_hold(bad):
    with pytest.raises(ValidationError):
        Sample.model_validate(sample(**bad))
