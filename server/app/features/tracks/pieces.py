from app.features.tracks.domain import LapPoint, PieceCandidate, PieceReason
from app.shared.contract import AccStatus, Sample, SessionInfo


class PieceCutter:
    """Decoupe la trace d'un poste (pour un run_id) en morceaux, sans attendre la fin du tour.

    Un morceau est ferme, donc pret a etre enregistre, quand:
    - le joueur franchit un secteur (le `sector` d'ACC change): "checkpoint" du circuit;
    - le jeu passe en pause, ou la session s'arrete;
    - le joueur entre dans la voie des stands (la voie des stands n'est pas enregistree);
    - la ligne est franchie (fin du tour, signalee par le LapAssembler);
    - le morceau devient trop long (garde-fou si le secteur ne changeait jamais).
    Le `lap_closed` vient du LapAssembler: les deux voient les memes echantillons, la regle de
    passage de ligne n'est ecrite qu'a un seul endroit.
    """

    MAX_POINTS = 20_000  # environ 5 minutes a 60 Hz

    def __init__(self, station_id: str, run_id: str) -> None:
        self.station_id = station_id
        self.run_id = run_id
        self._points: list[LapPoint] = []
        self._session: SessionInfo | None = None
        self._lap_index = 0  # meme numerotation que le LapAssembler (rang du tour dans le run)
        self._piece_index = 0
        self._sector: int | None = None

    def push(self, sample: Sample, session: SessionInfo, lap_closed: bool) -> list[PieceCandidate]:
        closed: list[PieceCandidate] = []
        self._session = session

        if lap_closed:
            closed += self._close(PieceReason.LAP_END)
            self._lap_index += 1
            self._piece_index = 0

        if sample.status != AccStatus.LIVE:
            reason = PieceReason.PAUSE if sample.status == AccStatus.PAUSE else PieceReason.STOPPED
            closed += self._close(reason)
            return closed

        if sample.in_pit:
            closed += self._close(PieceReason.PIT_ENTRY)
            return closed

        if self._points and sample.sector != self._sector:
            closed += self._close(PieceReason.SECTOR)

        self._sector = sample.sector
        self._points.append(
            LapPoint(
                t_ms=sample.t_ms,
                track_pos=sample.track_pos,
                lap_time_ms=sample.lap_time_ms,
                in_pit=sample.in_pit,
                x=sample.x,
                z=sample.z,
            )
        )
        if len(self._points) >= self.MAX_POINTS:
            closed += self._close(PieceReason.SIZE_LIMIT)
        return closed

    def _close(self, reason: PieceReason) -> list[PieceCandidate]:
        if not self._points or self._session is None:
            return []
        piece = PieceCandidate(
            station_id=self.station_id,
            run_id=self.run_id,
            track=self._session.track,
            car=self._session.car,
            lap_number=self._lap_index,
            piece_index=self._piece_index,
            reason=reason,
            sector=self._sector,
            points=tuple(self._points),
        )
        self._piece_index += 1
        self._points = []
        return [piece]
