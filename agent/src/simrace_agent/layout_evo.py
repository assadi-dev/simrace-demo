"""Decodage des pages de memoire partagee d'Assetto Corsa EVO (decision 0022).

Structure: SharedFileOut.h publie par Kunos (journal du 2026-04-28), pack 4, chaines en ASCII
(char[N]) et non en UTF-16 comme ACC. La page physique a la meme structure que celle d'ACC: elle
est decodee par `layout.decode_physics`. Les pages graphique et statique sont differentes.

Offsets verifies sur AC EVO 0.9.1 le 2026-10-16 (Monza, Porsche 911 GT3 Cup, un tour complet et une
entree aux stands). Ecart avec la documentation: 16 octets de booleens suivent `rpm` (offset 40)
au lieu des 14 listes; les champs utilises ici sont tous apres et ont ete mesures.
"""

import math
import struct

from simrace_agent import layout
from simrace_agent.models import Sample, SessionInfo

PHYSICS_NAME = "Local\\acevo_pmf_physics"
GRAPHICS_NAME = "Local\\acevo_pmf_graphics"
STATIC_NAME = "Local\\acevo_pmf_static"

PHYSICS_SIZE = layout.PHYSICS_SIZE
GRAPHICS_SIZE = 4900  # jusqu'a car_ids[60][2] inclus
STATIC_SIZE = 208  # jusqu'a track_length_m inclus

_MAX_CARS = 60

# Page physique: memes offsets qu'ACC, mais padLife et discLife sont en metres (0,029), pas en mm
_PAD_LIFE_OFFSET = 740
_DISC_LIFE_OFFSET = 756

# Page graphique (SPageFileGraphicEvo)
_STATUS_OFFSET = 4  # ACEVO_STATUS: memes valeurs qu'ACC (0 off, 1 replay, 2 live, 3 pause)
_PLAYER_ID_OFFSET = 24  # player_car_id_a, player_car_id_b: deux uint64
_CURRENT_LAP_MS_OFFSET = 188  # current_lap_time_ms
_TRACK_POS_OFFSET = 1244  # npos, 0..1
_FUEL_PER_LAP_OFFSET = 1460  # fuel_liter_per_lap, moyenne mesuree par le jeu
_TC_LEVEL_OFFSET = 1872  # electronics.tc_level (int8)
_TC_CUT_OFFSET = 1873  # electronics.tc_cut_level (int8)
_ABS_LEVEL_OFFSET = 1874  # electronics.abs_level (int8)
_ENGINE_MAP_OFFSET = 1884  # electronics.engine_map_level (int8), jamais vu different de 0
_ENGINE_MAP_MAX_OFFSET = 2140  # electronics_max_limit.engine_map_level: 0 = pas de cartographie
_COMPLETED_LAPS_OFFSET = 2384  # total_lap_count
_LAST_LAP_OFFSET = 2396  # last_laptime_ms
_BEST_LAP_OFFSET = 2400  # best_laptime_ms (0 tant qu'aucun tour valide)
_FLAG_OFFSET = 2404  # flag (ACEVO_FLAG_TYPE), drapeau montre au pilote
_GLOBAL_FLAG_OFFSET = 2408  # global_flag (ACEVO_FLAG_TYPE), drapeau de piste
_DRIVER_NAME_OFFSET = 3020  # char[33]
_DRIVER_SURNAME_OFFSET = 3053  # char[33]
_CAR_MODEL_OFFSET = 3086  # char[33]
_IN_PIT_BOX_OFFSET = 3119  # bool
_IN_PIT_LANE_OFFSET = 3120  # bool
_IS_VALID_LAP_OFFSET = 3121  # bool
_COORDINATES_OFFSET = 3124  # car_coordinates[60][3] (x, y, z, y = hauteur)
_ACTIVE_CARS_OFFSET = 3852  # uint8
_FUEL_EST_LAPS_OFFSET = 3860  # fuel_estimated_laps
_MAX_FUEL_OFFSET = 3928  # max_fuel, litres
_CAR_IDS_OFFSET = 3940  # car_ids[60][2] (uint64): meme ordre que car_coordinates

# Page statique (SPageFileStaticEvo)
_TRACK_OFFSET = 136  # char[33]

# ACEVO_FLAG_TYPE -> code ACC de `flag` (codes.FLAGS). Sans equivalent ACC: None, jamais invente.
_FLAG_TO_ACC = {0: 0, 1: 4, 2: 7, 4: 1, 5: 2, 6: 3, 8: 5, 9: 8}
# ACEVO_FLAG_TYPE de `global_flag` -> noms de codes.TRACK_FLAGS
_GLOBAL_FLAG_TO_TRACK = {1: "white", 2: "green", 3: "red", 5: "yellow", 8: "chequered"}


