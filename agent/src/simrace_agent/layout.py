"""Decodage des pages de memoire partagee d'ACC.

Les offsets suivent SharedFileOut.h (pack 4) tel que documente par la communaute. Ils n'ont
pas encore ete verifies sur une vraie session: lancer `simrace-agent probe` pendant un
roulage et comparer avec ce que le jeu affiche. Les chaines sont du UTF-16 LE.
"""

import struct

from simrace_agent.models import Sample, SessionInfo

PHYSICS_NAME = "Local\\acpmf_physics"
GRAPHICS_NAME = "Local\\acpmf_graphics"
STATIC_NAME = "Local\\acpmf_static"

# On ne mappe que le debut de chaque page: seuls les champs utiles sont lus.
PHYSICS_SIZE = 32
GRAPHICS_SIZE = 252
STATIC_SIZE = 332

# ACC met INT_MAX dans les temps de tour quand aucun tour n'est enregistre.
_NO_TIME = 2**31 - 1

_PHYSICS = struct.Struct("<ifffiiff")  # packetId gas brake fuel gear rpms steerAngle speedKmh
_GRAPHICS_HEAD = struct.Struct("<ii")  # packetId status
_GRAPHICS_LAPS = struct.Struct("<iiiiiffiiii")  # a partir de l'offset 132
_LAPS_OFFSET = 132
_TRACK_POS_OFFSET = 248


def _wstr(buf: bytes, offset: int, chars: int) -> str:
    raw = buf[offset : offset + chars * 2]
    return raw.decode("utf-16-le", errors="ignore").split("\x00", 1)[0]


def _lap_ms(value: int) -> int:
    return 0 if value <= 0 or value >= _NO_TIME else value


def physics_packet_id(physics: bytes) -> int:
    return struct.unpack_from("<i", physics, 0)[0]


def decode_session(static: bytes) -> SessionInfo:
    car = _wstr(static, 68, 33)
    track = _wstr(static, 134, 33)
    driver = f"{_wstr(static, 200, 33)} {_wstr(static, 266, 33)}".strip()
    return SessionInfo(track=track, car=car, driver=driver)


def decode_sample(physics: bytes, graphics: bytes, t_ms: int) -> Sample:
    packet_id, gas, brake, _fuel, gear, rpm, steer, speed = _PHYSICS.unpack_from(physics, 0)
    _gfx_id, status = _GRAPHICS_HEAD.unpack_from(graphics, 0)
    (
        completed_laps,
        _position,
        current_ms,
        last_ms,
        best_ms,
        _time_left,
        _distance,
        in_pit,
        sector,
        _last_sector_ms,
        _laps_total,
    ) = _GRAPHICS_LAPS.unpack_from(graphics, _LAPS_OFFSET)
    track_pos = struct.unpack_from("<f", graphics, _TRACK_POS_OFFSET)[0]
    return Sample(
        t_ms=t_ms,
        packet_id=packet_id,
        speed_kmh=speed,
        gas=gas,
        brake=brake,
        gear=gear - 1,  # ACC: 0 = marche arriere, 1 = point mort, 2 = premiere
        rpm=rpm,
        steer=steer,
        status=status,
        completed_laps=completed_laps,
        lap_time_ms=max(current_ms, 0),
        last_lap_ms=_lap_ms(last_ms),
        best_lap_ms=_lap_ms(best_ms),
        sector=sector,
        in_pit=bool(in_pit),
        track_pos=track_pos,
    )
