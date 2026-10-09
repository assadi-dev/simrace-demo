from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.container import ApplicationContainer
from app.shared.api import ErrorHandlers
from app.shared.clock import Clock
from app.shared.config import Settings


class ApiApplication:
    """Construit l'application FastAPI: configuration, CORS, erreurs, routes de chaque contexte."""

    @staticmethod
    def create(
        settings: Settings | None = None,
        clock: Clock | None = None,
        container: ApplicationContainer | None = None,
    ) -> FastAPI:
        settings = settings or Settings.from_env()
        container = container or ApplicationContainer(settings, clock)

        app = FastAPI(title="simrace")
        app.state.container = container
        app.add_middleware(
            CORSMiddleware,
            allow_origins=container.settings.cors_origins,
            allow_methods=["GET"],
            allow_headers=["*"],
        )
        ErrorHandlers().install(app)
        for router in container.routers():
            app.include_router(router)
        return app


app = ApiApplication.create()
