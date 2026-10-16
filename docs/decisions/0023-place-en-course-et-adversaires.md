# 0023 Place en course et nombre d'adversaires

Statut : Acceptée. Date : 2026-10-16. Branche : `test/assetto-corsa-evo`.

## Contexte

Un opérateur de centre veut voir, pour chaque poste, la place du pilote dans la course et contre
combien de voitures il roule. Les deux jeux publient ces valeurs dans leur page graphique, mais
l'agent ne les envoyait pas : ACC décodait déjà la position (offset 136) et la jetait.

Mesures sur AC EVO 0.9.1 (page graphique) :

- offset 2388 (juste après `total_lap_count`) : place du joueur **comptée à partir de 0**. Vu en
  direct le 2026-10-16 en course à 2 voitures : 1 en deuxième position, 0 juste après le
  dépassement. Dans la course contre 9 IA enregistrée le même jour, il valait 5 sur la grille (6e)
  puis 9 (10e).
- `active_cars` (offset 3852) : 10 dans la course contre 9 IA, 2 dans la course à deux.
- En essais libres seul en piste : place 0 (donc premier) et `active_cars` 1.

## Décision

- Deux champs optionnels dans le contrat, agent (`models.py`), serveur (`contract.py`) et front
  (Zod) :
  - `race_position` : place au classement, 1 = premier, de 1 à 60 ;
  - `opponents` : voitures en piste hors joueur, de 0 à 59. **0 = seul en piste.**
- Calcul commun `layout.race_standing(position, active_cars)`, place comptée à partir de 1 :
  - une place hors de 1 à 60 donne `None`, jamais une place inventée ;
  - adversaires = voitures actives - 1 ; `None` si le jeu annonce 0 voiture (hors session).
- Sources :

| Jeu | Place | Voitures actives | Vérifié |
|---|---|---|---|
| AC EVO | page graphique, offset 2388 (int32), **+1** ; pas de place sans voiture active | `active_cars`, offset 3852 (uint8) | oui en direct (2026-10-16, course à 2 : 2e puis 1er après un dépassement) |
| ACC | `position`, offset 136 (int32), déjà à partir de 1 | `activeCars`, offset 252 (int32) | oui (2026-10-16, Nürburgring, 7 voitures) : P1 avant le départ, P7 en course, comme le jeu |

- Front : KPI « Position » (valeur seule, 7, avec « Sur 10 voitures ») et « Adversaires » en tête
  de l'écran Direct ; lignes « Position » et « Adversaires » sur la carte d'un poste. `n.d.` si la
  valeur manque.
- `probe` affiche `place` et `adversaires` pour la vérification sur un vrai jeu.

## Raisons

- Deux champs simples plutôt qu'un objet « classement » : même forme que les autres valeurs
  optionnelles du contrat, un ancien agent qui ne les envoie pas reste accepté.
- `opponents` plutôt que le nombre total de voitures : c'est ce que demande l'opérateur, et la
  valeur 0 dit clairement « seul en piste ».
- Le contrat garde une seule convention (1 = premier) : la différence d'EVO est corrigée dans
  l'agent, comme les autres traductions de la 0022.

## Conséquences

- Les enregistrements antérieurs n'ont pas ces champs : en rejeu, le front affiche `n.d.`.
- Première version de cette décision : la place d'EVO était lue sans +1 (0 pris pour « pas de
  classement »). Corrigé le même jour après la course à deux voitures.
