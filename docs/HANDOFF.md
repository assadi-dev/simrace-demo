# Passation (handoff)

Dernière mise à jour : 2026-10-09. Le projet a été créé sur macOS ; le développement continue sur
le PC Windows qui a Assetto Corsa Competizione.

## État

| Brique | État | Vérifié comment |
|---|---|---|
| `server/` ingestion, doublons, trous, rejets, `/stations`, `/stream` | fait, postes **en mémoire**, architecture `features/` + `shared/` en POO (décision 0010) | 218 tests pytest + essai de bout en bout avec un vrai `uvicorn` |
| `server/` enregistrement des tracés (`/tracks`, `/recorder/status`) | fait : un fichier JSON par tour valide, et **un par morceau** (secteur franchi, pause, stands, fin de tour) dans `server/data/` (décisions 0011 et 0012). 5 vrais tours déjà enregistrés | tests + essai avec ta session réelle : le tour de sortie des stands est conservé en morceau (4783 m) |
| `agent/` lecture de `x`, `z` (`carCoordinates`, `playerCarID`) | fait, **vérifié avec `probe` sur un tour réel** (937 échantillons, aucun saut, distance mesurée / attendue = 1,01) | 45 tests agent + rejeu de la session réelle vers un vrai serveur |
| `agent/` lecture des pneus et freins (pression, température du pneu, température des freins, usure plaquettes et disques) | fait, **lus sur un vrai ACC à l'arrêt, valeurs plausibles (décision 0013) ; à revoir en roulant (freins qui chauffent) | 5 tests de décodage avec tampons synthétiques ; lancer `probe` et comparer avec l'overlay |
| `agent/` carburant (L), consommation par tour, capacité du réservoir, réglages TC et ABS | fait, **vérifiés sur un vrai ACC** : carburant restant 62,0 L identique à l'overlay (décision 0014) | 4 tests de décodage + essai `probe` sur les pages réelles : réservoir 120 L, 3,0 L/tour, TC 7, ABS 4 |
| `agent/` forces G (`accG`: latérale, verticale, longitudinale) | fait, **vérifié sur un vrai ACC** (freinage -1,45 G, accélération +0,9 G) ; signe latéral non vérifié (décision 0015) | 3 tests de décodage + lecture directe de la page physique en roulant |
| `agent/` drapeaux, code et temps de pénalité (`flag`, `penalty`, `penaltyTime`) | fait, **lus à 0 seulement** : aucun drapeau ni pénalité vus sur un vrai jeu ; offsets déduits de la structure (décision 0016) | 3 tests de décodage + `codes.py` testé ; valider avec `probe` pendant une vraie pénalité |
| `agent/` drapeaux globaux (`track_flags`), validité du tour, tours de carburant, TC cut, carte moteur, répartition de freinage | fait, **vérifiés sauf `brake_bias`** (0,75 lu, SimHub affiche 54,0) ; jaune secteur 3 confirmé par SimHub (décision 0016) | 6 tests de décodage + `probe` comparé au dashboard SimHub |
| `agent/` météo (`air_temp_c`, `road_temp_c`, `wind_speed`, `wind_direction`) | fait, températures **vérifiées** (27,1 et 27,9 °C, comme SimHub) ; vent lu à 0,0 seulement, non vérifié (décision 0016) | 2 tests de décodage + `probe` comparé au dashboard |
| Tour complet enregistré depuis un vrai ACC | **à faire** : la session de test n'avait qu'un tour de sortie (refusé `started_mid_lap`, comme prévu) | rouler 2 tours propres après le tour de sortie, voir `GET /recorder/status` |
| `agent/` décodage des pages ACC (`layout.py`) | fait | 4 tests avec tampons synthétiques seulement |
| `agent/` lecture réelle d'ACC (`sources/acc.py`) | écrit, **jamais lancé** | non vérifié, Windows requis |
| `agent/` enregistrement et rejeu | fait | test aller-retour + essai de bout en bout |
| `agent/` envoi par lots avec reprise (`sender.py`) | fait | essai de bout en bout, serveur coupé non testé |
| PostgreSQL / SQLAlchemy / Alembic | à faire | `docker-compose.yml` fournit la base |
| `web/` React | à faire | |
| CI GitHub Actions, Playwright | à faire | |

