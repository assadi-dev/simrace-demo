import argparse
import socket
import threading
import time
from pathlib import Path

from simrace_agent import actions, config
from simrace_agent.codes import describe_flag, describe_penalty
from simrace_agent.models import Sample
from simrace_agent.sender import BatchSender
from simrace_agent.sources.acc import LIVE_SOURCES, live_source
from simrace_agent.sources.base import Source, SourceError
from simrace_agent.sources.replay import Recorder, ReplaySource


def _format_xz(sample: Sample) -> str:
    if sample.x is None or sample.z is None:
        return "x,z n.d."
    return f"x {sample.x:9.1f}  z {sample.z:9.1f}"


def _format_wheels(label: str, values: list[float] | None, unit: str) -> str:
    if values is None:
        return f"{label} n.d."
    return f"{label} " + " ".join(f"{v:6.1f}" for v in values) + f" {unit}"


def _probe(source: Source) -> None:
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
                f"{sample.lap_time_ms / 1000:7.3f}s  pos {sample.track_pos:.3f}  "
                f"statut {sample.status}  {_format_xz(sample)}"
            )
            print(
                "   " + _format_wheels("pneus", sample.tyre_pressure_psi, "psi")
                + " | " + _format_wheels("temp", sample.tyre_temp_c, "C")
                + " | " + _format_wheels("freins", sample.brake_temp_c, "C")
                + " | " + _format_wheels("plaquettes", sample.pad_life_mm, "mm")
                + " | " + _format_wheels("disques", sample.disc_life_mm, "mm")
            )
            print(
                f"   carburant {sample.fuel_l} L  conso {sample.fuel_per_lap_l} L/tour  "
                f"TC {sample.tc_level}  ABS {sample.abs_level}  "
                f"G lat {sample.g_lat} vert {sample.g_vert} long {sample.g_long}"
            )
            print(
                f"   drapeau {describe_flag(sample.flag)}  penalite {describe_penalty(sample.penalty_code)}  "
                f"temps de penalite {sample.penalty_time_s} s"
            )
            print(
                f"   TC cut {sample.tc_cut_level}  map {sample.engine_map}  BB {sample.brake_bias}  "
                f"tour valide {sample.is_valid_lap}  tours de carburant {sample.fuel_estimated_laps}  "
                f"drapeaux {sample.track_flags}"
            )
            print(
                f"   air {sample.air_temp_c} C  piste {sample.road_temp_c} C  "
                f"dernier tour {sample.last_lap_ms / 1000:.3f}s  meilleur {sample.best_lap_ms / 1000:.3f}s  "
                f"stands {sample.in_pit}"
            )


def _build_source(args: argparse.Namespace) -> Source:
    if args.source == "replay":
        if not args.file:
            raise SourceError("--file est obligatoire avec --source replay")
        return ReplaySource(Path(args.file), speed=args.speed)
    return live_source(args.source)


def main(argv: list[str] | None = None) -> None:
    config.load_env_file(Path(".env"))
    parser = argparse.ArgumentParser(prog="simrace-agent")
    sub = parser.add_subparsers(dest="command", required=True)

    # jeu lu en direct: SIMRACE_SOURCE (.env) par defaut, --source le remplace
    game = config.game_source()
    games = list(LIVE_SOURCES)
    game_help = f"jeu lu en direct (defaut {game}, SIMRACE_SOURCE)"

    probe = sub.add_parser("probe", help="affiche en direct les valeurs lues dans le jeu")
    probe.add_argument("--source", choices=games, default=game, help=game_help)

    run = sub.add_parser("run", help="envoie la telemetrie au serveur")
    run.add_argument("--server", default=config.server_url())
    run.add_argument("--station-id", default=config.station_id(socket.gethostname()))
    run.add_argument("--source", choices=[*games, "replay"], default=game, help=game_help)
    run.add_argument("--file", help="fichier a rejouer (--source replay)")
    run.add_argument("--speed", type=float, default=1.0, help="vitesse de rejeu")
    run.add_argument("--batch-ms", type=int, default=200)

    record = sub.add_parser("record", help="enregistre une session du jeu dans un fichier")
    record.add_argument("--out", required=True)
    record.add_argument("--source", choices=games, default=game, help=game_help)

    sub.add_parser("gui", help="fenetre: envoyer, enregistrer un replay, tout arreter")

    args = parser.parse_args(argv)
    try:
        if game not in LIVE_SOURCES and getattr(args, "source", None) == game:
            # argparse ne verifie pas une valeur par defaut venue de l'environnement
            raise SourceError(f"SIMRACE_SOURCE={game} inconnu (choix: {', '.join(games)})")
        if args.command == "probe":
            _probe(live_source(args.source))
        elif args.command == "gui":
            from simrace_agent import gui  # tkinter charge seulement pour la fenetre

            gui.main()
        elif args.command == "record":
            for _ in Recorder(live_source(args.source), Path(args.out)).samples():
                pass
        else:
            actions.stream(
                _build_source(args), BatchSender(args.server, args.station_id), args.batch_ms,
                threading.Event(),
            )
    except SourceError as exc:
        raise SystemExit(f"Erreur: {exc}") from exc
    except KeyboardInterrupt:
        pass
