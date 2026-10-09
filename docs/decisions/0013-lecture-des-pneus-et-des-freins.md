# 0013 Lecture des pneus et des freins

Statut : Acceptée, **offsets à vérifier sur un vrai jeu**. Date : 2026-10-09.

## Contexte

Les overlays de pilotage (SimHub, etc.) affichent par roue la pression, la température du pneu et
l'état des freins. Tout vient de la page physique de la mémoire partagée d'ACC, que l'agent lit déjà
(sans ces champs). On les ajoute pour le front (écran Direct) et pour l'analyse.

## Décision

- Cinq mesures **optionnelles** dans `Sample`, des deux côtés du contrat (décision 0009) : chacune
  est une liste de **4 valeurs**, ordre avant gauche, avant droit, arrière gauche, arrière droit.

| Champ | Source ACC (page physique) | Offset | Unité |
|---|---|---|---|
| `tyre_pressure_psi` | `wheelsPressure[4]` | 88 | psi |
| `tyre_temp_c` | `tyreCoreTemperature[4]` | 152 | °C (cœur du pneu) |
| `brake_temp_c` | `brakeTemp[4]` | 348 | °C |
| `pad_life_mm` | `padLife[4]` | 740 | mm restants |
| `disc_life_mm` | `discLife[4]` | 756 | mm restants |

- `PHYSICS_SIZE` passe de 32 à 772 octets (jusqu'à `discLife` inclus). Lecture seule (décision 0007).
- Si ACC renvoie quatre zéros (hors session) ou une valeur non finie, l'agent envoie `None`, pas une
  fausse mesure.
- Le serveur valide : exactement 4 valeurs, pression et usure dans 0..100, pneu dans -50..500 °C,
  freins dans -50..2000 °C, aucune valeur `nan`. Un échantillon invalide est rejeté et compté, comme
  les autres (le lot n'échoue pas).
- Les températures intérieure, centrale et extérieure du pneu (`tyreTempI/M/O`, offsets 368, 384,
  400) ne sont pas lues : on n'a pas vérifié qu'ACC les renseigne. À ajouter si le front en a besoin.

## Conséquences

- Les anciens enregistrements restent rejouables (champs absents, donc `None`).
- Le poids d'un échantillon grandit d'environ 150 octets en JSON : acceptable avec les lots de 200 ms
  (décision 0008 pour le stockage réduit).
- `probe` affiche une seconde ligne par instant avec ces mesures : à comparer avec l'overlay du jeu.
