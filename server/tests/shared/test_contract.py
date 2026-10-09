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


def test_g_forces_are_optional_then_bounded():
    assert Sample.model_validate(sample()).g_long is None
    assert Sample.model_validate(sample(g_lat=1.2, g_vert=1.0, g_long=-1.4)).g_long == -1.4
    for bad in ({"g_lat": 50.0}, {"g_long": -50.0}, {"g_vert": float("nan")}):
        with pytest.raises(ValidationError):
            Sample.model_validate(sample(**bad))


def test_flag_and_penalty_are_optional_then_bounded():
    assert Sample.model_validate(sample()).flag is None
    parsed = Sample.model_validate(sample(flag=2, penalty_code=8, penalty_time_s=10.0))
    assert (parsed.flag, parsed.penalty_code) == (2, 8)
    for bad in ({"flag": -1}, {"flag": 99}, {"penalty_code": 500}, {"penalty_time_s": -3.0},
                {"penalty_time_s": float("nan")}):
        with pytest.raises(ValidationError):
            Sample.model_validate(sample(**bad))


def test_settings_and_track_flags_are_optional_then_validated():
    assert Sample.model_validate(sample()).track_flags is None
    parsed = Sample.model_validate(sample(track_flags=["yellow", "yellow_s1"], engine_map=8,
                                          brake_bias=54.0, is_valid_lap=True, tc_cut_level=6,
                                          fuel_estimated_laps=20.0))
    assert parsed.track_flags == ["yellow", "yellow_s1"]
    assert Sample.model_validate(sample(track_flags=[])).track_flags == []
    for bad in ({"track_flags": ["purple"]}, {"track_flags": ["yellow"] * 9},
                {"brake_bias": 500.0}, {"engine_map": -1}, {"fuel_estimated_laps": -2.0}):
        with pytest.raises(ValidationError):
            Sample.model_validate(sample(**bad))


def test_weather_is_optional_then_bounded():
    assert Sample.model_validate(sample()).air_temp_c is None
    parsed = Sample.model_validate(sample(air_temp_c=27.0, road_temp_c=28.4))
    assert (parsed.air_temp_c, parsed.road_temp_c) == (27.0, 28.4)
    for bad in ({"air_temp_c": 500.0}, {"road_temp_c": -300.0}, {"air_temp_c": float("nan")}):
        with pytest.raises(ValidationError):
            Sample.model_validate(sample(**bad))
