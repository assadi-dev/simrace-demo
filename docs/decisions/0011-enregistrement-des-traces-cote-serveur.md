# 0011 Enregistrement des tracés de circuit côté serveur

Statut : Acceptée, avec un écart temporaire de contrat (voir plus bas). Date : 2026-10-09.

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

## Écart temporaire de contrat (décision 0009)

`x` et `z` sont ajoutés comme champs **optionnels** dans `app/shared/contract.py` (serveur) mais
pas encore dans l'agent, qui reste inchangé à la demande de l'utilisateur. Tant que l'agent ne les
envoie pas, aucun tour n'est enregistré (raison `no_coordinates` comptée). À faire ensuite côté
agent : lire `carCoordinates` et `playerCarID` (page graphique), puis aligner `models.py`.

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
