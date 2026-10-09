# 0011 Enregistrement des tracés de circuit côté serveur

Statut : Acceptée. Écart de contrat résolu le 2026-10-09 (l'agent envoie maintenant `x` et `z`),
**offsets de `carCoordinates` à vérifier sur un vrai jeu**. Date : 2026-10-09.

## Contexte

ACC ne fournit pas le plan des circuits. La page graphique de sa mémoire partagée contient la
position monde de chaque voiture (`carCoordinates`). Aucune carte exploitable n'a été trouvée en
téléchargement. On construit donc la carte avec la trajectoire de tours propres réellement roulés.

## Décision

- Le **serveur** détecte la fin d'un tour (`completed_laps` augmente), valide le tour,
  rééchantillonne la trajectoire et l'**enregistre**. Ce n'est pas le navigateur : il n'écrit pas
  sur le disque et ne doit pas rester ouvert pendant le tour.
- **Un tour = un fichier JSON**, jamais écrasé : `data/tracks/<circuit>/<poste>-<run>-lap<N>.json`.
  L'écriture se fait dans un fichier temporaire puis `os.link` vers le nom final : l'opération
  échoue si le fichier existe, et aucun lecteur ne voit de fichier à moitié écrit.
- Un tour n'est gardé que s'il passe toutes les règles (`tracks/strategy.py`) : coordonnées
  présentes, départ et arrivée sur la ligne, aucun passage aux stands, aucun trou de données de
  plus d'une seconde, progression sans saut, temps de tour connu, nombre de points suffisant.
  Un refus est **compté avec sa raison** (`GET /recorder/status`), jamais silencieux.
- Les points sont **rééchantillonnés par position sur le tour** (1000 points, paramétrable) :
  environ 30 Ko par tour au lieu de 30 000 points bruts (cohérent avec la décision 0008).
- La **carte de référence** d'un circuit est choisie par une stratégie : meilleur temps (défaut)
  ou dernier tour (`SIMRACE_REFERENCE_STRATEGY`).
- Les noms venant de l'agent (circuit, poste, run) ne sont jamais utilisés tels quels dans un
  chemin : ils passent par `Slug` (`a-z`, `0-9`, `_`, `-`), puis le chemin final est vérifié
  contre le dossier racine.

## Contrat (décision 0009)

`x` et `z` sont des champs **optionnels** des deux côtés : `app/shared/contract.py` (serveur) et
`agent/src/simrace_agent/models.py`. Ils sont optionnels pour que les anciens enregistrements
restent rejouables (alors aucun tour n'est enregistré, raison `no_coordinates` comptée).

Côté agent (`layout.py`), la position du joueur est lue dans la page graphique : `activeCars` à
252, `carCoordinates[60][3]` à 256 (x, y, z ; y est la hauteur), `carID[60]` à 976, `playerCarID`
à 1216. La voiture du joueur est celle dont l'id vaut `playerCarID`. Position absente (`None`) si
le joueur n'est pas dans la liste, si une valeur n'est pas finie, ou si ACC renvoie l'origine.
Ces offsets viennent du calcul de la structure `SharedFileOut.h`, comme les autres : à confirmer
avec `probe`.

## Détection de la fin d'un tour

Constat sur un vrai ACC (2026-10-09) : au passage de la ligne après un tour de sortie des stands,
la position boucle (0,999 puis 0,000) et le chrono repart de zéro, mais `completed_laps` **reste à
0**. Le serveur reconnaît donc un passage de ligne de deux façons : le compteur qui avance de 1,
ou la position qui boucle (de plus de 0,9 vers moins de 0,1, après la moitié du tour). Un compteur
qui rattrape un passage déjà détecté (dans les 30 premiers points) ne crée pas de tour fantôme.
Le numéro d'un tour (`lap_number`) est son rang depuis le début du run, pas le compteur d'ACC.

## Complément

Les tours interrompus (pause, stands) ne sont pas perdus : voir la décision 0012, qui enregistre
aussi des morceaux de trace sans attendre la fin du tour.

## Conséquences

- La validité du tour d'ACC (`isValidLap`) n'est pas encore lue : un tour avec sortie de piste
  mais sans arrêt ni trou peut être enregistré. Les règles de position et de continuité limitent
  le risque, mais ne le suppriment pas.
- Rejouer plusieurs fois le même enregistrement produit un `run_id` différent à chaque fois, donc
  de nouveaux fichiers. `SIMRACE_RECORD_TRACKS=false` désactive l'enregistrement.
- Le dossier `server/data/` est ignoré par git. Une carte de référence que l'on veut livrer se
  copie explicitement.
- Lister les tours relit les fichiers. Suffisant pour une démo ; un index ou PostgreSQL
  remplacera cela si le volume grossit.
