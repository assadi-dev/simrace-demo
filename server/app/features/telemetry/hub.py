import asyncio
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Event:
    id: int
    type: str
    data: dict


class Hub:
    """Diffuse des evenements a tous les abonnes SSE. Un abonne trop lent perd les plus anciens."""

    def __init__(self, queue_size: int = 1000) -> None:
        self._queue_size = queue_size
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._next_id = 0

    def subscribe(self) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Event]) -> None:
        self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, type_: str, data: dict) -> None:
        self._next_id += 1
        event = Event(self._next_id, type_, data)
        for queue in self._subscribers:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(event)
