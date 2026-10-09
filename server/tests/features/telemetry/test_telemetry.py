import asyncio

from app.features.ingestion.events import SamplesAccepted
from app.features.telemetry.hub import Hub
from app.features.telemetry.services import LiveFeedService
from app.shared.contract import Sample, SessionInfo
from tests.support import sample


def test_hub_slow_subscriber_loses_oldest_events():
    async def scenario():
        hub = Hub(queue_size=2)
        queue = hub.subscribe()
        for i in range(4):
            hub.publish("samples", {"n": i})
        return [queue.get_nowait().data["n"] for _ in range(2)]

    assert asyncio.run(scenario()) == [2, 3]


def test_hub_ids_increase_and_unsubscribe_stops_delivery():
    async def scenario():
        hub = Hub()
        queue = hub.subscribe()
        hub.publish("samples", {})
        hub.publish("samples", {})
        hub.unsubscribe(queue)
        hub.publish("samples", {})
        return [queue.get_nowait().id for _ in range(queue.qsize())], hub.subscriber_count

    assert asyncio.run(scenario()) == ([1, 2], 0)


def test_live_feed_publishes_one_sse_event_per_batch_with_the_same_payload_as_before():
    async def scenario():
        hub = Hub()
        queue = hub.subscribe()
        event = SamplesAccepted(
            station_id="sim-1",
            run_id="run-1",
            machine=None,
            session=SessionInfo(track="monza", car="c", driver="d"),
            samples=(Sample.model_validate(sample()),),
        )
        LiveFeedService(hub).on_samples_accepted(event)
        return queue.get_nowait()

    published = asyncio.run(scenario())
    assert published.type == "samples"
    assert published.data["station_id"] == "sim-1"
    assert published.data["session"]["track"] == "monza"
    assert published.data["samples"][0]["speed_kmh"] == 120.0
    assert published.data["samples"][0]["x"] is None
