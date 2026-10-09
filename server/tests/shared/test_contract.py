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


def test_tyres_and_brakes_are_optional():
    parsed = Sample.model_validate(sample())
    assert parsed.tyre_pressure_psi is None and parsed.brake_temp_c is None


def test_four_wheel_values_are_accepted():
    parsed = Sample.model_validate(sample(tyre_pressure_psi=[26.1, 26.6, 26.7, 26.6],
                                          brake_temp_c=[300, 310, 250, 255]))
    assert parsed.tyre_pressure_psi == [26.1, 26.6, 26.7, 26.6]


@pytest.mark.parametrize("bad", [
    {"tyre_pressure_psi": [26.0, 26.0, 26.0]},  # une roue manque
    {"tyre_pressure_psi": [26.0, 26.0, 26.0, 26.0, 26.0]},
    {"tyre_pressure_psi": [26.0, 26.0, 26.0, 900.0]},
    {"tyre_pressure_psi": [26.0, 26.0, 26.0, -1.0]},
    {"tyre_temp_c": [80.0, 80.0, 80.0, 9999.0]},
    {"brake_temp_c": [300.0, 300.0, 300.0, 5000.0]},
    {"pad_life_mm": [28.0, 28.0, 28.0, 400.0]},
    {"disc_life_mm": [28.0, 28.0, 28.0, float("nan")]},
])
def test_bad_wheel_values_are_rejected(bad):
    with pytest.raises(ValidationError):
        Sample.model_validate(sample(**bad))


def test_fuel_and_aids_are_optional_then_validated():
    assert Sample.model_validate(sample()).fuel_l is None
    parsed = Sample.model_validate(sample(fuel_l=62.0, fuel_per_lap_l=3.0, tc_level=7, abs_level=4))
    assert (parsed.fuel_l, parsed.tc_level) == (62.0, 7)


@pytest.mark.parametrize("bad", [
    {"fuel_l": -1.0}, {"fuel_l": 5000.0}, {"fuel_l": float("nan")},
    {"fuel_per_lap_l": 500.0}, {"tc_level": -1}, {"abs_level": 99},
])
def test_bad_fuel_or_aid_values_are_rejected(bad):
    with pytest.raises(ValidationError):
        Sample.model_validate(sample(**bad))
