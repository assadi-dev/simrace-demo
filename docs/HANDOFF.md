# Passation (handoff)

Dernière mise à jour : 2026-10-15. Le projet a été créé sur macOS ; le développement continue sur
le PC Windows qui a Assetto Corsa Competizione. Dépôt : `github.com/assadi-dev/simrace-demo`.
Le travail récent est sur la branche `feat/live-preview` (57 commits d'avance sur `main`, pas encore
fusionnée).

## AC EVO (2026-10-16, branche `test/assetto-corsa-evo`)

L'agent lit aussi Assetto Corsa EVO. Par défaut (`SIMRACE_SOURCE=auto`), il détecte le jeu lancé
et envoie son nom et sa version dans la session ; `--source acc` ou `acevo` force le jeu. Décodage dans `layout_evo.py`, offsets mesurés
sur EVO 0.9.1 (un tour et une entrée aux stands à Monza). EVO ne donne ni secteur ni code de
pénalité. Voir la [décision 0022](decisions/0022-assetto-corsa-evo-deuxieme-source.md).
`probe --source acevo` vérifié en direct : physique en roulage, passage de ligne, dernier et
meilleur tour, drapeaux vert et orange en course. Pas encore vus : drapeaux bleu, jaune et damier,
cartographie moteur.

Place en course et adversaires (`race_position`, `opponents`, 0 si seul en piste) : KPI de l'écran
Direct et lignes de la carte d'un poste. Mesurés sur la course EVO enregistrée ; offsets d'ACC
(136, 252) **jamais lus en vrai**. Voir la [décision 0023](decisions/0023-place-en-course-et-adversaires.md).

## Changements depuis le 2026-10-11

| Domaine | Changement | Décision |
|---|---|---|
| Écran Direct | Courbes uPlot, vraie carte du circuit avec trace hors piste, tours valides sur tout le tour, drapeaux et pénalités, carte Vitesse au-dessus des courbes, jauge plafonnée à 280 km/h | 0018 |
| Écran Direct et Live | Température des 4 pneus à la place de la distance et de la vitesse moyenne (composant `TyreTemps`) | 0021 |
| Écran Postes | Meilleur tour d'ACC et températures sur la carte d'un poste ; tri par numéro (`sim-2` avant `sim-10`) | |
| Écran Intégrité | Retiré (squelette vide) ; les compteurs restent sur les cartes Postes | |
| Live vidéo | Mosaïque de 1 à 4 colonnes avec première image de chaque flux, vue en grand avec la télémétrie, plein écran (vrai plein écran sur téléphone), son et volume, choix WebRTC ou HLS dans l'URL | 0019 |
| Vidéo en https | Adresses MediaMTX complètes par protocole (`VITE_MEDIA_WEBRTC_URL`, `VITE_MEDIA_HLS_URL`) | 0020 |
| Mobile et PWA | Menu latéral sur téléphone, en-tête adapté, interface réduite de 25 % par un seul token, manifest et icônes (application installable) | |
| Déploiement | `server/Procfile`, `server/.python-version` (3.12), Node 22 pour le front, origine du front de prod autorisée en CORS | |
| Outils | `docker-compose` avec MediaMTX, `tools/video-viewer.html` (page de test WebRTC), images de fond OBS dans `docs/obs/`, configurations VS Code | |
| Documentation | `README.md` réécrit (écrans, fiabilité, état, tests, déploiement) | |

## État

