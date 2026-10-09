import struct

from simrace_agent import layout


def wstr(value: str, chars: int) -> bytes:
    return value.encode("utf-16-le").ljust(chars * 2, b"\x00")


def make_physics(packet_id=7, gas=0.8, brake=0.1, gear=3, rpm=7200, steer=-0.2, speed=181.5):
    return struct.pack("<ifffiiff", packet_id, gas, brake, 50.0, gear, rpm, steer, speed).ljust(
        layout.PHYSICS_SIZE, b"\x00"
    )


def make_graphics(status=2, laps=4, current=61_234, last=60_000, best=59_500, pit=0, sector=1,
                  pos=0.37):
    buf = bytearray(layout.GRAPHICS_SIZE)
    struct.pack_into("<ii", buf, 0, 11, status)
    struct.pack_into("<iiiiiffiiii", buf, 132, laps, 3, current, last, best, 900.0, 1234.0, pit,
                     sector, 20_000, 10)
    struct.pack_into("<f", buf, 248, pos)
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
