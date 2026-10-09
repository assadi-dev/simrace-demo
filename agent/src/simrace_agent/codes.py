"""Noms lisibles des codes d'ACC (drapeaux et penalites).

Tables tirees de la structure SharedFileOut.h. Les valeurs reelles n'ont jamais ete vues sur un
vrai jeu (decision 0016): un code inconnu est affiche tel quel, jamais perdu.
"""

FLAGS = {
    0: "aucun",
    1: "bleu",
    2: "jaune",
    3: "noir",
    4: "blanc",
    5: "damier",
    6: "penalite",
}

PENALTIES = {
    0: "aucune",
    1: "passage par les stands (coupure de piste)",
    2: "stop and go 10 s (coupure de piste)",
    3: "stop and go 20 s (coupure de piste)",
    4: "stop and go 30 s (coupure de piste)",
    5: "disqualification (coupure de piste)",
    6: "meilleur tour supprime (coupure de piste)",
    7: "passage par les stands (exces de vitesse aux stands)",
    8: "stop and go 10 s (exces de vitesse aux stands)",
    9: "stop and go 20 s (exces de vitesse aux stands)",
    10: "stop and go 30 s (exces de vitesse aux stands)",
    11: "disqualification (exces de vitesse aux stands)",
    12: "meilleur tour supprime (exces de vitesse aux stands)",
    13: "disqualification (arret obligatoire ignore)",
    14: "temps ajoute apres la course",
    15: "disqualification (comportement)",
    16: "disqualification (entree des stands interdite)",
    17: "disqualification (sortie des stands interdite)",
    18: "disqualification (mauvais sens)",
    19: "passage par les stands (relais de pilote ignore)",
    20: "disqualification (relais de pilote ignore)",
    21: "disqualification (duree maximale de relais depassee)",
}


def describe_flag(code: int | None) -> str:
    if code is None:
        return "n.d."
    return FLAGS.get(code, f"inconnu ({code})")


def describe_penalty(code: int | None) -> str:
    if code is None:
        return "n.d."
    return PENALTIES.get(code, f"inconnue ({code})")


# Drapeaux globaux de la page graphique (offset 1500, un entier chacun, non nul = actif), dans
# l'ordre de la structure. Ce sont ceux que montrent les dashboards (jaune par secteur, vert...).
TRACK_FLAGS = (
    "yellow",
    "yellow_s1",
    "yellow_s2",
    "yellow_s3",
    "white",
    "green",
    "chequered",
    "red",
)
