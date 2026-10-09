# 0016 Drapeaux et pénalités

Statut : Acceptée. **Valeurs jamais vues sur un vrai jeu** : aucun drapeau ni aucune pénalité n'a pu
être déclenché pendant les essais du 2026-10-09 (tout lit 0). Date : 2026-10-09.

## Contexte

On veut afficher les drapeaux (jaune, bleu, noir...) et les pénalités avec leur raison. ACC les
donne dans la page graphique, que l'agent lit déjà. La raison de la pénalité est **dans le code**
lui-même (sanction et cause), mais ACC ne dit pas quel virage a été coupé, ni dans quel secteur le
drapeau jaune est déployé : seulement qu'il est affiché pour le pilote.

## Décision

| Champ | Source ACC (page graphique) | Offset | Contenu |
|---|---|---|---|
| `flag` | `flag` | 1224 | 0 aucun, 1 bleu, 2 jaune, 3 noir, 4 blanc, 5 damier, 6 pénalité |
| `penalty_code` | `penalty` | 1228 | code sanction + cause (table dans `agent/src/simrace_agent/codes.py`) |
| `penalty_time_s` | `penaltyTime` | 1220 | secondes de pénalité en cours |

- Les offsets sont **déduits par le comptage des octets** de la structure : 12 champs de 4 octets
  séparent `playerCarID` (1216) de `TC` (1268), et `TC`, `ABS` et `fuelXLap` sont vérifiés sur un vrai
  ACC (décision 0014). L'ordre interne (`flag` avant `penalty`) vient de la documentation, pas d'une
  mesure.
- L'agent envoie les **codes bruts**. Les noms lisibles (`codes.py`) servent à `probe` et seront repris
  par le front. Un code inconnu est affiché tel quel (`inconnu (42)`), jamais perdu.
- Le serveur borne : `flag` 0..20, `penalty_code` 0..99, `penalty_time_s` 0..3600. Un code inconnu mais
  dans les bornes est accepté.
- Pour valider : lancer `probe` pendant une vraie pénalité (coupure de piste répétée, vitesse excessive
  dans la voie des stands) ou un drapeau jaune en course, puis corriger `codes.py` si les codes lus
  ne correspondent pas.

## Conséquences

- Les anciens enregistrements restent rejouables (champs absents, donc `None`).
- Tant que la table n'est pas vérifiée, le front doit afficher « pénalité (code N) » plutôt que
  d'affirmer une raison, si le code est absent de la table.

## Complément : drapeaux globaux, validité du tour et réglages (2026-10-09)

Un dashboard SimHub montre les drapeaux jaunes par secteur et le drapeau vert. Ils ne viennent pas de
`flag` (drapeau personnel du pilote : bleu, noir, damier) mais des **drapeaux globaux** de la page
graphique. Lus sur un vrai ACC, le jeu en piste affiche `green`, comme le dashboard.

| Champ | Offset | Contenu | Vérifié |
|---|---|---|---|
| `track_flags` | 1500 à 1528 | liste des drapeaux actifs : `yellow`, `yellow_s1`, `yellow_s2`, `yellow_s3`, `white`, `green`, `chequered`, `red` | `green` oui, **jaune secteur 3 oui** (`yellow` + `yellow_s3`, le dashboard SimHub affichait jaune 3 au même moment) |
| `is_valid_lap` | 1408 | validité du tour en cours | lu (False sur un tour de sortie), pas comparé à un tour valide |
| `fuel_estimated_laps` | 1412 | tours de carburant restants selon ACC | oui : 20,0 = 62 L / 3,1 L par tour |
| `tc_cut_level` | 1272 | réglage TC cut | oui : 6, comme SimHub |
| `engine_map` | 1276 | carte moteur, **valeur ACC + 1** | oui : 8, comme SimHub |
| `brake_bias` | 564 (physique) | répartition de freinage, valeur brute | **non** : lit 0,75 alors que SimHub affiche 54,0 |

- Un jaune par secteur dit seulement qu'un drapeau est déployé dans ce secteur, pas pourquoi.
- `brake_bias` ne correspond pas encore au « BB » de SimHub (0,75 contre 54,0). Ne pas l'afficher
  avant d'avoir trouvé le bon champ ou la bonne conversion.
- `is_valid_lap` règle l'étape 2 de la passation (lecture de la validité). Le serveur ne s'en sert pas
  encore pour refuser un tour.

## Complément : météo (2026-10-09)

| Champ | Source ACC | Offset | Vérifié |
|---|---|---|---|
| `air_temp_c` | physique `airTemp` | 288 | oui : 27,1 °C, SimHub affiche 27° |
| `road_temp_c` | physique `roadTemp` | 292 | oui : 27,9 °C, SimHub affiche 28° |

- Une température à 0 est traitée comme « pas de donnée » (`None`), car la page physique vaut 0 en
  pause.
- Le vent (`windSpeed`, `windDirection`, graphique 1248 et 1252) est **abandonné** : il lisait toujours
  0,0 et la météo utile se limite aux deux températures. Il n'est ni dans le contrat ni dans l'agent.
