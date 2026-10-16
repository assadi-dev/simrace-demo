# 0022 Assetto Corsa EVO, deuxième source de l'agent

Statut : Acceptée. Remplace en partie la 0001 (« ne pas utiliser AC EVO tant que sa télémétrie
n'est pas stable »). Date : 2026-10-16. Branche : `test/assetto-corsa-evo`.

## Contexte

La 0001 écartait AC EVO parce que sa mémoire partagée changeait encore. Depuis, Kunos publie un
`SharedFileOut.h` pour EVO, avec un journal des changements : dernier changement le 2026-04-28,
ajout de `car_ids`. La version 0.9.1 du jeu est installée sur le PC de test. Objectif : que l'agent
lise EVO et envoie **les mêmes valeurs qu'avec ACC**, sans changer le contrat ni le serveur.

Mesures du 2026-10-16 sur un vrai jeu (Monza, Porsche 911 GT3 Cup (992), Practice). On a enregistré
les pages brutes à 20 Hz pendant un tour de sortie, un tour compté (2:30,114, invalidé à la
Parabolica) et une entrée aux stands avec ravitaillement.

- EVO publie trois pages : `Local\acevo_pmf_physics`, `Local\acevo_pmf_graphics` et
  `Local\acevo_pmf_static`. Ce sont d'autres noms que ceux d'ACC, et les pages d'ACC n'existent pas.
- La **page physique** a la même structure que celle d'ACC : pédales, vitesse, rapport (même
  codage), tr/min, accG (même ordre), pneus, freins, carburant, répartition de freinage,
  températures air et piste.
- Les **pages graphique et statique** sont différentes : sous-structures de taille fixe, `pack(4)`,
  chaînes en ASCII (`char[N]`) au lieu de l'UTF-16 d'ACC. La voiture, le pilote et la capacité du
  réservoir sont dans la page graphique, pas dans la page statique.
- Écart avec la documentation : 16 octets de booléens suivent `rpm` (offset 40) et non 14. Aucun
  champ lu par l'agent n'est dans cette zone. Tous les offsets utilisés sont après et ont été
  mesurés.

## Décision

- Le jeu se choisit avec `SIMRACE_SOURCE` dans `agent/.env` (`acc` par défaut, ou `acevo`). L'option
  `--source` de `probe`, `run` et `record` le remplace. `run` accepte aussi `replay`. La fenêtre
  (`gui`) suit `SIMRACE_SOURCE`.
- `agent/src/simrace_agent/layout_evo.py` décode EVO. La page physique passe par
  `layout.decode_physics`, commun à ACC et EVO. La source `AcEvoSharedMemorySource` hérite de celle
  d'ACC (`sources/acc.py`) : même boucle, même lecture seule (0007), autres pages.
- Correspondance avec les champs d'ACC (page graphique d'EVO sauf mention contraire) :

