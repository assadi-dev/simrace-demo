"""Lecture de la memoire partagee d'ACC (Windows uniquement)."""

import ctypes
import sys
import time
from collections.abc import Iterator

from simrace_agent import layout
from simrace_agent.models import Sample, SessionInfo
from simrace_agent.sources.base import SourceError

_FILE_MAP_READ = 0x0004


def _read_page(name: str, size: int) -> bytes:
    """Copie le debut d'une page nommee. N'en cree jamais: erreur si le jeu n'a pas demarre."""
    if sys.platform != "win32":
        raise SourceError("La memoire partagee d'ACC n'est lisible que sous Windows")
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
        raise SourceError(f"{name} introuvable: ACC est-il lance et en session ?")
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
    def __init__(self, poll_hz: int = 120) -> None:
        self._period = 1.0 / poll_hz

    def session(self) -> SessionInfo:
        return layout.decode_session(_read_page(layout.STATIC_NAME, layout.STATIC_SIZE))

    def samples(self) -> Iterator[Sample]:
        last_id = -1
        while True:
            try:
                physics = _read_page(layout.PHYSICS_NAME, layout.PHYSICS_SIZE)
                graphics = _read_page(layout.GRAPHICS_NAME, layout.GRAPHICS_SIZE)
            except SourceError as exc:
                if sys.platform != "win32":
                    raise
                print(f"[agent] en attente d'ACC: {exc}")
                time.sleep(2)
                continue
            packet_id = layout.physics_packet_id(physics)
            if packet_id != last_id:
                last_id = packet_id
                yield layout.decode_sample(physics, graphics, int(time.time() * 1000))
            time.sleep(self._period)
