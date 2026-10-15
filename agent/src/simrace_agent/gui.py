"""Fenetre de l'executable: envoyer au serveur, enregistrer un replay, tout arreter.

tkinter fait partie de Python: pas de dependance en plus sur le PC de jeu. Chaque action tourne
dans son propre thread avec un `threading.Event` pour l'arreter proprement. Couleurs, tailles et
composants suivent design.md (theme "Flame & Sand", voir `theme.py`).
"""

import io
import queue
import socket
import sys
import threading
import tkinter as tk
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, ttk
from tkinter import font as tkfont

from simrace_agent import actions, config, icons, settings, theme
from simrace_agent.sender import BatchSender
from simrace_agent.sources import acc
from simrace_agent.sources.acc import AccSharedMemorySource
from simrace_agent.sources.base import SourceError
from simrace_agent.sources.replay import ReplaySource


def app_dir() -> Path:
    # dossier de l'exe (ou du .app sous macOS) une fois construit, dossier courant en developpement
    if getattr(sys, "frozen", False):
        return config.executable_dir(Path(sys.executable))
    return Path.cwd()


class _QueueWriter(io.TextIOBase):
    """Remplace stdout: les `print` de l'agent s'affichent dans la fenetre."""

    def __init__(self, lines: "queue.Queue[str]") -> None:
        self._lines = lines

    def write(self, text: str) -> int:
        if text.strip():
            self._lines.put(text.rstrip())
        return len(text)


class _Fonts:
    """Styles de design.md 4 (taille de reference x UI_SCALE, en pixels: taille negative)."""

    def __init__(self, root: tk.Tk) -> None:
        available = set(tkfont.families(root))
        sans = theme.pick_family(available, theme.FONT_FAMILIES)
        mono = theme.pick_family(available, theme.MONO_FAMILIES)
        self.brand = (sans, -theme.px(22), "bold")
        self.eyebrow = (sans, -theme.px(12), "bold")
        self.button = (sans, -theme.px(15), "bold")
        self.label = (sans, -theme.px(13))
        self.body = (sans, -theme.px(14))
        self.badge = (sans, -theme.px(12), "bold")
        self.mono = (mono, -theme.px(13))


class PillButton(tk.Canvas):
    """Bouton de design.md 8: `rounded-full h-11 px-4.5`, variante `ink` ou `secondary`."""

    def __init__(
        self, parent: tk.Widget, text: str, command: Callable[[], None], font: tuple,
        *, ink: bool = False, icon: str | None = None,
    ) -> None:
        height = theme.px(44)
        self._icon_size = theme.px(18)  # icones Lucide 16-22 px (design.md 1.7)
        icon_width = self._icon_size + theme.px(8) if icon else 0
        width = tkfont.Font(font=font).measure(text) + icon_width + 2 * theme.px(18)
        super().__init__(
            parent, width=width + 4, height=height + 4, bg=parent["bg"],
            highlightthickness=0, takefocus=True, cursor="hand2",
        )
        self._text, self._command, self._font, self._ink = text, command, font, ink
        self._icon = icon
        self._size = (width, height)
        self._enabled = True
        self._hover = False
        for event, handler in (
            ("<Enter>", lambda _e: self._set_hover(True)),
            ("<Leave>", lambda _e: self._set_hover(False)),
            ("<ButtonRelease-1>", lambda _e: self._click()),
            ("<KeyRelease-space>", lambda _e: self._click()),
            ("<KeyRelease-Return>", lambda _e: self._click()),
            ("<FocusIn>", lambda _e: self._draw()),
            ("<FocusOut>", lambda _e: self._draw()),
        ):
            self.bind(event, handler)
        self._draw()

    def set_enabled(self, enabled: bool) -> None:
        if enabled != self._enabled:
            self._enabled = enabled
            self.configure(cursor="hand2" if enabled else "arrow")
            self._draw()

    def _set_hover(self, hover: bool) -> None:
        self._hover = hover
        self._draw()

    def _click(self) -> None:
        if self._enabled:
            self._command()

    def _pill(self, x0: int, y0: int, x1: int, y1: int, fill: str, outline: str) -> None:
        r = (y1 - y0) / 2
        self.create_oval(x0, y0, x0 + 2 * r, y1, fill=fill, outline=outline)
        self.create_oval(x1 - 2 * r, y0, x1, y1, fill=fill, outline=outline)
        self.create_rectangle(x0 + r, y0, x1 - r, y1, fill=fill, outline="")
        self.create_line(x0 + r, y0, x1 - r, y0, fill=outline)
        self.create_line(x0 + r, y1, x1 - r, y1, fill=outline)

    def _draw(self) -> None:
        self.delete("all")
        width, height = self._size
        if self._ink:
            fill = theme.INK_HOVER if self._hover and self._enabled else theme.INK
            fill = fill if self._enabled else theme.SAND_500
            text, outline = theme.INK_FOREGROUND, fill
        else:
            fill = theme.CARD_BORDER if self._hover and self._enabled else theme.CARD_STRONG
            text = theme.FOREGROUND if self._enabled else theme.SAND_500
            outline = theme.BORDER_STRONG
        if self.focus_get() is self:
            self._pill(0, 0, width + 3, height + 3, theme.RING, theme.RING)  # anneau de focus
        self._pill(2, 2, width + 1, height + 1, fill, outline)
        left = theme.px(18) + 2
        if self._icon:
            size = self._icon_size
            icons.draw(self, self._icon, left, (height - size) / 2 + 2, size, text)
            left += size + theme.px(8)
        self.create_text(
            left, height / 2 + 2, text=self._text, anchor="w", fill=text, font=self._font
        )