| Brique | État | Vérifié comment |
|---|---|---|
| `server/` ingestion, doublons, trous, rejets, `/stations`, `/stream` | fait, postes **en mémoire**, architecture `features/` + `shared/` en POO (décision 0010) | 218 tests pytest + essai de bout en bout avec un vrai `uvicorn` |
| `server/` enregistrement des tracés (`/tracks`, `/recorder/status`) | fait : un fichier JSON par tour valide, et **un par morceau** (secteur franchi, pause, stands, fin de tour) dans `server/data/` (décisions 0011 et 0012). 5 vrais tours déjà enregistrés | tests + essai avec ta session réelle : le tour de sortie des stands est conservé en morceau (4783 m) |
| `agent/` lecture de `x`, `z` (`carCoordinates`, `playerCarID`) | fait, **vérifié avec `probe` sur un tour réel** (937 échantillons, aucun saut, distance mesurée / attendue = 1,01) | 48 tests agent + rejeu de la session réelle vers un vrai serveur |
| `agent/` lecture des pneus et freins (pression, température du pneu, température des freins, usure plaquettes et disques) | fait, **lus sur un vrai ACC à l'arrêt, valeurs plausibles (décision 0013) ; à revoir en roulant (freins qui chauffent) | 5 tests de décodage avec tampons synthétiques ; lancer `probe` et comparer avec l'overlay |
| `agent/` carburant (L), consommation par tour, capacité du réservoir, réglages TC et ABS | fait, **vérifiés sur un vrai ACC** : carburant restant 62,0 L identique à l'overlay (décision 0014) | 4 tests de décodage + essai `probe` sur les pages réelles : réservoir 120 L, 3,0 L/tour, TC 7, ABS 4 |
| `agent/` forces G (`accG`: latérale, verticale, longitudinale) | fait, **vérifié sur un vrai ACC** (freinage -1,45 G, accélération +0,9 G) ; signe latéral non vérifié (décision 0015) | 3 tests de décodage + lecture directe de la page physique en roulant |
| `agent/` drapeaux, code et temps de pénalité (`flag`, `penalty`, `penaltyTime`) | fait, **lus à 0 seulement** : aucun drapeau ni pénalité vus sur un vrai jeu ; offsets déduits de la structure (décision 0016) | 3 tests de décodage + `codes.py` testé ; valider avec `probe` pendant une vraie pénalité |
| `agent/` drapeaux globaux (`track_flags`), validité du tour, tours de carburant, TC cut, carte moteur, répartition de freinage | fait, **vérifiés sauf `brake_bias`** (0,75 lu, SimHub affiche 54,0) ; jaune secteur 3 confirmé par SimHub (décision 0016) | 6 tests de décodage + `probe` comparé au dashboard SimHub |
| `agent/` météo (`air_temp_c`, `road_temp_c`) | fait, **vérifiée** (27,1 et 27,9 °C, comme SimHub) ; le vent est abandonné (décision 0016) | 2 tests de décodage + `probe` comparé au dashboard |
| Tour complet enregistré depuis un vrai ACC | **à faire** : la session de test n'avait qu'un tour de sortie (refusé `started_mid_lap`, comme prévu) | rouler 2 tours propres après le tour de sortie, voir `GET /recorder/status` |
| `agent/` décodage des pages ACC (`layout.py`) | fait | 4 tests avec tampons synthétiques seulement |
| `agent/` lecture réelle d'ACC (`sources/acc.py`) | écrit, **jamais lancé** | non vérifié, Windows requis |
| `agent/` enregistrement et rejeu | fait | test aller-retour + essai de bout en bout |
| `agent/` envoi par lots avec reprise (`sender.py`) | fait | essai de bout en bout, serveur coupé non testé |
| PostgreSQL / SQLAlchemy / Alembic | à faire | `docker-compose.yml` fournit la base |
| `web/` front React | fait : Vite, shadcn/ui (thème Flame & Sand), TanStack Router, Table et Query, Zod, Zustand, nuqs (décision 0017). Écran **Postes** conforme à la maquette (KPI, cartes avec valeurs en direct, meilleur tour, températures, intégrité ; tri en ligne d'abord), **Leaderboard** (tableau TanStack Table, `?circuit=` dans l'URL) en version minimale ; **Direct** fait (KPI, courbes uPlot, jauge, températures des pneus, vraie carte avec trace hors piste, tours valides, drapeaux et pénalités, décisions 0018 et 0021) ; **Live** vidéo fait (mosaïque, vue en grand, plein écran, décisions 0019 et 0020) ; navigation mobile et PWA ; **Intégrité** retiré (squelette vide, compteurs sur les cartes Postes) | 123 tests Vitest, 30 tests Playwright contre un vrai serveur (desktop et téléphone 390 px), tous passés le 2026-10-15. **Vérifié avec des lots de test envoyés au serveur, pas avec le flux d'un vrai ACC** |
| Playwright (front) | fait : `web/e2e/` lance `uvicorn` et Vite, envoie de vrais lots comme l'agent | `npm run test:e2e` depuis `web/` |
| Vidéo des postes (OBS, MediaMTX) | fait : OBS publie vers MediaMTX (`live/<station-id>`), le front lit en WebRTC ou HLS ; aucune authentification | `tools/video-viewer.html`, tests Playwright de la page Live (sans vrai flux vidéo) |
| Déploiement | `server/Procfile`, Python 3.12, Node 22, origine du front de prod dans `cors_origins` | non vérifié dans cette session |
| CI GitHub Actions | à faire | |

## Mise en route sur Windows

Le dossier a été créé sur macOS. **Ne copie pas les dossiers `.venv`** (non portables) ; `uv sync`
les recrée. Récupérer le projet avec `git clone https://github.com/assadi-dev/simrace-demo.git`.

