"""Lecture de la memoire partagee d'ACC et d'AC EVO (Windows uniquement)."""

import ctypes
import sys
import threading
import time
from collections.abc import Iterator

from simrace_agent import layout, layout_evo
from simrace_agent.models import Sample, SessionInfo
from simrace_agent.sources.base import SourceError

_FILE_MAP_READ = 0x0004

# ACC n'existe que sous Windows: ailleurs (macOS), la fenetre ne propose que le rejeu
AVAILABLE = sys.platform == "win32"


def _read_page(name: str, size: int, game: str = "ACC") -> bytes:
    """Copie le debut d'une page nommee. N'en cree jamais: erreur si le jeu n'a pas demarre."""
    if not AVAILABLE:
        raise SourceError(f"La memoire partagee de {game} n'est lisible que sous Windows")
    from ctypes import wintypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.OpenFileMappingW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
    k32.OpenFileMappingW.restype = wintypes.HANDLE
    k32.MapViewOfFile.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, ctypes.c_size_t,
    ]
    k32.MapViewOfFile.restype = wintypes.LPVOID
    k32.UnmapViewOfFile.argtypes = [wintypes.LPCVOID]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]

    handle = k32.OpenFileMappingW(_FILE_MAP_READ, False, name)
    if not handle:
        raise SourceError(f"{name} introuvable: {game} est-il lance et en session ?")
    try:
        view = k32.MapViewOfFile(handle, _FILE_MAP_READ, 0, 0, size)
        if not view:
            raise SourceError(f"Impossible de mapper {name}")
        try:
            return ctypes.string_at(view, size)
        finally:
            k32.UnmapViewOfFile(view)
    finally:
        k32.CloseHandle(handle)


class AccSharedMemorySource:
    game = "ACC"
    layout = layout  # noms, tailles et decodage des pages du jeu

    def __init__(self, poll_hz: int = 120, stop: threading.Event | None = None) -> None:
        self._period = 1.0 / poll_hz
        self._stop = stop or threading.Event()  # pose par l'interface pour arreter la lecture

    def _page(self, name: str, size: int) -> bytes:
        return _read_page(name, size, self.game)

    def session(self) -> SessionInfo:
        return layout.decode_session(self._page(layout.STATIC_NAME, layout.STATIC_SIZE))

    def samples(self) -> Iterator[Sample]:
        pages = self.layout
        last_id = -1
        while not self._stop.is_set():
            try:
                physics = self._page(pages.PHYSICS_NAME, pages.PHYSICS_SIZE)
                graphics = self._page(pages.GRAPHICS_NAME, pages.GRAPHICS_SIZE)
            except SourceError as exc:
                if sys.platform != "win32":
                    raise
                print(f"[agent] en attente de {self.game}: {exc}")
                self._stop.wait(2)
                continue
            packet_id = layout.physics_packet_id(physics)
            if packet_id != last_id:
                last_id = packet_id
                yield pages.decode_sample(physics, graphics, int(time.time() * 1000))
            time.sleep(self._period)


class AcEvoSharedMemorySource(AccSharedMemorySource):
    """AC EVO: meme lecture, autres pages (decision 0022)."""

    game = "AC EVO"
    layout = layout_evo

    def session(self) -> SessionInfo:
        # la voiture et le pilote sont dans la page graphique d'EVO
        return layout_evo.decode_session(
            self._page(layout_evo.STATIC_NAME, layout_evo.STATIC_SIZE),
            self._page(layout_evo.GRAPHICS_NAME, layout_evo.GRAPHICS_SIZE),
        )


# Sources de jeu en direct, par nom (`--source` et SIMRACE_SOURCE)
LIVE_SOURCES = {"acc": AccSharedMemorySource, "acevo": AcEvoSharedMemorySource}


def live_source(name: str, stop: threading.Event | None = None) -> AccSharedMemorySource:
    if name not in LIVE_SOURCES:
        raise SourceError(f"source inconnue: {name} (choix: {', '.join(LIVE_SOURCES)})")
    return LIVE_SOURCES[name](stop=stop)
