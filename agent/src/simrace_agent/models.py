from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class SessionInfo:
    track: str
    car: str
    driver: str
    fuel_capacity_l: float | None = None  # capacite du reservoir (litres), None si inconnue

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
    # position monde en metres (plan de la piste: x et z); None si ACC ne la donne pas
    x: float | None = None
    z: float | None = None
    # pneus et freins, 4 valeurs dans l'ordre avant gauche, avant droit, arriere gauche, arriere
    # droit; None si ACC ne les donne pas
    tyre_pressure_psi: list[float] | None = None
    tyre_temp_c: list[float] | None = None  # temperature du coeur du pneu
    brake_temp_c: list[float] | None = None
    pad_life_mm: list[float] | None = None  # usure des plaquettes (mm restants)
    disc_life_mm: list[float] | None = None  # usure des disques (mm restants)
    # carburant et aides a la conduite; None si ACC ne les donne pas
    fuel_l: float | None = None  # carburant restant (litres)
    fuel_per_lap_l: float | None = None  # consommation estimee par ACC (litres par tour)
    tc_level: int | None = None  # reglage du controle de traction
    abs_level: int | None = None  # reglage de l'ABS

    def to_dict(self) -> dict:
        return asdict(self)
    # forces G subies par la voiture (accG d'ACC); None si ACC ne les donne pas
    g_lat: float | None = None  # laterale
    g_vert: float | None = None  # verticale
    g_long: float | None = None  # longitudinale: positive en acceleration, negative au freinage
    # drapeau affiche et penalite en cours (codes d'ACC, voir codes.py); None si absents
    flag: int | None = None
    penalty_code: int | None = None
    penalty_time_s: float | None = None
    # reglages et etat de piste lus dans la page graphique; None si ACC ne les donne pas
    tc_cut_level: int | None = None
    engine_map: int | None = None  # affiche comme SimHub: valeur ACC + 1
    brake_bias: float | None = None  # repartition de freinage (valeur brute d'ACC)
    is_valid_lap: bool | None = None
    fuel_estimated_laps: float | None = None
    # drapeaux globaux actifs (codes.TRACK_FLAGS), liste vide = aucun
    track_flags: list[str] | None = None