class StatusBadge(tk.Canvas):
    """Pastille + libelle (design.md 2.4): la forme change avec le statut, pas que la couleur."""

    def __init__(self, parent: tk.Widget, font: tuple) -> None:
        super().__init__(parent, height=theme.px(28), bg=parent["bg"], highlightthickness=0)
        self._font = font

    def show(self, label: str, status: tuple[str, str, str], shape: str) -> None:
        dot, soft, text = status
        self.delete("all")
        height = int(self["height"])
        width = tkfont.Font(font=self._font).measure(label) + theme.px(44)
        self.configure(width=width)
        r = height / 2
        self.create_oval(0, 0, height, height, fill=soft, outline="")
        self.create_oval(width - height, 0, width, height, fill=soft, outline="")
        self.create_rectangle(r, 0, width - r, height, fill=soft, outline="")
        cx, cy, d = theme.px(16), r, theme.px(5)
        if shape == "round":
            self.create_oval(cx - d, cy - d, cx + d, cy + d, fill=dot, outline="")
        elif shape == "square":
            self.create_rectangle(cx - d, cy - d, cx + d, cy + d, fill=dot, outline="")
        else:  # anneau
            self.create_oval(cx - d, cy - d, cx + d, cy + d, outline=dot, width=2)
        self.create_text(cx + 2 * d, cy, text=label, anchor="w", fill=text, font=self._font)


