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
from tkinter import font as tkfont

from simrace_agent import actions, config, settings, theme
from simrace_agent.sender import BatchSender
from simrace_agent.sources.acc import AccSharedMemorySource
from simrace_agent.sources.base import SourceError


def app_dir() -> Path:
    # dossier de l'exe une fois construit, dossier courant en developpement
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
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
        *, ink: bool = False,
    ) -> None:
        height = theme.px(44)
        width = tkfont.Font(font=font).measure(text) + 2 * theme.px(18)
        super().__init__(
            parent, width=width + 4, height=height + 4, bg=parent["bg"],
            highlightthickness=0, takefocus=True, cursor="hand2",
        )
        self._text, self._command, self._font, self._ink = text, command, font, ink
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
        self.create_text(width / 2 + 2, height / 2 + 2, text=self._text, fill=text, font=self._font)


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
        self._stop = threading.Event()
        self._workers: dict[str, threading.Thread] = {}
        sys.stdout = sys.stderr = _QueueWriter(self._lines)
        fonts = self._fonts = _Fonts(root)
        gap = theme.px(20)

        root.title("SimRace agent")
        root.configure(bg=theme.AMBIENT_MID, padx=gap, pady=gap)
        root.minsize(640, 460)
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
        })
        form = self._card(root)
        form.pack(fill="x", pady=(gap, 0))
        self._eyebrow(form, "RÉGLAGES").grid(row=0, column=0, columnspan=2, sticky="w")
        self._server = self._field(form, 1, "Serveur", values["server"])
        self._station = self._field(form, 2, "Poste", values["station"])
        self._folder = self._field(form, 3, "Dossier des replays", values["folder"])
        form.columnconfigure(1, weight=1)

        buttons = tk.Frame(root, bg=theme.AMBIENT_MID)
        buttons.pack(fill="x", pady=(gap, 0))
        # un seul bouton sombre par zone (design.md 1.4): l'envoi est l'action principale
        self._send_btn = PillButton(
            buttons, "Envoyer au serveur", self._start_send, fonts.button, ink=True
        )
        self._record_btn = PillButton(
            buttons, "Enregistrer un replay", self._start_record, fonts.button
        )
        self._stop_btn = PillButton(buttons, "Tout arrêter", self._stop_all, fonts.button)
        for button in (self._send_btn, self._record_btn, self._stop_btn):
            button.pack(side="left", padx=(0, theme.px(12)))

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
            "folder": self._folder.get(),
        }
        try:
            settings.save(settings.settings_path(), values)
        except OSError as exc:
            print(f"[agent] reglages non enregistres: {exc}")

    def _running(self) -> list[str]:
        return [name for name, thread in self._workers.items() if thread.is_alive()]

    def _launch(self, name: str, target: Callable[[], None]) -> None:
        if name in self._running():
            return
        self._save_settings()
        if not self._running():
            self._stop.clear()

        def run() -> None:
            try:
                target()
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
        self._launch("envoi", lambda: actions.stream(
            AccSharedMemorySource(stop=self._stop), BatchSender(server, station), 200, self._stop,
        ))

    def _start_record(self) -> None:
        folder = Path(self._folder.get().strip())
        path = actions.recording_path(folder, datetime.now().astimezone())
        print(f"[agent] enregistrement dans {path}")
        self._launch("replay", lambda: actions.record(
            AccSharedMemorySource(stop=self._stop), path, self._stop,
        ))

    def _stop_all(self) -> None:
        if self._running():
            print("[agent] arret demande")
        self._stop.set()

    def _refresh(self) -> None:
        # appele toutes les 200 ms dans le thread de tkinter (seul autorise a toucher la fenetre)
        while not self._lines.empty():
            self._log.configure(state="normal")
            self._log.insert("end", self._lines.get() + "\n")
            self._log.see("end")
            self._log.configure(state="disabled")
        running = self._running()
        stopping = self._stop.is_set() and bool(running)
        if stopping:
            self._badge.show("Arrêt en cours", theme.WARNING, "square")
        elif running:
            labels = {"envoi": "Envoi", "replay": "Enregistrement"}
            self._badge.show(" + ".join(labels[n] for n in running), theme.SUCCESS, "round")
        else:
            self._badge.show("Arrêté", theme.DANGER, "ring")
        self._send_btn.set_enabled("envoi" not in running and not stopping)
        self._record_btn.set_enabled("replay" not in running and not stopping)
        self._stop_btn.set_enabled(bool(running) and not stopping)
        self._next_refresh = self._root.after(200, self._refresh)

    def _quit(self) -> None:
        self._save_settings()
        self._stop.set()
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
