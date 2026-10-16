import struct

from simrace_agent import layout, layout_evo

PLAYER = (5026999618946910361, 8966929725325431709)  # player_car_id_a, player_car_id_b
OTHER = (11, 22)


def cstr(value: str, size: int) -> bytes:
    return value.encode("ascii").ljust(size, b"\x00")


def make_physics(gear=3, speed=181.5, pads=(0.029, 0.029, 0.0285, 0.0285)):
    buf = bytearray(layout_evo.PHYSICS_SIZE)
    struct.pack_into("<ifffiiff", buf, 0, 7, 0.8, 0.1, 30.0, gear, 7200, -0.2, speed)
    struct.pack_into("<4f", buf, 740, *pads)  # padLife, en metres
    struct.pack_into("<4f", buf, 756, 0.032, 0.032, 0.031, 0.031)  # discLife, en metres
    return bytes(buf)


def make_graphics(status=2, laps=1, current=399, last=150_114, best=0, npos=0.37, pit_lane=0,
                  pit_box=0, valid=1, cars=((OTHER, 1.0, 1.0, 1.0), (PLAYER, -341.8, 40.2, 326.1)),
                  active=None, player=PLAYER, flag=0, global_flag=0, map_max=0, map_level=0,
                  phase="Session"):
    buf = bytearray(layout_evo.GRAPHICS_SIZE)
    struct.pack_into("<ii", buf, 0, 11, status)
    struct.pack_into("<QQ", buf, 24, *player)
    struct.pack_into("<i", buf, 188, current)
    struct.pack_into("<f", buf, 1244, npos)
    struct.pack_into("<f", buf, 1460, 5.29)  # fuel_liter_per_lap
    struct.pack_into("<bbb", buf, 1872, 6, 2, 5)  # tc_level, tc_cut_level, abs_level
    struct.pack_into("<b", buf, 1884, map_level)
    struct.pack_into("<b", buf, 2140, map_max)
    struct.pack_into("<iiiii", buf, 2384, laps, 1, 1, last, best)
    struct.pack_into("<ii", buf, 2404, flag, global_flag)
    buf[2476:2509] = cstr(phase, 33)
    buf[3020:3053] = cstr("Assadi", 33)
    buf[3053:3086] = cstr("H", 33)
    buf[3086:3119] = cstr("Porsche 911 GT3 Cup (992)", 33)
    buf[3119], buf[3120], buf[3121] = pit_box, pit_lane, valid
    for i, (car_id, x, y, z) in enumerate(cars):
        struct.pack_into("<3f", buf, 3124 + i * 12, x, y, z)
        struct.pack_into("<QQ", buf, 3940 + i * 16, *car_id)
    buf[3852] = len(cars) if active is None else active
    struct.pack_into("<f", buf, 3860, 10.1)  # fuel_estimated_laps
    struct.pack_into("<f", buf, 3928, 112.0)  # max_fuel
    return bytes(buf)


def make_static(track="Monza", version="0.9.1"):
    buf = bytearray(layout_evo.STATIC_SIZE)
    buf[15:30] = cstr(version, 15)  # ac_evo_version
    buf[136:169] = cstr(track, 33)
    return bytes(buf)


def decode(physics=None, graphics=None):
    return layout_evo.decode_sample(physics or make_physics(), graphics or make_graphics(), t_ms=42)


def test_pages_have_the_evo_names():
    assert layout_evo.PHYSICS_NAME == "Local\\acevo_pmf_physics"
    assert layout_evo.GRAPHICS_NAME == "Local\\acevo_pmf_graphics"
    assert layout_evo.STATIC_NAME == "Local\\acevo_pmf_static"


def test_graphics_page_covers_the_car_ids():
    assert layout_evo.GRAPHICS_SIZE == 3940 + 60 * 16


def test_physics_is_decoded_like_acc():
    sample = decode()
    assert sample.t_ms == 42
    assert sample.speed_kmh == 181.5
    assert sample.gear == 2  # meme codage qu'ACC: 3 = deuxieme rapport
    assert sample.fuel_l == 30.0


def test_lap_fields():
    sample = decode()
    assert sample.status == 2
    assert (sample.completed_laps, sample.lap_time_ms) == (1, 399)
    assert (sample.last_lap_ms, sample.best_lap_ms) == (150_114, 0)
    assert abs(sample.track_pos - 0.37) < 1e-6
    assert sample.is_valid_lap is True


def test_evo_has_no_sector():
    assert decode().sector == 0


def test_pad_and_disc_wear_are_converted_to_mm():
    sample = decode()
    assert sample.pad_life_mm == [29.0, 29.0, 28.5, 28.5]
    assert sample.disc_life_mm == [32.0, 32.0, 31.0, 31.0]