## Mise en route sur Windows

Le dossier a été créé sur macOS. **Ne copie pas les dossiers `.venv`** (non portables) ; `uv sync`
les recrée. Il n'y a pas de dépôt git pour l'instant : transfert par copie du dossier (sans
`.venv`) ou en créant un dépôt.

1. Installer uv (`winget install astral-sh.uv`) et, si besoin, Docker Desktop.
2. `cd agent` puis `uv sync`, `uv run pytest` (45 tests doivent passer).
3. `cd ..\server` puis `uv sync`, `uv run pytest` (218 tests doivent passer).
4. Lancer ACC, entrer en session (essais libres), rouler.
5. `cd ..\agent` puis `uv run simrace-agent probe`.

## Étape 1, bloquante : vérifier la lecture d'ACC

Objectif : confirmer que `probe` affiche des valeurs cohérentes avec le jeu.

- Si `probe` répond « introuvable : ACC est-il lancé et en session ? », ACC n'est pas en session
  (les pages n'existent pas dans les menus) ou le jeu et l'agent n'ont pas les mêmes droits
  (administrateur ou non). Lance les deux de la même façon.
- Attendu : vitesse, gaz, frein, rapport, tr/min qui suivent la conduite ; `tour`, temps du tour
  et `pos` (0 à 1 le long du circuit) qui avancent ; statut 2 en conduite (0 off, 1 replay,
  2 live, 3 pause) ; le circuit, la voiture et le nom du pilote affichés au début.
- Si une valeur est fausse, corriger les offsets dans `agent/src/simrace_agent/layout.py`
  (physique : début de page ; graphique : `_LAPS_OFFSET` = 132 et `_TRACK_POS_OFFSET` = 248 ;
  statique : 68 voiture, 134 circuit, 200 prénom, 266 nom). Références : `SharedFileOut.h`
  fourni avec ACC, le dépôt Python `pyacc` (gotzl), le fil du forum officiel. Mettre à jour
  `agent/tests/test_layout.py` avec les nouveaux offsets.
- Rappels sur les données d'ACC : le rapport brut vaut 0 pour la marche arrière, 1 pour le point
  mort, 2 pour la première (l'agent soustrait 1) ; les temps de tour valent 2147483647 quand
  aucun tour n'est enregistré (l'agent les met à 0).
- Ensuite : `uv run simrace-agent record --out ..\recordings\essais.jsonl` pendant 2 ou 3 tours
  propres, un tour invalide (sortie de piste), un passage aux stands. Ces fichiers servent de
  jeu de test et de démo sans le jeu. `recordings/` est ignoré par git.

## Prochaines étapes (ordre conseillé)

0. **Fait le 2026-10-09** : lecture d'ACC vérifiée avec `probe` (physique, graphique, statique :
   vitesse, pédales, rapport, tr/min, tour, temps, `pos`, statut, circuit, voiture). Reste non
   vérifié : temps du dernier et du meilleur tour, passage aux stands.
