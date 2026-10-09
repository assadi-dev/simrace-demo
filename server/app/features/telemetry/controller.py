from collections.abc import AsyncIterable

from fastapi.sse import ServerSentEvent

from app.features.telemetry.hub import Hub


class TelemetryController:
    def __init__(self, hub: Hub) -> None:
        self._hub = hub

    async def stream(self) -> AsyncIterable[ServerSentEvent]:
        queue = self._hub.subscribe()
        try:
            while True:
                event = await queue.get()
                yield ServerSentEvent(data=event.data, event=event.type, id=str(event.id))
        finally:
            self._hub.unsubscribe(queue)