| Champ envoyé | AC EVO | Offset | Vérifié le 2026-10-16 |
|---|---|---|---|
| `status` | `status` | 4 | oui (2 roulage, 3 pause) |
| `lap_time_ms` | `current_lap_time_ms` | 188 | oui |
| `track_pos` | `npos` | 1244 | oui (retombe à 0 sur la ligne) |
| `completed_laps` | `total_lap_count` | 2384 | oui (le tour de sortie ne compte pas, comme ACC) |
| `last_lap_ms` | `last_laptime_ms` | 2396 | oui (150114) |
| `best_lap_ms` | `best_laptime_ms` | 2400 | oui en direct (136710, soit 2:16,710) ; 0 tant qu'aucun tour valide |
| `in_pit` | `is_in_pit_lane` ou `is_in_pit_box` | 3120, 3119 | oui |
| `is_valid_lap` | `is_valid_lap` | 3121 | oui |
| `x`, `z` | `car_coordinates` de la voiture `player_car_id` dans `car_ids` | 3124, 24, 3940 | oui |
| `fuel_per_lap_l` | `fuel_liter_per_lap` | 1460 | oui (5,29) |
| `fuel_estimated_laps` | `fuel_estimated_laps` | 3860 | oui |
| `tc_level`, `tc_cut_level`, `abs_level` | `electronics` (int8) | 1872, 1873, 1874 | oui (6, 0, 5) |
| `engine_map` | `electronics.engine_map_level` + 1, `None` si le maximum vaut 0 | 1884, 2140 | voiture sans cartographie seulement |
| `flag` | `flag` traduit en code ACC | 2404 | oui en course : 2 (vert, environ 20 s après l'extinction des feux) et 9 (orange) ; 0 en essais |
| `track_flags` | `global_flag` traduit en nom | 2408 | toujours 0, même en course |
| `pad_life_mm`, `disc_life_mm` | page physique, en **mètres**, multipliés par 1000 | 740, 756 | oui (29 mm et 32 mm) |
| session : circuit | page statique `track` | 136 | oui (`Monza`) |
| session : voiture, pilote, réservoir | `car_model`, `driver_name` et `driver_surname`, `max_fuel` | 3086, 3020, 3053, 3928 | oui |

- Ce qu'EVO ne donne pas :
  - `sector` vaut toujours 0 : EVO ne publie pas de numéro de secteur, donc le serveur ne crée pas
    de morceau « secteur » (0012). Les autres déclencheurs (pause, stands, fin de tour) restent
    actifs.
  - `penalty_code` et `penalty_time_s` valent `None` : EVO n'a pas de code de pénalité.
  - Un drapeau d'EVO sans équivalent ACC (rouge, noir et blanc, bandes rouges et jaunes) donne
    `flag = None`. Le rouge reste visible dans `track_flags`. Aucune valeur n'est inventée.
- `codes.FLAGS` gagne 7 (vert) et 8 (orange), codes d'ACC qui manquaient et qui servent de
  traduction pour EVO.

## Raisons

- Un centre de simulation fait tourner plusieurs jeux. Montrer qu'une nouvelle source se branche
  sans toucher au contrat, au serveur ni au front illustre la séparation `sources/` prévue par la
  0001.
- Recopier les valeurs dans les champs d'ACC, dans les mêmes unités, évite une quatrième variante
  du contrat (agent, serveur, Zod). Le front affiche EVO sans changement.
- Les offsets viennent de la documentation officielle et sont tous mesurés sur un vrai jeu. Ce n'est
  pas le cas de plusieurs champs d'ACC (0013, 0016).

## Conséquences

- Les traces d'EVO n'ont pas de morceau « secteur ». Si le serveur en a besoin un jour, il faudra
  découper par `track_pos`, car aucun champ d'EVO ne donne le secteur.
- Le nom du circuit vient tel qu'EVO l'écrit (`Monza`, pas `monza` comme ACC). Le serveur le passe
  par `Slug`. La configuration (`GP`, offset 169 de la page statique) n'est pas envoyée.
- La structure d'EVO peut encore changer d'une version à l'autre (journal de Kunos). Après une mise
  à jour du jeu, relancer `uv run simrace-agent probe --source acevo` et comparer avec le jeu.
- Quand la session est finie (phase `Ended`, offset 2476), EVO laisse le chrono du tour à 0 alors
  que la voiture roule encore. L'agent envoie ce que donne le jeu.
- En pause (statut 3), EVO remet la page physique à zéro, comme ACC.
- Vérifié en direct avec `probe --source acevo` le 2026-10-16 : physique en roulage, passage de
  ligne, dernier et meilleur tour.
- Restent à voir sur un vrai jeu : un drapeau, une cartographie moteur réglable.

## Complément : phase de la session (2026-10-16)

EVO dit quand la session est finie : `session_state.phase_name` (page graphique, offset 2476,
`char[33]`). Valeurs vues : `Waiting_For_Start`, `Session`, `Ended`. ACC n'a pas d'équivalent.

- Nouveau champ optionnel `session_phase` dans le contrat : agent (`models.py`), serveur
  (`contract.py`, 33 caractères au plus), front (Zod). L'agent envoie le texte du jeu tel quel ;
  `None` avec ACC. La fixture `samples-event.json` est regénérée par un vrai serveur.
- Front : badge « Session : … » dans l'en-tête de l'écran Direct, en avertissement quand la session
  est terminée ; ligne « Session » sur la carte d'un poste ; dans la carte Tours, le dernier tour
  s'affiche « (terminée) » au lieu de « (en cours) » quand la phase vaut `Ended`. Une phase
  inconnue s'affiche telle que le jeu l'écrit, une phase absente s'affiche `n.d.`.
- Utile parce qu'EVO arrête le chrono à la fin de la session alors que la voiture roule encore :
  sans la phase, le front montrait un tour « en cours » bloqué à 0.

## Complément : détection du jeu, nom et version dans la session (2026-10-16)

- `SIMRACE_SOURCE` vaut maintenant `auto` par défaut (remplace le défaut `acc` ci-dessus). L'agent
  cherche les pages d'EVO (`Local\acevo_pmf_physics`) puis celles d'ACC (`Local\acpmf_physics`) :
  une page n'existe que tant que le jeu la tient ouverte, l'agent l'ouvre et la referme à chaque
  lecture. Si le jeu se ferme, la détection recommence : on passe d'un jeu à l'autre sans relancer
  l'agent. `--source acc` ou `acevo` (ou `SIMRACE_SOURCE`) force le jeu, comme avant.
- La session porte `game` (`acc` ou `acevo`) et `game_version`. Le jeu est celui de la source qui
  lit, détectée ou choisie à la main. La version vient de la page statique : `ac_evo_version` (EVO,
  offset 15, `char[15]`, « 0.9.1 » vu le 2026-10-16) ou `acVersion` (ACC, offset 30, `wchar[15]`,
  **jamais lu sur un vrai ACC**).
- Contrat : `SessionInfo.game` est un identifiant court (`^[a-z0-9_-]{1,16}$`, il ne peut pas porter
  de texte arbitraire), `game_version` 15 caractères au plus ; les deux sont optionnels (anciens
  agents et anciens enregistrements : `None`). Front : « AC EVO 0.9.1 » sur la carte d'un poste, dans
  le sous-titre de l'écran Direct et sur la page Live (tuile, vue en grand, plein écran), « Jeu n.d. »
  sans valeur.
- Fenêtre (`gui`, exe) : champ « Jeu » (Automatique, ACC, AC EVO) dans les réglages, gardé dans
  `settings.json` comme les autres champs. Valeur de départ : `SIMRACE_SOURCE` du `.env` posé à côté
  de l'exe, sinon Automatique. Envoyer et Enregistrer lisent le jeu choisi.

## Complément : drapeaux et phases vus en course (2026-10-16)

Course contre l'IA à Monza (session `Race`, type 1 de la page statique), page graphique
enregistrée à 10 Hz pendant 6 minutes (départ, deux tours et demi, sans arrivée).

- `flag` (drapeau montré au pilote) vaut 2 (vert) pendant environ 20 s après l'extinction des
  feux, puis 0. Il a valu 9 (orange, problème mécanique) pendant environ 50 s au deuxième tour. En
  essais libres, il reste à 0. L'agent envoie les codes ACC 7 et 8, et le front les nomme
  « Drapeau vert » et « Drapeau orange (problème mécanique) ». Avant ce complément, le front
  n'avait pas ces deux codes et aurait affiché « Drapeau (code 7) ».
- `global_flag` (drapeau de piste) est resté à 0 toute la course : avec EVO, `track_flags` est
  vide et l'écran Direct ne montre pas de drapeau vert de piste, contrairement à ACC.
- Phases vues au départ, dans l'ordre : `Start_Spawn_On_Position`, `Start_Countdown_No_Lights`,
  `Start_Countdown_Lights_On`, `Start_Countdown_Lights_Off`, puis `Session`. Pendant un
  redémarrage, la phase est vide. Le front les traduit (« Mise en place sur la grille »,
  « Compte à rebours », « Feux allumés », « Feux éteints, départ »).
- Pas encore vus : drapeaux bleu, jaune et damier, phase de fin de course.

