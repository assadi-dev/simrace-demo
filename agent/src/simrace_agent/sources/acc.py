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
        self.last_error: SourceError | None = None

    def _page(self, name: str, size: int) -> bytes:
        return _read_page(name, size, self.game)

    def is_running(self) -> bool:
        """Vrai si les pages du jeu existent: elles ne vivent que tant que le jeu les tient."""
        try:
            self._page(self.layout.PHYSICS_NAME, 4)
        except SourceError:
            return False
        return True

    def session(self) -> SessionInfo:
        return layout.decode_session(self._page(layout.STATIC_NAME, layout.STATIC_SIZE))

    def read_until_lost(self) -> Iterator[Sample]:
        """Lit le jeu jusqu'a ce que ses pages disparaissent (jeu ferme) ou jusqu'a l'arret."""
        pages = self.layout
        last_id = -1
        while not self._stop.is_set():
            try:
                physics = self._page(pages.PHYSICS_NAME, pages.PHYSICS_SIZE)
                graphics = self._page(pages.GRAPHICS_NAME, pages.GRAPHICS_SIZE)
            except SourceError as exc:
                self.last_error = exc
                return
            packet_id = layout.physics_packet_id(physics)
            if packet_id != last_id:
                last_id = packet_id
                yield pages.decode_sample(physics, graphics, int(time.time() * 1000))
            time.sleep(self._period)

    def samples(self) -> Iterator[Sample]:
        while not self._stop.is_set():
            yield from self.read_until_lost()
            if self._stop.is_set():
                return
            if not AVAILABLE:
                raise self.last_error or SourceError(f"{self.game} illisible")
            print(f"[agent] en attente de {self.game}: {self.last_error}")
            self._stop.wait(2)


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


class AutoSharedMemorySource:
    """Detecte le jeu lance par le nom de ses pages (decision 0022), puis lit celui-ci.

    EVO est cherche avant ACC. Si le jeu se ferme, la detection recommence: on peut passer d'ACC
    a EVO sans relancer l'agent. La session dit quel jeu a ete lu (`game`, `game_version`).
    """

    game = "ACC ou AC EVO"

    def __init__(self, poll_hz: int = 120, stop: threading.Event | None = None) -> None:
        self._stop = stop or threading.Event()
        self._candidates = [
            AcEvoSharedMemorySource(poll_hz, self._stop),
            AccSharedMemorySource(poll_hz, self._stop),
        ]
        self._current: AccSharedMemorySource | None = None

    def detect(self) -> AccSharedMemorySource | None:
        return next((source for source in self._candidates if source.is_running()), None)

    def session(self) -> SessionInfo:
        source = self._current or self.detect()
        if source is None:
            raise SourceError(f"aucun jeu detecte: {self.game} est-il lance et en session ?")
        return source.session()

    def samples(self) -> Iterator[Sample]:
        while not self._stop.is_set():
            source = self.detect()
            if source is None:
                if not AVAILABLE:
                    raise SourceError("La memoire partagee des jeux n'est lisible que sous Windows")
                print(f"[agent] en attente d'un jeu ({self.game})")
                self._stop.wait(2)
                continue
            if source is not self._current:
                print(f"[agent] jeu detecte: {source.game}")
                self._current = source
            yield from source.read_until_lost()


# Sources de jeu en direct, par nom (`--source` et SIMRACE_SOURCE)
LIVE_SOURCES = {
    "auto": AutoSharedMemorySource,
    "acc": AccSharedMemorySource,
    "acevo": AcEvoSharedMemorySource,
}


def live_source(
    name: str, stop: threading.Event | None = None
) -> AccSharedMemorySource | AutoSharedMemorySource:
    if name not in LIVE_SOURCES:
        raise SourceError(f"source inconnue: {name} (choix: {', '.join(LIVE_SOURCES)})")
    return LIVE_SOURCES[name](stop=stop)
