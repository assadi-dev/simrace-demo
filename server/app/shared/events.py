import logging
from collections import defaultdict
from collections.abc import Callable

logger = logging.getLogger(__name__)


class DomainEvent:
    """Marqueur des evenements metier publies sur le bus."""


class EventBus:
    """Bus synchrone en memoire.

    Un abonne en erreur est journalise: il ne bloque ni les autres abonnes ni l'emetteur
    (l'ingestion d'un lot ne doit jamais echouer a cause de la diffusion ou de l'enregistrement).
    """

    def __init__(self) -> None:
        self._handlers: dict[type[DomainEvent], list[Callable[..., None]]] = defaultdict(list)

    def subscribe(self, event_type: type[DomainEvent], handler: Callable[..., None]) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event: DomainEvent) -> None:
        for handler in list(self._handlers[type(event)]):
            try:
                handler(event)
            except Exception:
                logger.exception("abonne en erreur pour %s", type(event).__name__)
