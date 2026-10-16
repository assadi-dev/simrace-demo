"""Tokens du theme "Flame & Sand" (design.md, web/src/index.css) pour la fenetre tkinter.

Memes noms que les variables CSS. tkinter ne gere ni la transparence ni les degrades: le verre
(`card`, `card-strong`) est pre-melange sur `ambient-mid`, et le fond est l'aplat `ambient-mid`
(`--background` du front).
"""

UI_SCALE = 0.75  # --ui-scale du front: tailles de texte, espacements et rayons

AMBIENT_MID = "#e6dfd2"
CARD = "#ede8df"  # blanc 28 % sur ambient-mid
CARD_STRONG = "#f4f1eb"  # blanc 55 % sur ambient-mid
CARD_BORDER = "#f5f2ed"  # blanc 60 % sur ambient-mid
BORDER_STRONG = "#cac4b8"  # encre 14 % sur ambient-mid

FOREGROUND = "#1f1c18"  # sand-950
MUTED_FOREGROUND = "#66615a"  # sand-700
PRIMARY_TEXT = "#9e4a00"  # flame-700
PRIMARY_SOFT = "#fde8d0"  # flame-100, ligne choisie d'une liste
RING = "#ea903a"  # flame-400
INK = "#2d2c2a"  # sand-900, bouton principal
INK_HOVER = "#3d3a36"  # sand-800
INK_FOREGROUND = "#ffffff"
SAND_500 = "#a8a29a"  # bouton desactive

# statuts: pastille, fond (soft pre-melange sur card), texte
SUCCESS = ("#1fbf5e", "#d4e3cf", "#0b6e34")
WARNING = ("#e8a317", "#ecdec3", "#7f5300")
DANGER = ("#e5484d", "#ecd8d0", "#a91f2f")

FONT_FAMILIES = ("Inter Variable", "Inter", "Segoe UI")
MONO_FAMILIES = ("Cascadia Mono", "Consolas", "Courier New")


def px(value: float) -> int:
    """Valeur de reference de design.md (echelle 1) vers pixels a l'echelle de l'interface."""
    return round(value * UI_SCALE)


def pick_family(available: set[str], wanted: tuple[str, ...]) -> str:
    return next((name for name in wanted if name in available), wanted[-1])
