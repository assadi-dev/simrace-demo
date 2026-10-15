import pytest

from simrace_agent import icons


@pytest.mark.parametrize("name", ["send", "play", "record", "stop", "folder", "refresh"])
def test_icons_stay_in_lucide_grid(name):
    # toutes les formes tiennent dans la grille 24 x 24: l'icone ne deborde pas du bouton
    for shape in icons.ICONS[name]:
        if shape[0] in ("poly", "line"):
            points = shape[1]
        else:  # cercle, point ou arc: le carre qui l'entoure
            _, cx, cy, r = shape[:4]
            points = [(cx - r, cy - r), (cx + r, cy + r)]
        assert all(0 <= x <= 24 and 0 <= y <= 24 for x, y in points)
