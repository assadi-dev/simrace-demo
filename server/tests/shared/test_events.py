from dataclasses import dataclass

from app.shared.events import DomainEvent, EventBus


@dataclass(frozen=True)
class Ping(DomainEvent):
    n: int


class Pong(DomainEvent):
    pass


def test_delivers_to_subscribers_of_that_event_type_only():
    bus, received = EventBus(), []
    bus.subscribe(Ping, lambda e: received.append(e.n))
    bus.publish(Ping(1))
    bus.publish(Pong())
    assert received == [1]


def test_failing_subscriber_does_not_stop_the_others_nor_the_publisher():
    bus, received = EventBus(), []

    def broken(_event):
        raise RuntimeError("boom")

    bus.subscribe(Ping, broken)
    bus.subscribe(Ping, lambda e: received.append(e.n))
    bus.publish(Ping(7))
    assert received == [7]
