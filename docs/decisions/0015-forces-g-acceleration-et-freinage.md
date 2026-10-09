# 0015 Forces G (accélération, freinage, virage)

Statut : Acceptée. Offsets vérifiés sur un vrai ACC le 2026-10-09. Date : 2026-10-09.

## Contexte

Les dashboards SimHub affichent la « pression » d'accélération et de freinage sous forme de forces G
(cercle ou barres). SimHub lit la même mémoire partagée qu'ACC expose à l'agent : il n'y a pas de
donnée cachée, seulement des calculs faits sur ces pages.

## Décision

- Trois champs optionnels dans `Sample`, lus dans `accG[3]` de la page physique (offset 44) :

| Champ | Axe | Constat sur un vrai ACC |
|---|---|---|
| `g_lat` | latéral | monte vers 1,0 à 1,2 G dans un virage ; le signe (gauche ou droite) n'est pas vérifié |
| `g_vert` | vertical | proche de 0, bouge aux bosses et aux appuis |
| `g_long` | longitudinal | +0,65 à +0,92 G en accélération, -1,3 à -1,45 G au freinage |

- Le pied sur les pédales est déjà couvert par `gas` et `brake` (0 à 1, décision antérieure).
- `brakePressure[4]` (offset 716) n'est pas lu : il vaut `brake` multiplié par la répartition de
  freinage (0,75 avant, 0,25 arrière), donc redondant.
- Un arrêt vaut 0 G (valeur valide, pas `None`). `None` seulement si une valeur n'est pas finie.
- Le serveur borne chaque composante à ±20 G.

## Conséquences

- Aucun changement de taille de page lue (la page physique couvre déjà l'offset).
- Les anciens enregistrements restent rejouables (champs absents, donc `None`).
