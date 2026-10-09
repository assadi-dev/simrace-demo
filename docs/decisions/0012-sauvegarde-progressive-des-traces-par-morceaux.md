# 0012 Sauvegarde progressive des tracés, par morceaux

Statut : Acceptée. Complète la décision 0011 (elle ne la remplace pas). Date : 2026-10-09.

## Contexte

La décision 0011 n'enregistre un tracé qu'à la fin d'un tour **complet et valide**. Tout le reste est
perdu : un tour interrompu par une pause, une entrée aux stands, ou le tour de sortie des stands
(toujours refusé car il ne commence pas sur la ligne). Constaté sur une vraie session : un tour de
4,8 km roulé était refusé en entier.

## Décision

Le serveur enregistre aussi des **morceaux** de trace, sans attendre la fin du tour. Un morceau est
fermé, puis écrit, quand :

| Déclencheur (`reason`) | Quand |
|---|---|
| `sector` | le joueur franchit un secteur (le « checkpoint » d'ACC : le champ `sector` change) |
| `pause` | le jeu passe en pause (statut 3) |
| `pit_entry` | le joueur entre dans la voie des stands (la voie des stands n'est pas enregistrée) |
| `lap_end` | la ligne est franchie (dernier morceau du tour) |
| `stopped` | la session s'arrête (statut off ou replay) |
| `size_limit` | garde-fou : 20 000 points sans autre déclencheur (secteur qui ne change jamais) |

- **Un morceau = un fichier JSON, jamais écrasé** : `data/tracks/<circuit>/pieces/<poste>-<run>-p<début>.json`.
  Même mécanisme que les tours (fichier temporaire puis `os.link`).
- L'identifiant d'un morceau contient le début du morceau (horloge de l'agent) : un morceau rejoué
  après un redémarrage du serveur retombe sur le même fichier, il est compté comme doublon.
- Un morceau est validé (au moins 30 points, coordonnées présentes, pas de trou de plus d'une
  seconde, progression sans saut). Un refus est compté avec sa raison dans `GET /recorder/status`.
- La trace d'un morceau est allégée **par distance** (un point tous les 5 m), pas par tranche de
  position comme un tour complet, car un morceau ne couvre qu'une partie du tour.
- Le **tour complet valide reste enregistré comme avant** : c'est lui qui sert de carte de référence.
  Ses points se retrouvent donc aussi dans les morceaux (données dupliquées volontairement : les
  morceaux sont du brut sauvegardé, le tour est le résultat validé).
- Le découpage est fait par `PieceCutter`, qui reçoit du `LapAssembler` le signal « un tour vient de
  se fermer » : la règle de passage de ligne n'existe qu'à un seul endroit.
- API : `GET /tracks/{circuit}/pieces` et `/pieces/{id}`. `GET /tracks` donne aussi `piece_count`
  et liste un circuit qui n'a que des morceaux. `SIMRACE_RECORD_PIECES=false` désactive les morceaux.

## Raisons

- Aucune trace roulée n'est perdue : pause, stands, tour de sortie, session interrompue.
- Les morceaux permettront plus tard de reconstituer une carte même sans tour complet propre.

## Conséquences

- Environ 3 à 5 fichiers par tour (trois secteurs plus la ligne), de 8 à 10 Ko chacun.
- Le morceau en cours est **perdu si le serveur s'arrête** avant qu'un déclencheur le ferme.
- Le numéro de secteur d'ACC n'a pas été lu sur un vrai jeu : si `sector` ne change jamais, seuls les
  déclencheurs `size_limit`, `pause`, `pit_entry` et `lap_end` apparaissent dans
  `pieces_by_trigger`, ce qui se voit dans `GET /recorder/status`.
- Rien ne reconstitue encore une carte à partir des morceaux : ils sont sauvegardés et lisibles.