class AgentWindow:
    def __init__(self, root: tk.Tk) -> None:
        self._root = root
        self._lines: queue.Queue[str] = queue.Queue()
        self._stops: dict[str, threading.Event] = {}
        self._workers: dict[str, threading.Thread] = {}
        sys.stdout = sys.stderr = _QueueWriter(self._lines)
        fonts = self._fonts = _Fonts(root)
        gap = theme.px(20)

        root.title("SimRace agent")
        root.configure(bg=theme.AMBIENT_MID, padx=gap, pady=gap)
        root.minsize(640, 640)
        root.protocol("WM_DELETE_WINDOW", self._quit)

        header = self._card(root)
        header.pack(fill="x")
        titles = tk.Frame(header, bg=theme.CARD)
        titles.pack(side="left")
        self._eyebrow(titles, "AGENT DU POSTE").pack(anchor="w")
        tk.Label(titles, text="SimRace", font=fonts.brand, fg=theme.FOREGROUND, bg=theme.CARD).pack(
            anchor="w"
        )
        self._badge = StatusBadge(header, fonts.badge)
        self._badge.pack(side="right")

        values = settings.load(settings.settings_path(), {
            "server": config.server_url(),
            "station": config.station_id(socket.gethostname()),
            "folder": str(app_dir() / "recordings"),
            "replay": "",
        })
        form = self._card(root)
        form.pack(fill="x", pady=(gap, 0))
        self._eyebrow(form, "RÉGLAGES").grid(row=0, column=0, columnspan=2, sticky="w")
        self._server = self._field(form, 1, "Serveur", values["server"])
        self._station = self._field(form, 2, "Poste", values["station"])
        self._folder = self._field(form, 3, "Dossier des replays", values["folder"])
        form.columnconfigure(1, weight=1)

        buttons = tk.Frame(root, bg=theme.AMBIENT_MID)
        # envoi et enregistrement lisent ACC: masques hors Windows, le rejeu a son bouton d'arret
        if acc.AVAILABLE:
            buttons.pack(fill="x", pady=(gap, 0))
        # un seul bouton sombre par zone (design.md 1.4): l'envoi est l'action principale
        self._send_btn = PillButton(
            buttons, "Envoyer au serveur", self._start_send, fonts.button, ink=True, icon="send"
        )
        self._record_btn = PillButton(
            buttons, "Enregistrer une session", self._start_record, fonts.button, icon="record"
        )
        self._stop_btn = PillButton(
            buttons, "Tout arrêter", self._stop_all, fonts.button, icon="stop"
        )
        for button in (self._send_btn, self._record_btn, self._stop_btn):
            button.pack(side="left", padx=(0, theme.px(12)))

        replay = self._card(root)
        replay.pack(fill="x", pady=(gap, 0))
        self._eyebrow(replay, "REJOUER UNE SESSION").grid(
            row=0, column=0, columnspan=3, sticky="w", pady=(0, theme.px(8))
        )
        # sessions du dossier des replays, relues a chaque ouverture de la liste
        self._replays: list[tuple[Path, str]] = []
        self._replay = tk.StringVar()
        self._style_combobox(root)
        self._replay_list = ttk.Combobox(
            replay, textvariable=self._replay, state="readonly", font=fonts.body,
            style="Simrace.TCombobox", postcommand=self._reload_replays,
        )
        self._replay_list.grid(row=1, column=0, columnspan=3, sticky="ew", ipady=theme.px(6))
        # dernier fichier choisi (Parcourir ou session precedente), meme hors du dossier
        self._browsed = Path(values["replay"]) if values["replay"] else None
        row = tk.Frame(replay, bg=theme.CARD)
        row.grid(row=2, column=0, columnspan=3, sticky="w", pady=(theme.px(12), 0))
        self._replay_btn = PillButton(
            row, "Lancer la session", self._start_replay, fonts.button, ink=True, icon="play"
        )
        self._replay_stop_btn = PillButton(
            row, "Arrêter la session", self._stop_replay, fonts.button, icon="stop"
        )
        for button in (
            PillButton(row, "Parcourir", self._browse_replay, fonts.button, icon="folder"),
            PillButton(row, "Actualiser", self._reload_replays, fonts.button, icon="refresh"),
            self._replay_btn,
            self._replay_stop_btn,
        ):
            button.pack(side="left", padx=(0, theme.px(12)))
        replay.columnconfigure(0, weight=1)
        self._reload_replays()

        journal = self._card(root)
        journal.pack(fill="both", expand=True, pady=(gap, 0))
        self._eyebrow(journal, "JOURNAL").pack(anchor="w", pady=(0, theme.px(8)))
        self._log = tk.Text(
            journal, height=10, state="disabled", wrap="word", font=fonts.mono,
            bg=theme.CARD_STRONG, fg=theme.FOREGROUND, relief="flat",
            highlightthickness=1, highlightbackground=theme.BORDER_STRONG,
            padx=theme.px(12), pady=theme.px(8),
        )
        self._log.pack(fill="both", expand=True)

        self._refresh()

    @staticmethod
    def _card(parent: tk.Misc) -> tk.Frame:
        # Card de design.md 8: verre `card`, contour `card-border` 1px, `p-6`
        pad = theme.px(24)
        return tk.Frame(
            parent, bg=theme.CARD, padx=pad, pady=pad,
            highlightthickness=1, highlightbackground=theme.CARD_BORDER,
        )

    def _eyebrow(self, parent: tk.Widget, text: str) -> tk.Label:
        return tk.Label(
            parent, text=text, font=self._fonts.eyebrow, fg=theme.PRIMARY_TEXT, bg=theme.CARD
        )

    def _field(self, parent: tk.Frame, row: int, label: str, value: str) -> tk.StringVar:
        var = tk.StringVar(value=value)
        pad = theme.px(6)
        tk.Label(
            parent, text=label, font=self._fonts.label, fg=theme.MUTED_FOREGROUND, bg=theme.CARD
        ).grid(row=row, column=0, sticky="w", padx=(0, theme.px(16)), pady=pad)
        tk.Entry(
            parent, textvariable=var, font=self._fonts.body, relief="flat",
            bg=theme.CARD_STRONG, fg=theme.FOREGROUND, insertbackground=theme.FOREGROUND,
            highlightthickness=1, highlightbackground=theme.BORDER_STRONG,
            highlightcolor=theme.RING,
        ).grid(row=row, column=1, sticky="ew", pady=pad, ipady=theme.px(8), ipadx=theme.px(8))
        return var

    def _save_settings(self) -> None:
        values = {
            "server": self._server.get(), "station": self._station.get(),
            "folder": self._folder.get(), "replay": str(self._selected_replay() or ""),
        }
        try:
            settings.save(settings.settings_path(), values)
        except OSError as exc:
            print(f"[agent] reglages non enregistres: {exc}")

    def _running(self) -> list[str]:
        return [name for name, thread in self._workers.items() if thread.is_alive()]

    def _stopping(self) -> list[str]:
        return [name for name in self._running() if self._stops[name].is_set()]

    def _launch(self, name: str, target: Callable[[threading.Event], None]) -> None:
        # un signal d'arret par action: le replay s'arrete sans couper l'envoi ou l'enregistrement
        if name in self._running():
            return
        self._save_settings()
        stop = self._stops[name] = threading.Event()

        def run() -> None:
            try:
                target(stop)
            except SourceError as exc:
                print(f"[agent] erreur: {exc}")
            except Exception as exc:  # noqa: BLE001 (affiche l'erreur au lieu de fermer l'exe)
                print(f"[agent] erreur inattendue: {exc!r}")

        thread = threading.Thread(target=run, name=name, daemon=True)
        self._workers[name] = thread
        thread.start()

    def _start_send(self) -> None:
        server, station = self._server.get().strip(), self._station.get().strip()
        print(f"[agent] envoi vers {server} (poste {station})")
        self._launch("envoi", lambda stop: actions.stream(
            AccSharedMemorySource(stop=stop), BatchSender(server, station), 200, stop,
        ))

    def _start_record(self) -> None:
        folder = Path(self._folder.get().strip())
        path = actions.recording_path(folder, datetime.now().astimezone())
        print(f"[agent] enregistrement dans {path}")
        self._launch("enregistrement", lambda stop: actions.record(
            AccSharedMemorySource(stop=stop), path, stop,
        ))

    def _style_combobox(self, root: tk.Tk) -> None:
        # meme rendu que les champs: fond `card-strong`, contour `border-strong`, focus `ring`
        style = ttk.Style(root)
        style.theme_use("clam")  # le theme Windows ignore les couleurs des champs
        style.configure(
            "Simrace.TCombobox", fieldbackground=theme.CARD_STRONG, background=theme.CARD_STRONG,
            foreground=theme.FOREGROUND, bordercolor=theme.BORDER_STRONG,
            lightcolor=theme.CARD_STRONG, darkcolor=theme.CARD_STRONG,
            arrowcolor=theme.FOREGROUND, padding=theme.px(8),
        )
        style.map(
            "Simrace.TCombobox", fieldbackground=[("readonly", theme.CARD_STRONG)],
            selectbackground=[("readonly", theme.CARD_STRONG)],
            selectforeground=[("readonly", theme.FOREGROUND)],
            bordercolor=[("focus", theme.RING)],
        )
        root.option_add("*TCombobox*Listbox.font", self._fonts.body)
        root.option_add("*TCombobox*Listbox.background", theme.CARD_STRONG)
        root.option_add("*TCombobox*Listbox.foreground", theme.FOREGROUND)
        root.option_add("*TCombobox*Listbox.selectBackground", theme.PRIMARY_SOFT)
        root.option_add("*TCombobox*Listbox.selectForeground", theme.FOREGROUND)

    def _selected_replay(self) -> Path | None:
        label = self._replay.get()
        return next((path for path, text in self._replays if text == label), None)

    def _reload_replays(self) -> None:
        current = self._selected_replay() or self._browsed
        self._replays = actions.list_replays(Path(self._folder.get().strip()), self._browsed)
        labels = [text for _, text in self._replays]
        self._replay_list.configure(values=labels)
        keep = next((text for path, text in self._replays if path == current), None)
        if keep:
            self._replay.set(keep)
        elif labels:
            self._replay.set(labels[0])  # le plus recent par defaut
        else:
            self._replay.set("Aucune session dans le dossier des replays")

    def _browse_replay(self) -> None:
        folder = Path(self._folder.get().strip())
        chosen = filedialog.askopenfilename(
            parent=self._root, title="Choisir une session",
            initialdir=folder if folder.is_dir() else app_dir(),
            filetypes=[("Sessions simrace", " ".join(f"*{s}" for s in actions.REPLAY_SUFFIXES))],
        )
        if not chosen:
            return
        path = Path(chosen)
        if actions.replay_info(path) is None:
            print(f"[agent] {path.name} n'est pas une session simrace (JSON lines attendu)")
            return
        self._browsed = path
        self._replay.set("")  # la selection suit le fichier choisi
        self._reload_replays()

    def _start_replay(self) -> None:
        path = self._selected_replay()
        if path is None:
            print("[agent] aucune session a rejouer: enregistre-en une ou change de dossier")
            return
        server, station = self._server.get().strip(), self._station.get().strip()
        print(f"[agent] rejeu de {path.name} vers {server} (poste {station})")
        # le fichier est lu dans le thread: un fichier invalide s'affiche dans le journal
        self._launch("rejeu", lambda stop: actions.stream(
            ReplaySource(path, stop=stop), BatchSender(server, station), 200, stop,
        ))

    def _stop_replay(self) -> None:
        if "rejeu" in self._running():
            print("[agent] arret de la session demande")
            self._stops["rejeu"].set()

    def _stop_all(self) -> None:
        if self._running():
            print("[agent] arret demande")
        for stop in self._stops.values():
            stop.set()

    def _refresh(self) -> None:
        # appele toutes les 200 ms dans le thread de tkinter (seul autorise a toucher la fenetre)
        while not self._lines.empty():
            self._log.configure(state="normal")
            self._log.insert("end", self._lines.get() + "\n")
            self._log.see("end")
            self._log.configure(state="disabled")
        running, stopping = self._running(), self._stopping()
        active = [name for name in running if name not in stopping]
        if stopping:
            self._badge.show("Arrêt en cours", theme.WARNING, "square")
        elif running:
            labels = {"envoi": "Envoi", "enregistrement": "Enregistrement", "rejeu": "Rejeu"}
            self._badge.show(" + ".join(labels[n] for n in running), theme.SUCCESS, "round")
        else:
            self._badge.show("Arrêté", theme.DANGER, "ring")
        # ACC et rejeu envoient pour le meme poste: un seul des deux a la fois
        sending = "envoi" in running or "rejeu" in running
        self._send_btn.set_enabled(not sending)
        self._replay_btn.set_enabled(not sending)
        self._replay_stop_btn.set_enabled("rejeu" in active)
        self._record_btn.set_enabled("enregistrement" not in running)
        self._stop_btn.set_enabled(bool(active))
        self._next_refresh = self._root.after(200, self._refresh)

    def _quit(self) -> None:
        self._save_settings()
        for stop in self._stops.values():
            stop.set()
        for thread in self._workers.values():
            thread.join(timeout=4)
        self._root.after_cancel(self._next_refresh)  # sinon tkinter appelle une fenetre detruite
        self._root.destroy()


def main() -> None:
    config.load_env_file(app_dir() / ".env")
    root = tk.Tk()
    AgentWindow(root)
    root.mainloop()


if __name__ == "__main__":
    main()
