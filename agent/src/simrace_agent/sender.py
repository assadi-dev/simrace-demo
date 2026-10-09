"""Envoi par lots numerotes, avec accuse de reception et reprise.

Chaque lot a un `seq` croissant au sein d'un `run_id` (change a chaque demarrage de l'agent).
Un lot reste en file tant que le serveur ne l'a pas acquitte; l'ordre est conserve.
"""

import socket
import threading
import uuid
from collections import deque

import httpx

from simrace_agent.models import SessionInfo


class BatchSender:
    def __init__(
        self,
        server_url: str,
        station_id: str,
        *,
        machine: str | None = None,
        max_pending: int = 500,
        timeout: float = 2.0,
    ) -> None:
        self.station_id = station_id
        self.machine = machine or socket.gethostname()  # nom du PC, affiche par l'interface
        self.run_id = uuid.uuid4().hex
        self.dropped = 0  # lots perdus car la file etait pleine (serveur injoignable trop longtemps)
        self.refused = 0  # lots refuses definitivement par le serveur (4xx)
        self._seq = 0
        self._max_pending = max_pending
        self._pending: deque[dict] = deque()
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = threading.Event()  # abandon immediat
        self._closing = threading.Event()  # on vide la file puis on s'arrete
        self._client = httpx.Client(base_url=server_url, timeout=timeout)
        self._thread = threading.Thread(target=self._loop, name="batch-sender", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def submit(self, session: SessionInfo, samples: list[dict]) -> None:
        if not samples:
            return
        with self._lock:
            self._seq += 1
            payload = {
                "station_id": self.station_id,
                "machine": self.machine,
                "run_id": self.run_id,
                "seq": self._seq,
                "session": session.to_dict(),
                "samples": samples,
            }
            if len(self._pending) >= self._max_pending:
                self._pending.popleft()
                self.dropped += 1
            self._pending.append(payload)
        self._wake.set()

    def close(self, flush_timeout: float = 3.0) -> None:
        self._closing.set()
        self._wake.set()
        self._thread.join(timeout=flush_timeout)
        self._stop.set()
        self._client.close()

    def _head(self) -> dict | None:
        with self._lock:
            return self._pending[0] if self._pending else None

    def _ack(self, payload: dict) -> None:
        with self._lock:
            if self._pending and self._pending[0] is payload:
                self._pending.popleft()

    def _loop(self) -> None:
        backoff = 0.5
        while not self._stop.is_set():
            payload = self._head()
            if payload is None:
                if self._closing.is_set():
                    return
                self._wake.wait(timeout=1.0)
                self._wake.clear()
                continue
            try:
                response = self._client.post("/ingest/batches", json=payload)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (408, 429) or exc.response.status_code >= 500:
                    self._retry_later(backoff)
                    backoff = min(backoff * 2, 10)
                else:
                    self.refused += 1
                    print(f"[agent] lot {payload['seq']} refuse: {exc.response.status_code}")
                    self._ack(payload)
                continue
            except httpx.HTTPError as exc:
                print(f"[agent] serveur injoignable ({exc.__class__.__name__}), nouvel essai")
                self._retry_later(backoff)
                backoff = min(backoff * 2, 10)
                continue
            backoff = 0.5
            self._ack(payload)

    def _retry_later(self, delay: float) -> None:
        self._stop.wait(delay)