1. **Enregistrer un vrai tracé** : `x` et `z` sont vérifiés (voir l'état ci-dessus). Serveur lancé,
   `uv run simrace-agent run --server http://localhost:8000`, sortir des stands, puis rouler
   **2 tours propres sans quitter la piste** (le tour de sortie est refusé, c'est voulu) et
   regarder `GET /recorder/status` (`laps_saved`, et les raisons de refus), puis `GET /tracks`.
   Si un tour propre est refusé, la raison est comptée : `data_gap` (lots perdus),
   `position_jump`, `pit_involved`, etc. (`tracks/strategy.py`).
2. Lire la validité du tour (champ `isValidLap` de la page graphique d'ACC, offset à trouver dans
   `SharedFileOut.h`), l'ajouter à `Sample` côté agent **et** côté serveur.
3. Persistance PostgreSQL (SQLAlchemy 2 async + Alembic) :
   - tables `sessions`, `laps`, `samples` (échantillons réduits, voir décision 0008) ;
   - détection d'un tour terminé par changement de `completed_laps` ;
   - écritures idempotentes, clé unique `(station_id, run_id, seq)` ;
   - le dernier `seq` par poste doit survivre à un redémarrage du serveur (aujourd'hui il est en
     mémoire : après un redémarrage, le premier lot reçu est pris en compte et le trou compté à
     tort comme manquant).
4. Front `web/` (React + TypeScript, `EventSource` sur `/stream`) : courbes vitesse/frein/gaz
   (uPlot conseillé), temps au tour et meilleur tour, trace de piste dessinée avec `track_pos` ou
   les coordonnées, état des postes depuis `/stations`.
5. Tests : pytest d'intégration avec PostgreSQL, Playwright sur le front, GitHub Actions.
6. Durcissement : clé d'API par poste sur `/ingest/batches`, configuration par variables
   d'environnement, reprise `Last-Event-ID` côté SSE (les `id` sont déjà émis, pas de tampon).
7. Optionnel : `docker-compose` complet (serveur + base + front), puis un adaptateur pour un
   deuxième jeu (voir la décision 0001 pour les contraintes).

## Limites connues

- Les postes (`InMemoryStationRepository`) et le hub SSE sont en mémoire. Les tracés sont des
  fichiers (`server/data/tracks/<circuit>/<poste>-<run>-lap<N>.json`, ignorés par git) ; lister
  les tours relit les fichiers.
- Le morceau de trace en cours est perdu si le serveur s'arrête avant qu'un déclencheur le ferme.
- **À corriger** : le numéro d'un tour dans son nom de fichier est son rang depuis le début du run.
  Si le serveur redémarre pendant que l'agent continue (même `run_id`), le rang repart de 0 : les
  nouveaux tours portent le nom de tours déjà écrits et sont comptés comme doublons (donc perdus,
  mais visibles dans `duplicate_laps`). Les morceaux ne sont pas concernés (nom basé sur l'horloge de
  l'agent). Correctif possible : nommer aussi les tours avec leur heure de début.
- **`brake_bias` non vérifié** : le champ lu (physique, offset 564) vaut 0,75 alors que SimHub affiche 54,0 pour la répartition de freinage (BB). Ne pas l'afficher tant que le bon champ ou la bonne conversion n'est pas trouvé (décision 0016). Piste : changer le cran dans le jeu et comparer.
- Le champ `sector` d'ACC n'a pas été lu sur un vrai jeu : `GET /recorder/status` montre si le
  déclencheur « secteur » (`pieces_by_trigger.sector`) se produit réellement.
- Rejouer un enregistrement avec un nouveau `run_id` crée de nouveaux fichiers de tours.
  `SIMRACE_RECORD_TRACKS=false` désactive l'enregistrement.
- La validité du tour d'ACC n'est pas lue : un tour avec sortie de piste mais sans arrêt ni trou
  peut être enregistré.
- Le hub SSE jette les événements les plus anciens d'un abonné trop lent (file de 1000).
- L'agent perd les plus anciens lots si la file dépasse 500 lots (serveur injoignable trop
  longtemps) ; le compteur `dropped` est affiché à l'arrêt.
- `fastapi.testclient` affiche un avertissement de dépréciation (httpx / starlette) sans gravité.
- Aucune authentification sur l'API pour l'instant.
- Le projet a été testé sur macOS (Python 3.12 pour le serveur). La portabilité sur Windows des
  tests est attendue mais n'a pas été vérifiée.

## Comment un agent IA doit travailler ici

- Lis `CLAUDE.md`, ce fichier, puis les décisions avant de coder.
- Fais les changements par petites étapes, avec un test par changement de comportement.
- Quand tu prends une décision structurante, ajoute un fichier dans `docs/decisions/` et une ligne
  dans son index. Mets à jour ce fichier (état, prochaines étapes, limites) en fin de session.
- Dis clairement ce qui a été vérifié et ce qui ne l'a pas été. L'utilisateur relit tout : la fiche
  de poste exige une revue humaine systématique du code produit par des agents.
