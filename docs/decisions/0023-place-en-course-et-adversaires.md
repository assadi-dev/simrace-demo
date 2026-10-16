# 0023 Place en course et nombre d'adversaires

Statut : Acceptée. Date : 2026-10-16. Branche : `test/assetto-corsa-evo`.

## Contexte

Un opérateur de centre veut voir, pour chaque poste, la place du pilote dans la course et contre
combien de voitures il roule. Les deux jeux publient ces valeurs dans leur page graphique, mais
l'agent ne les envoyait pas : ACC décodait déjà la position (offset 136) et la jetait.

Mesures sur la page graphique d'AC EVO 0.9.1 enregistrée pendant la course contre l'IA du
2026-10-16 (Monza, 6 minutes, voir le complément de la 0022) :

- offset 2388 (juste après `total_lap_count`) : 5 sur la grille, puis 7, 8 et 9 dans le premier
  tour. C'est la place du joueur.
- `active_cars` (offset 3852) : 10, soit le joueur et 9 IA.
- En essais libres seul en piste (enregistrements du tour de mesure) : place 0, `active_cars` 1.

## Décision

- Deux champs optionnels dans le contrat, agent (`models.py`), serveur (`contract.py`) et front
  (Zod) :
  - `race_position` : place au classement, 1 = premier, de 1 à 60 ;
  - `opponents` : voitures en piste hors joueur, de 0 à 59. **0 = seul en piste.**
- Calcul commun `layout.race_standing(position, active_cars)` :
  - une place hors de 1 à 60 (0 en essais solo d'EVO) donne `None`, jamais une place inventée ;
  - adversaires = voitures actives - 1 ; `None` si le jeu annonce 0 voiture (hors session).
- Sources :

| Jeu | Place | Voitures actives | Vérifié |
|---|---|---|---|
| AC EVO | page graphique, offset 2388 (int32) | `active_cars`, offset 3852 (uint8) | oui, sur la course enregistrée |
| ACC | `position`, offset 136 (int32) | `activeCars`, offset 252 (int32) | oui (2026-10-16, Nürburgring, 7 voitures) : P1 avant le départ, P7 en course, comme le jeu |

- Front : KPI « Position » (P7, avec « Sur 10 voitures ») et « Adversaires » en tête de l'écran
  Direct ; lignes « Position » et « Adversaires » sur la carte d'un poste. `n.d.` si la valeur
  manque, « Pas de classement, seul en piste » quand la place manque et qu'il n'y a pas
  d'adversaire.
- `probe` affiche `place` et `adversaires` pour la vérification sur un vrai jeu.

## Raisons

- Deux champs simples plutôt qu'un objet « classement » : même forme que les autres valeurs
  optionnelles du contrat, un ancien agent qui ne les envoie pas reste accepté.
- `opponents` plutôt que le nombre total de voitures : c'est ce que demande l'opérateur, et la
  valeur 0 dit clairement « seul en piste ».
- Pas de place 1 inventée en essais solo : le jeu ne classe pas, le front le dit.

## Conséquences

- ACC vérifié sur un vrai jeu : 7 voitures actives (6 adversaires), place 1 avant le départ puis
  7 en course, identique à l'affichage du jeu. `probe` affiche `place` et `adversaires`.
- Les enregistrements antérieurs n'ont pas ces champs : en rejeu, le front affiche `n.d.`.
- En essais avec d'autres voitures, EVO n'a pas été observé : la place peut y valoir 0 (`n.d.`).
