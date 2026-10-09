import os
from collections.abc import AsyncIterable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.hub import Hub
from app.schemas import Ack, Batch
from app.stations import Registry


def create_app() -> FastAPI:
    app = FastAPI(title="simrace")
    app.state.hub = Hub()
    app.state.registry = Registry()

    origins = os.environ.get("SIMRACE_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins.split(",") if o.strip()],
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "subscribers": app.state.hub.subscriber_count}

    @app.post("/ingest/batches")
    async def ingest(batch: Batch) -> Ack:
        ack, samples = app.state.registry.ingest(batch)
        if samples:
            app.state.hub.publish(
                "samples",
                {
                    "station_id": batch.station_id,
                    "session": batch.session.model_dump(),
                    "samples": [s.model_dump() for s in samples],
                },
            )
        return ack

    @app.get("/stations")
    async def stations() -> list[dict]:
        return app.state.registry.snapshot()

    @app.get("/stream", response_class=EventSourceResponse)
    async def stream() -> AsyncIterable[ServerSentEvent]:
        hub: Hub = app.state.hub
        queue = hub.subscribe()
        try:
            while True:
                event = await queue.get()
                yield ServerSentEvent(data=event.data, event=event.type, id=str(event.id))
        finally:
            hub.unsubscribe(queue)

    return app


app = create_app()
