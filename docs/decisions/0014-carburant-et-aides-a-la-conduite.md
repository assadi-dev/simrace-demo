# 0014 Carburant et aides à la conduite

Statut : Acceptée. Offsets tous vérifiés sur un vrai ACC le 2026-10-09 (carburant restant 62,0 L
identique à l'overlay du jeu). Date : 2026-10-09.

## Contexte

Un overlay affiche le carburant en litres. Pour en tirer la quantité restante (pourcentage, tours
restants), il faut la capacité du réservoir et la consommation par tour, pas seulement les litres.
Le front veut aussi les réglages de contrôle de traction (TC) et d'ABS.

## Décision

| Champ | Où | Source ACC | Offset | Vérifié |
|---|---|---|---|---|
| `fuel_l` | `Sample` | physique `fuel` | 12 | oui : 62,0 L, comme l'overlay |
| `fuel_per_lap_l` | `Sample` | graphique `fuelXLap` | 1284 | oui : 3,0 L/tour |
| `tc_level` | `Sample` | graphique `TC` | 1268 | oui : 7 |
| `abs_level` | `Sample` | graphique `ABS` | 1280 | oui : 4 |
| `fuel_capacity_l` | `SessionInfo` | statique `maxFuel` | 416 | oui : 120,0 L |

- La capacité est une donnée de **session** (elle ne change pas pendant le roulage) : elle est dans
  `SessionInfo`, pas répétée dans chaque échantillon. Le front calcule le pourcentage restant
  (`fuel_l / fuel_capacity_l`) et les tours restants (`fuel_l / fuel_per_lap_l`).
- `tc_level` et `abs_level` sont les **réglages** choisis par le pilote (0 = aide coupée, valeur
  valide). Les valeurs d'**action** (l'aide qui intervient, physique 204 et 252) ne sont pas lues.
- Tous les champs sont optionnels des deux côtés. `fuel_per_lap_l` vaut `None` quand ACC n'a pas
  encore d'estimation (0), la capacité `None` si la page statique ne la renseigne pas.
- Le serveur borne : carburant 0..1000 L, consommation 0..100 L/tour, niveaux 0..30.
- Tailles lues : graphique 1288 octets, statique 420 octets.
