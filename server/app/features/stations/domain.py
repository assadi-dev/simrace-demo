from collections import Counter
from collections.abc import Mapping
from datetime import datetime
from enum import Enum

from app.shared.contract import SessionInfo


class BatchDisposition(Enum):
    ACCEPTED = "accepted"
    DUPLICATE = "duplicate"


class Station:
    """Un poste de simulation et le controle d'integrite des lots qu'il envoie.

    Regles: un `seq` deja vu est un doublon (ignore); un `seq` qui saute laisse des trous (comptes).
    Un nouveau `run_id` est un nouveau Station (l'agent a redemarre, la numerotation repart de 1).
    """

    def __init__(
        self, station_id: str, run_id: str, session: SessionInfo, machine: str | None = None
    ) -> None:
        self._station_id = station_id
        self._run_id = run_id
        self._session = session
        self._machine = machine
        self._last_seq = 0
        self._last_seen: datetime | None = None
        self._batches = 0
        self._samples = 0
        self._rejected = 0
        self._duplicates = 0
        self._gaps = 0
        self._reject_reasons: Counter[str] = Counter()

    @property
    def station_id(self) -> str:
        return self._station_id

    @property
    def run_id(self) -> str:
        return self._run_id

    @property
    def machine(self) -> str | None:
        return self._machine

    @property
    def session(self) -> SessionInfo:
        return self._session

    @property
    def last_seq(self) -> int:
        return self._last_seq

    @property
    def last_seen(self) -> datetime | None:
        return self._last_seen

    @property
    def batches(self) -> int:
        return self._batches

    @property
    def samples(self) -> int:
        return self._samples

    @property
    def rejected(self) -> int:
        return self._rejected

    @property
    def duplicates(self) -> int:
        return self._duplicates

    @property
    def gaps(self) -> int:
        return self._gaps

    @property
    def reject_reasons(self) -> dict[str, int]:
        return dict(self._reject_reasons)

    def touch(self, now: datetime, machine: str | None = None) -> None:
        """Signe de vie: tout lot recu compte, meme un doublon ou un lot entierement rejete."""
        self._last_seen = now
        self._machine = machine or self._machine

    def register_batch(self, seq: int) -> BatchDisposition:
        if seq <= self._last_seq:
            self._duplicates += 1
            return BatchDisposition.DUPLICATE
        if self._last_seq and seq > self._last_seq + 1:
            self._gaps += seq - self._last_seq - 1
        self._last_seq = seq
        self._batches += 1
        return BatchDisposition.ACCEPTED

    def record_samples(self, accepted: int, rejected: int, reasons: Mapping[str, int]) -> None:
        self._samples += accepted
        self._rejected += rejected
        self._reject_reasons.update(reasons)

    def update_session(self, session: SessionInfo) -> None:
        self._session = session