def _cstr(buf: bytes, offset: int, size: int) -> str:
    return buf[offset : offset + size].split(b"\x00", 1)[0].decode("utf-8", errors="ignore")


def _i32(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<i", buf, offset)[0]


def _f32(buf: bytes, offset: int) -> float:
    return struct.unpack_from("<f", buf, offset)[0]


def _i8(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<b", buf, offset)[0]


def _positive(value: float, digits: int) -> float | None:
    return round(value, digits) if math.isfinite(value) and value > 0 else None


def decode_player_position(graphics: bytes) -> tuple[float, float] | None:
    """Position monde (x, z) de la voiture du joueur, ou None (meme regles que pour ACC)."""
    active = graphics[_ACTIVE_CARS_OFFSET]
    player_id = struct.unpack_from("<QQ", graphics, _PLAYER_ID_OFFSET)
    if player_id == (0, 0):
        return None
    for index in range(min(active, _MAX_CARS)):
        if struct.unpack_from("<QQ", graphics, _CAR_IDS_OFFSET + index * 16) != player_id:
            continue
        x, y, z = struct.unpack_from("<3f", graphics, _COORDINATES_OFFSET + index * 12)
        if not all(math.isfinite(v) for v in (x, y, z)) or (x, y, z) == (0.0, 0.0, 0.0):
            return None
        return x, z
    return None


def _engine_map(graphics: bytes) -> int | None:
    # comme ACC, affiche +1; une voiture sans cartographie (maximum 0) n'en a pas
    if _i8(graphics, _ENGINE_MAP_MAX_OFFSET) <= 0:
        return None
    return _i8(graphics, _ENGINE_MAP_OFFSET) + 1


def _track_flags(graphics: bytes) -> list[str]:
    name = _GLOBAL_FLAG_TO_TRACK.get(_i32(graphics, _GLOBAL_FLAG_OFFSET))
    return [name] if name else []


def decode_session(static: bytes, graphics: bytes) -> SessionInfo:
    # contrairement a ACC, la voiture, le pilote et le reservoir sont dans la page graphique
    driver = (
        f"{_cstr(graphics, _DRIVER_NAME_OFFSET, 33)} {_cstr(graphics, _DRIVER_SURNAME_OFFSET, 33)}"
    )
    return SessionInfo(
        track=_cstr(static, _TRACK_OFFSET, 33),
        car=_cstr(graphics, _CAR_MODEL_OFFSET, 33),
        driver=driver.strip(),
        fuel_capacity_l=_positive(_f32(graphics, _MAX_FUEL_OFFSET), 1),
    )


def decode_sample(physics: bytes, graphics: bytes, t_ms: int) -> Sample:
    fields = layout.decode_physics(physics)
    fields["pad_life_mm"] = layout.decode_wheels(physics, _PAD_LIFE_OFFSET, scale=1000)
    fields["disc_life_mm"] = layout.decode_wheels(physics, _DISC_LIFE_OFFSET, scale=1000)
    position = decode_player_position(graphics)
    in_pit = graphics[_IN_PIT_LANE_OFFSET] or graphics[_IN_PIT_BOX_OFFSET]
    return Sample(
        t_ms=t_ms,
        **fields,
        status=_i32(graphics, _STATUS_OFFSET),
        completed_laps=_i32(graphics, _COMPLETED_LAPS_OFFSET),
        lap_time_ms=max(_i32(graphics, _CURRENT_LAP_MS_OFFSET), 0),
        last_lap_ms=max(_i32(graphics, _LAST_LAP_OFFSET), 0),
        best_lap_ms=max(_i32(graphics, _BEST_LAP_OFFSET), 0),
        sector=0,  # EVO ne publie pas de numero de secteur: pas de morceau "secteur" (0012)
        in_pit=bool(in_pit),
        track_pos=_f32(graphics, _TRACK_POS_OFFSET),
        x=position[0] if position else None,
        z=position[1] if position else None,
        fuel_per_lap_l=_positive(_f32(graphics, _FUEL_PER_LAP_OFFSET), 2),
        tc_level=_i8(graphics, _TC_LEVEL_OFFSET),
        abs_level=_i8(graphics, _ABS_LEVEL_OFFSET),
        flag=_FLAG_TO_ACC.get(_i32(graphics, _FLAG_OFFSET)),
        penalty_code=None,  # EVO n'a pas de code de penalite
        penalty_time_s=None,
        tc_cut_level=_i8(graphics, _TC_CUT_OFFSET),
        engine_map=_engine_map(graphics),
        is_valid_lap=bool(graphics[_IS_VALID_LAP_OFFSET]),
        fuel_estimated_laps=_positive(_f32(graphics, _FUEL_EST_LAPS_OFFSET), 1),
        track_flags=_track_flags(graphics),
    )
