"""Icones Lucide (design.md 9) redessinees sur un canvas tkinter, qui ne lit pas le SVG.

Chaque icone est une liste de formes sur la grille 24 x 24 de Lucide, trait de 2 px, couleur
du texte du bouton (`currentColor`).
"""

import tkinter as tk

# ("poly", points fermes) | ("line", points ouverts) | ("circle", cx, cy, r) | ("dot", cx, cy, r)
# | ("arc", cx, cy, r, debut, etendue)
ICONS: dict[str, list[tuple]] = {
    "send": [  # lucide "send"
        ("poly", [(22, 2), (15, 22), (11, 13), (2, 9)]),
        ("line", [(22, 2), (11, 13)]),
    ],
    "play": [("poly", [(6, 3), (20, 12), (6, 21)])],  # lucide "play"
    "record": [("circle", 12, 12, 10), ("dot", 12, 12, 3)],  # lucide "circle-dot"
    "stop": [("poly", [(4, 4), (20, 4), (20, 20), (4, 20)])],  # lucide "square"
    "folder": [  # lucide "folder-open", simplifie
        ("poly", [(2, 4), (9, 4), (11, 7), (20, 7), (20, 10), (6, 10), (2, 20)]),
        ("poly", [(6, 10), (22, 10), (18, 20), (2, 20)]),
    ],
    "refresh": [  # lucide "refresh-cw"
        ("arc", 12, 12, 9, 45, 135),
        ("line", [(18.4, 5.6), (21, 8)]),
        ("line", [(21, 3), (21, 8), (16, 8)]),
        ("arc", 12, 12, 9, 225, 135),
        ("line", [(5.6, 18.4), (3, 16)]),
        ("line", [(8, 16), (3, 16), (3, 21)]),
    ],
}


def draw(canvas: tk.Canvas, name: str, x: float, y: float, size: float, color: str) -> None:
    """Dessine l'icone `name` dans le carre (x, y, size)."""
    k = size / 24

    def pt(px: float, py: float) -> tuple[float, float]:
        return x + px * k, y + py * k

    for shape in ICONS[name]:
        kind = shape[0]
        if kind in ("poly", "line"):
            points = [coord for p in shape[1] for coord in pt(*p)]
            if kind == "poly":
                points += points[:2]
            canvas.create_line(*points, fill=color, width=2, joinstyle="round", capstyle="round")
        elif kind == "arc":  # angles tkinter: 0 = 3 h, sens inverse des aiguilles
            _, cx, cy, r, start, extent = shape
            canvas.create_arc(
                *pt(cx - r, cy - r), *pt(cx + r, cy + r), start=start, extent=extent,
                style="arc", outline=color, width=2,
            )
        else:
            _, cx, cy, r = shape
            x0, y0 = pt(cx - r, cy - r)
            x1, y1 = pt(cx + r, cy + r)
            if kind == "dot":
                canvas.create_oval(x0, y0, x1, y1, fill=color, outline="")
            else:
                canvas.create_oval(x0, y0, x1, y1, outline=color, width=2)
