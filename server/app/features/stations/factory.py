from datetime import timedelta

from app.features.stations.domain import Station
from app.features.stations.strategy import OnlinePolicy, SilenceWindowPolicy
from app.shared.config import Settings
from app.shared.contract import SessionInfo


class StationFactory:
    def start(
        self, station_id: str, run_id: str, session: SessionInfo, machine: str | None = None
    ) -> Station:
        return Station(station_id, run_id, session, machine)


class OnlinePolicyFactory:
    @staticmethod
    def from_settings(settings: Settings) -> OnlinePolicy:
        return SilenceWindowPolicy(timedelta(seconds=settings.online_window_s))
