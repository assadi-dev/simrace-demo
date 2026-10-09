import pytest
from fastapi.testclient import TestClient

from app.container import ApplicationContainer
from app.main import ApiApplication
from app.shared.config import Settings
from tests.support import FakeClock


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path, track_points=200)


@pytest.fixture
def container(settings: Settings, clock: FakeClock) -> ApplicationContainer:
    return ApplicationContainer(settings, clock)


@pytest.fixture
def client(settings: Settings, container: ApplicationContainer) -> TestClient:
    return TestClient(ApiApplication.create(settings, container=container))
