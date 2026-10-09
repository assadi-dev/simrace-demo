from abc import ABC, abstractmethod
from datetime import UTC, datetime


class Clock(ABC):
    """Source de temps injectee: permet de tester sans attendre."""

    @abstractmethod
    def now(self) -> datetime: ...


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(UTC)