1. Installer uv (`winget install astral-sh.uv`) et, si besoin, Docker Desktop.
2. `cd agent` puis `uv sync`, `uv run pytest` (48 tests doivent passer).
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
4. Front `web/` : Postes, Direct, Leaderboard et Live faits (voir l'état ci-dessus). Fusionner
   `feat/live-preview` dans `main`. À vérifier avec un vrai ACC : le
   seuil hors piste de 12 m et l'orientation de la carte sur d'autres circuits (décision 0018).
   L'écran **Intégrité** (squelette vide) a été retiré pour la démo : les compteurs d'intégrité
   restent visibles sur les cartes de l'écran Postes. Voir [docs/FRONT.md](FRONT.md).
5. Tests : pytest d'intégration avec PostgreSQL, GitHub Actions (serveur, agent, `web/` : build,
   Vitest, Playwright avec `npx playwright install chromium`).
6. Durcissement : clé d'API par poste sur `/ingest/batches`, configuration par variables
   d'environnement, reprise `Last-Event-ID` côté SSE (les `id` sont déjà émis, pas de tampon).
7. Boîte d'envoi durable côté agent, **après** l'étape 3 : remplacer la file en mémoire de
   `BatchSender` (500 lots, environ 100 s de coupure) par une table SQLite locale (`sqlite3` de
   la bibliothèque standard, pas de dépendance sur le PC de jeu). Le lot est écrit avant l'envoi
   et supprimé à l'accusé du serveur ; au démarrage, l'agent renvoie ce qui reste. Écrire d'abord
   la décision 0021. Avant PostgreSQL, ça n'apporte presque rien : le serveur oublie le dernier
   `seq` en redémarrant. Pour la démo, la file en mémoire suffit : la perte est comptée
   (`dropped` côté agent, `gaps` côté serveur), jamais silencieuse.
8. Optionnel : `docker-compose` complet (serveur + base + front), puis un adaptateur pour un
   deuxième jeu (voir la décision 0001 pour les contraintes).
9. Vidéo des postes : la lecture est faite (OBS, MediaMTX, page Live). Reste : la valider avec
   un vrai flux OBS pendant une session ACC, puis l'autorisation de publication et de lecture
   par FastAPI (liens à durée limitée, voir `0019-apercu-video-en-direct-des-postes.md`).

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
  longtemps) ; le compteur `dropped` est affiché à l'arrêt. La file ne survit pas à un
  redémarrage de l'agent. Correctif prévu : boîte d'envoi SQLite (prochaines étapes, point 7).
- `fastapi.testclient` affiche un avertissement de dépréciation (httpx / starlette) sans gravité.
- Aucune authentification sur l'API pour l'instant, ni sur MediaMTX (n'importe qui sur le réseau
  peut publier ou lire un flux).
- **Deux décisions portent le numéro 0019** : `0019-apercu-video-en-direct-des-postes.md` (WHIP,
  autorisation par FastAPI) et `0019-capture-ecran-obs-mediamtx.md` (RTMP ou SRT, sans
  authentification, seule listée dans l'index). Le code suit la seconde. À trancher : renuméroter
  la première ou la marquer remplacée.
- Validité des tours : sur un vrai jeu, des tours coupés sortaient valides avec la lecture de
  `is_valid_lap` au dernier échantillon. Le front retient l'invalidité sur tout le tour et
  contrôle avec le meilleur temps d'ACC (décision 0018, complément). À vérifier avec `probe` :
  le moment où `is_valid_lap` passe à faux puis revient à vrai, et que `best_lap_ms` ignore les
  tours invalides.
- Front, écran Direct : tours, drapeaux et trace du tour sont déduits du flux **depuis
  l'ouverture de la page** (le flux ne rejoue pas le passé). Un nouveau `run_id` ne vide pas
  l'historique (le flux ne le transmet pas), seul un `completed_laps` qui recule le fait.
- Front : les tests Playwright lancent le serveur avec `SIMRACE_DATA_DIR` dans le dossier
  temporaire du système, pour ne jamais écrire de faux tours dans `server/data`.
- Le cache npm de la machine de développement (macOS) contient des fichiers appartenant à root
  (`npm install` échoue en EACCES). Contournement utilisé : `npm_config_cache=<dossier temporaire>`.
  Correctif proposé par npm : `sudo chown -R 501:20 ~/.npm`.
- Le projet a été testé sur macOS (Python 3.12 pour le serveur). La portabilité sur Windows des
  tests est attendue mais n'a pas été vérifiée.

## Comment un agent IA doit travailler ici

- Lis `CLAUDE.md`, ce fichier, puis les décisions avant de coder.
- Fais les changements par petites étapes, avec un test par changement de comportement.
- Quand tu prends une décision structurante, ajoute un fichier dans `docs/decisions/` et une ligne
  dans son index. Mets à jour ce fichier (état, prochaines étapes, limites) en fin de session.
- Dis clairement ce qui a été vérifié et ce qui ne l'a pas été. L'utilisateur relit tout : la fiche
  de poste exige une revue humaine systématique du code produit par des agents.
