from collections.abc import Iterator
from typing import Protocol

from simrace_agent.models import Sample, SessionInfo


class SourceError(RuntimeError):
    pass


class Source(Protocol):
    def session(self) -> SessionInfo: ...

    def samples(self) -> Iterator[Sample]: ...
