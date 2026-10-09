from app.features.ingestion.schemas import AckOut, BatchIn
from app.features.ingestion.services import IngestionService


class IngestionController:
    """`async` volontaire: l'ingestion modifie l'etat partage et publie sur la boucle d'evenements."""

    def __init__(self, service: IngestionService) -> None:
        self._service = service

    async def ingest(self, batch: BatchIn) -> AckOut:
        return self._service.ingest(batch)
