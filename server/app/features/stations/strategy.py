from abc import ABC, abstractmethod
from datetime import datetime, timedelta


class OnlinePolicy(ABC):
    """Decide si un poste est en ligne. Variation prevue: signal de vie (heartbeat) de l'agent."""

    @abstractmethod
    def is_online(self, last_seen: datetime | None, now: datetime) -> bool: ...


class SilenceWindowPolicy(OnlinePolicy):
    """En ligne tant qu'un lot est arrive dans la fenetre."""

    def __init__(self, window: timedelta) -> None:
        self._window = window

    def is_online(self, last_seen: datetime | None, now: datetime) -> bool:
        return last_seen is not None and now - last_seen <= self._window
