import struct

from simrace_agent import layout


def wstr(value: str, chars: int) -> bytes:
    return value.encode("utf-16-le").ljust(chars * 2, b"\x00")


def make_physics(packet_id=7, gas=0.8, brake=0.1, gear=3, rpm=7200, steer=-0.2, speed=181.5):
    return struct.pack("<ifffiiff", packet_id, gas, brake, 50.0, gear, rpm, steer, speed).ljust(
        layout.PHYSICS_SIZE, b"\x00"
    )


CARS = ((3, 100.0, 7.0, 200.0), (5, -250.5, 12.0, 880.25), (9, 1.0, 1.0, 1.0))  # (id, x, y, z)


def make_graphics(status=2, laps=4, current=61_234, last=60_000, best=59_500, pit=0, sector=1,
                  pos=0.37, cars=CARS, player_id=5, active=None):
    buf = bytearray(layout.GRAPHICS_SIZE)
    struct.pack_into("<ii", buf, 0, 11, status)
    struct.pack_into("<iiiiiffiiii", buf, 132, laps, 3, current, last, best, 900.0, 1234.0, pit,
                     sector, 20_000, 10)
    struct.pack_into("<f", buf, 248, pos)
    struct.pack_into("<i", buf, 252, len(cars) if active is None else active)
    for i, (car_id, x, y, z) in enumerate(cars):
        struct.pack_into("<3f", buf, 256 + i * 12, x, y, z)
        struct.pack_into("<i", buf, 976 + i * 4, car_id)
    struct.pack_into("<i", buf, 1216, player_id)
    return bytes(buf)


def test_decode_sample():
    sample = layout.decode_sample(make_physics(), make_graphics(), t_ms=42)
    assert sample.t_ms == 42
    assert sample.speed_kmh == 181.5
    assert sample.gear == 2  # 3 dans ACC = deuxieme rapport
    assert sample.rpm == 7200
    assert (sample.completed_laps, sample.lap_time_ms) == (4, 61_234)
    assert (sample.last_lap_ms, sample.best_lap_ms) == (60_000, 59_500)
    assert sample.sector == 1
    assert sample.in_pit is False
    assert abs(sample.track_pos - 0.37) < 1e-6


def test_graphics_page_covers_the_player_car_id():
    assert layout.GRAPHICS_SIZE == 1284 + 4


def test_sample_carries_the_player_position():
    sample = layout.decode_sample(make_physics(), make_graphics(), t_ms=0)
    assert (sample.x, sample.z) == (-250.5, 880.25)  # voiture 5, pas la premiere de la liste


def test_player_position_picks_the_car_matching_player_id():
    assert layout.decode_player_position(make_graphics(player_id=3)) == (100.0, 200.0)
    assert layout.decode_player_position(make_graphics(player_id=9)) == (1.0, 1.0)


def test_unknown_player_has_no_position():
    assert layout.decode_player_position(make_graphics(player_id=77)) is None


def test_player_beyond_the_active_cars_is_ignored():
    assert layout.decode_player_position(make_graphics(player_id=9, active=2)) is None


def test_origin_means_no_data_outside_a_session():
    cars = ((5, 0.0, 0.0, 0.0),)
    assert layout.decode_player_position(make_graphics(cars=cars)) is None


def test_non_finite_coordinates_are_dropped():
    cars = ((5, float("nan"), 0.0, 1.0),)
    assert layout.decode_player_position(make_graphics(cars=cars)) is None


def test_sample_without_position_still_decodes():
    sample = layout.decode_sample(make_physics(), make_graphics(player_id=77), t_ms=0)
    assert (sample.x, sample.z) == (None, None)
    assert sample.speed_kmh == 181.5


def test_no_lap_recorded_yet_is_zero():
    graphics = make_graphics(last=2**31 - 1, best=2**31 - 1)
    sample = layout.decode_sample(make_physics(), graphics, t_ms=0)
    assert (sample.last_lap_ms, sample.best_lap_ms) == (0, 0)


