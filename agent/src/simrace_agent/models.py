from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class SessionInfo:
    track: str
    car: str
    driver: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class Sample:
    """Un instantane de telemetrie. Les temps sont en millisecondes."""

    t_ms: int  # horloge de l'agent (epoch ms)
    packet_id: int  # compteur de la page physique d'ACC
    speed_kmh: float
    gas: float  # 0..1
    brake: float  # 0..1
    gear: int  # -1 = marche arriere, 0 = point mort, 1.. = rapports
    rpm: int
    steer: float
    status: int  # 0 = off, 1 = replay, 2 = live, 3 = pause
    completed_laps: int
    lap_time_ms: int  # tour en cours
    last_lap_ms: int  # 0 = inconnu
    best_lap_ms: int  # 0 = inconnu
    sector: int
    in_pit: bool
    track_pos: float  # 0..1, position normalisee sur le circuit

    def to_dict(self) -> dict:
        return asdict(self)
