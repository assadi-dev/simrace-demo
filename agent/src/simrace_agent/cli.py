import argparse
import socket
import time
from pathlib import Path

from simrace_agent.sender import BatchSender
from simrace_agent.sources.acc import AccSharedMemorySource
from simrace_agent.sources.base import Source, SourceError
from simrace_agent.sources.replay import Recorder, ReplaySource


def _probe() -> None:
    source = AccSharedMemorySource()
    last_print = 0.0
    session_shown = False
    for sample in source.samples():
        if not session_shown:
            print(source.session())
            session_shown = True
        if time.monotonic() - last_print >= 0.25:
            last_print = time.monotonic()
            print(
                f"{sample.speed_kmh:6.1f} km/h  gaz {sample.gas:.2f}  frein {sample.brake:.2f}  "
                f"rapport {sample.gear:2d}  tr/min {sample.rpm:5d}  tour {sample.completed_laps} "
                f"{sample.lap_time_ms / 1000:7.3f}s  pos {sample.track_pos:.3f}  statut {sample.status}"
            )


def _stream(source: Source, sender: BatchSender, batch_ms: int) -> None:
    sender.start()
    batch: list[dict] = []
    deadline = time.monotonic() + batch_ms / 1000
    try:
        for sample in source.samples():
            batch.append(sample.to_dict())
            if time.monotonic() >= deadline:
                sender.submit(source.session(), batch)
                batch, deadline = [], time.monotonic() + batch_ms / 1000
        sender.submit(source.session(), batch)
    except KeyboardInterrupt:
        pass
    finally:
        sender.close()
    print(f"[agent] termine (perdus: {sender.dropped}, refuses: {sender.refused})")


def _build_source(args: argparse.Namespace) -> Source:
    if args.source == "replay":
        if not args.file:
            raise SourceError("--file est obligatoire avec --source replay")
        return ReplaySource(Path(args.file), speed=args.speed)
    return AccSharedMemorySource()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="simrace-agent")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("probe", help="affiche en direct les valeurs lues dans ACC")

    run = sub.add_parser("run", help="envoie la telemetrie au serveur")
    run.add_argument("--server", default="http://localhost:8000")
    run.add_argument("--station-id", default=socket.gethostname())
    run.add_argument("--source", choices=["acc", "replay"], default="acc")
    run.add_argument("--file", help="fichier a rejouer (--source replay)")
    run.add_argument("--speed", type=float, default=1.0, help="vitesse de rejeu")
    run.add_argument("--batch-ms", type=int, default=200)

    record = sub.add_parser("record", help="enregistre une session ACC dans un fichier")
    record.add_argument("--out", required=True)

    args = parser.parse_args(argv)
    try:
        if args.command == "probe":
            _probe()
        elif args.command == "record":
            for _ in Recorder(AccSharedMemorySource(), Path(args.out)).samples():
                pass
        else:
            _stream(_build_source(args), BatchSender(args.server, args.station_id), args.batch_ms)
    except SourceError as exc:
        raise SystemExit(f"Erreur: {exc}") from exc
    except KeyboardInterrupt:
        pass