def test_packet_id():
    assert layout.physics_packet_id(make_physics(packet_id=99)) == 99


def test_decode_session():
    static = bytearray(layout.STATIC_SIZE)
    static[68:68 + 66] = wstr("ferrari_296_gt3", 33)
    static[134:134 + 66] = wstr("monza", 33)
    static[200:200 + 66] = wstr("Assadi", 33)
    static[266:266 + 66] = wstr("H", 33)
    info = layout.decode_session(bytes(static))
    assert (info.car, info.track, info.driver) == ("ferrari_296_gt3", "monza", "Assadi H")


def with_wheels(physics: bytes, offset: int, values) -> bytes:
    buf = bytearray(physics)
    struct.pack_into("<4f", buf, offset, *values)
    return bytes(buf)


def test_physics_page_covers_the_disc_life():
    assert layout.PHYSICS_SIZE == 756 + 16


def test_sample_carries_tyres_and_brakes_in_wheel_order():
    physics = make_physics()
    physics = with_wheels(physics, 88, (26.1, 26.6, 26.7, 26.6))  # wheelsPressure
    physics = with_wheels(physics, 152, (80.0, 81.5, 79.0, 78.5))  # tyreCoreTemperature
    physics = with_wheels(physics, 348, (300.0, 310.0, 250.0, 255.0))  # brakeTemp
    physics = with_wheels(physics, 740, (28.5, 28.4, 29.0, 29.0))  # padLife
    physics = with_wheels(physics, 756, (31.0, 31.0, 28.0, 28.0))  # discLife
    sample = layout.decode_sample(physics, make_graphics(), t_ms=0)
    assert sample.tyre_pressure_psi == [26.1, 26.6, 26.7, 26.6]
    assert sample.tyre_temp_c == [80.0, 81.5, 79.0, 78.5]
    assert sample.brake_temp_c == [300.0, 310.0, 250.0, 255.0]
    assert sample.pad_life_mm == [28.5, 28.4, 29.0, 29.0]
    assert sample.disc_life_mm == [31.0, 31.0, 28.0, 28.0]


def test_empty_physics_page_has_no_tyre_or_brake_data():
    sample = layout.decode_sample(make_physics(), make_graphics(), t_ms=0)
    assert sample.tyre_pressure_psi is None
    assert sample.brake_temp_c is None


def test_non_finite_wheel_value_is_dropped():
    physics = with_wheels(make_physics(), 88, (26.0, float("nan"), 26.0, 26.0))
    assert layout.decode_sample(physics, make_graphics(), t_ms=0).tyre_pressure_psi is None


def make_graphics_with(offsets: dict) -> bytes:
    buf = bytearray(make_graphics())
    for offset, (fmt, value) in offsets.items():
        struct.pack_into(fmt, buf, offset, value)
    return bytes(buf)


def test_sample_carries_fuel_and_driving_aids():
    graphics = make_graphics_with({1268: ("<i", 7), 1280: ("<i", 4), 1284: ("<f", 3.0)})
    sample = layout.decode_sample(make_physics(), graphics, t_ms=0)
    assert sample.fuel_l == 50.0  # make_physics met 50 litres
    assert sample.fuel_per_lap_l == 3.0
    assert (sample.tc_level, sample.abs_level) == (7, 4)


def test_unknown_fuel_consumption_is_none():
    sample = layout.decode_sample(make_physics(), make_graphics(), t_ms=0)  # 0 = pas d'estimation
    assert sample.fuel_per_lap_l is None
    assert (sample.tc_level, sample.abs_level) == (0, 0)  # 0 = aide coupee, valeur valide


def test_session_carries_the_tank_capacity():
    static = bytearray(layout.STATIC_SIZE)
    struct.pack_into("<f", static, 416, 120.0)
    assert layout.decode_session(bytes(static)).fuel_capacity_l == 120.0
    assert layout.decode_session(bytes(layout.STATIC_SIZE)).fuel_capacity_l is None
