from abc import ABC, abstractmethod
from collections.abc import Callable

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from app.shared.errors import ConflictError, DomainError, InvalidInputError, NotFoundError


class BaseRoutes(ABC):
    """Une classe de routes possede un APIRouter.

    Une sous-classe range ses dependances (controleur) avant d'appeler `super().__init__`,
    qui declare les routes.
    """

    def __init__(self, tags: list[str]) -> None:
        self.router = APIRouter(tags=tags)
        self._register()

    @abstractmethod
    def _register(self) -> None: ...


class ErrorHandlers:
    """Traduit les erreurs metier en reponses HTTP, a un seul endroit."""

    _STATUS: tuple[tuple[type[DomainError], int], ...] = (
        (NotFoundError, 404),
        (ConflictError, 409),
        (InvalidInputError, 422),
        (DomainError, 400),
    )

    def install(self, app: FastAPI) -> None:
        app.add_exception_handler(DomainError, self._handle)

    async def _handle(self, _request: Request, exc: Exception) -> JSONResponse:
        status = next(code for kind, code in self._STATUS if isinstance(exc, kind))
        return JSONResponse(
            status_code=status, content={"error": type(exc).__name__, "detail": str(exc)}
        )


class HealthRoutes(BaseRoutes):
    def __init__(self, subscriber_count: Callable[[], int]) -> None:
        self._subscriber_count = subscriber_count
        super().__init__(tags=["health"])

    def _register(self) -> None:
        self.router.add_api_route("/health", self._health, methods=["GET"])

    async def _health(self) -> dict:
        return {"status": "ok", "subscribers": self._subscriber_count()}