def test_empty_wear_is_none():
    assert decode(physics=make_physics(pads=(0.0, 0.0, 0.0, 0.0))).pad_life_mm is None


def test_pit_lane_or_pit_box_means_in_pit():
    assert decode().in_pit is False
    assert decode(graphics=make_graphics(pit_lane=1)).in_pit is True
    assert decode(graphics=make_graphics(pit_box=1)).in_pit is True


def test_position_is_the_player_car_not_the_first_one():
    assert layout_evo.decode_player_position(make_graphics()) == (
        struct.unpack("<f", struct.pack("<f", -341.8))[0],
        struct.unpack("<f", struct.pack("<f", 326.1))[0],
    )


def test_unknown_player_has_no_position():
    assert layout_evo.decode_player_position(make_graphics(player=(1, 2))) is None


def test_player_beyond_the_active_cars_is_ignored():
    assert layout_evo.decode_player_position(make_graphics(active=1)) is None


def test_origin_means_no_position():
    graphics = make_graphics(cars=((PLAYER, 0.0, 0.0, 0.0),))
    assert layout_evo.decode_player_position(graphics) is None


def test_fuel_and_driving_aids():
    sample = decode()
    assert sample.fuel_per_lap_l == 5.29
    assert sample.fuel_estimated_laps == 10.1
    assert (sample.tc_level, sample.tc_cut_level, sample.abs_level) == (6, 2, 5)


def test_car_without_engine_map_has_none():
    assert decode().engine_map is None
    assert decode(graphics=make_graphics(map_max=4, map_level=1)).engine_map == 2  # comme ACC: +1


def test_flags_are_translated_to_acc_codes():
    assert decode().flag == 0
    assert decode(graphics=make_graphics(flag=4)).flag == 1  # bleu
    assert decode(graphics=make_graphics(flag=5)).flag == 2  # jaune
    assert decode(graphics=make_graphics(flag=8)).flag == 5  # damier


def test_flag_without_acc_equivalent_is_none():
    assert decode(graphics=make_graphics(flag=7)).flag is None  # noir et blanc


def test_no_penalty_code_in_evo():
    sample = decode()
    assert (sample.penalty_code, sample.penalty_time_s) == (None, None)


def test_global_flag_becomes_track_flags():
    assert decode().track_flags == []
    assert decode(graphics=make_graphics(global_flag=5)).track_flags == ["yellow"]
    assert decode(graphics=make_graphics(global_flag=8)).track_flags == ["chequered"]


def test_session_reads_ascii_strings_from_static_and_graphics():
    info = layout_evo.decode_session(make_static(), make_graphics())
    assert (info.track, info.car, info.driver) == ("Monza", "Porsche 911 GT3 Cup (992)", "Assadi H")
    assert info.fuel_capacity_l == 112.0


def test_empty_pages_give_empty_session():
    info = layout_evo.decode_session(
        bytes(layout_evo.STATIC_SIZE), bytes(layout_evo.GRAPHICS_SIZE)
    )
    assert (info.track, info.car, info.driver, info.fuel_capacity_l) == ("", "", "", None)


def test_acc_decoding_is_unchanged_by_the_shared_physics():
    assert layout.decode_physics(make_physics())["pad_life_mm"] == [0.03, 0.03, 0.03, 0.03]


def test_session_phase_is_sent_as_written_by_the_game():
    assert decode().session_phase == "Session"
    assert decode(graphics=make_graphics(phase="Ended")).session_phase == "Ended"


def test_empty_session_phase_is_none():
    assert decode(graphics=make_graphics(phase="")).session_phase is None


def test_session_names_the_game_and_its_version():
    info = layout_evo.decode_session(make_static(), make_graphics())
    assert (info.game, info.game_version) == ("acevo", "0.9.1")
    assert layout_evo.decode_session(make_static(version=""), make_graphics()).game_version is None


def test_race_position_and_opponents():
    graphics = bytearray(make_graphics(active=10))
    struct.pack_into("<i", graphics, 2388, 7)  # vu en course contre 9 IA
    sample = decode(graphics=bytes(graphics))
    assert (sample.race_position, sample.opponents) == (7, 9)


def test_practice_alone_has_no_position_and_zero_opponents():
    graphics = bytearray(make_graphics(cars=((PLAYER, -341.8, 40.2, 326.1),)))
    struct.pack_into("<i", graphics, 2388, 0)  # EVO ecrit 0 en essais seul en piste
    sample = decode(graphics=bytes(graphics))
    assert (sample.race_position, sample.opponents) == (None, 0)
