# simrace-demo

Démo d'une plateforme de télémétrie Sim Racing, branchée sur un vrai jeu : Assetto Corsa
Competizione (ACC). Un **agent** installé sur le PC de jeu lit la mémoire partagée d'ACC et envoie
la télémétrie par lots numérotés à un **serveur** FastAPI. Le serveur valide chaque échantillon,
compte les doublons, les trous et les rejets, puis diffuse en direct (SSE) à une **interface
React** : état des postes, courbes, carte du circuit, tours valides, drapeaux et vidéo des postes.

```
PC de jeu (Windows)                         Serveur                              Navigateur
ACC -> mémoire partagée (lecture seule)     FastAPI
  -> agent Python --POST /ingest/batches--> validation, doublons, trous
       (lots numérotés, accusés,              |- GET /stations   (santé des postes)
        renvoi après coupure)                 |- GET /tracks/... (tracés enregistrés)
                                              '- GET /stream     (SSE) ----------> React (web/)
OBS --RTMP/SRT--> MediaMTX (Docker) --WebRTC / HLS--------------------------------> page Live
```

> Agents IA et reprise du projet : lire [CLAUDE.md](CLAUDE.md), [docs/HANDOFF.md](docs/HANDOFF.md)
> et [docs/decisions/](docs/decisions/README.md).

## Ce que montre la démo

| Écran | Pour qui | Contenu |
|---|---|---|
| **Postes** (`/`) | Opérateur du centre | KPI, une carte par poste : en ligne ou non, pilote, circuit, valeurs en direct, meilleur tour d'ACC, températures, compteurs d'intégrité (rejets, doublons, trous) |
| **Direct** (`/stations/:id`) | Pilote, coach | Courbes vitesse, accélérateur et frein (fenêtre 10, 30 ou 60 s, figeable), jauge, rapport, température des 4 pneus, vraie carte du circuit avec la trace du tour (autre couleur hors piste), tours valides, drapeaux et pénalités |
| **Leaderboard** (`/leaderboard`) | Pilotes, centre | Classement par circuit (`?circuit=` dans l'URL), temps en direct, tri |
| **Live** (`/live`) | Opérateur, spectateurs | Mosaïque vidéo des postes (1 à 4 colonnes), vue en grand avec la télémétrie, plein écran (aussi sur téléphone) |

L'interface fonctionne sur téléphone (menu latéral, mise en page adaptée) et s'installe comme
une application (PWA). Une valeur que l'API ne fournit pas s'affiche `n.d.`, jamais inventée.

## Fiabilité des données

C'est le parti pris du projet : aucune donnée ne disparaît en silence.

- **Lots numérotés** : chaque lot porte un `seq` dans un `run_id` (un nouveau `run_id` = l'agent a
  redémarré, `seq` repart de 1). Le serveur accuse chaque lot.
- **Doublon** : un lot déjà reçu est accusé `duplicate` sans être recompté. L'agent peut renvoyer
  sans risque.
- **Trou** : un saut de `seq` est compté (`gaps`).
- **Rejet par échantillon** : une valeur hors bornes (vitesse > 500 km/h, position hors de 0 à 1...)
  est rejetée et comptée avec sa raison (`reject_reasons`), sans faire tomber le reste du lot.
- **Reprise** : sans accusé, l'agent garde le lot en file et le renvoie. Au-delà de 500 lots en
  attente, les plus anciens sont jetés et comptés (`dropped`).
- **Tours** : un tour n'est enregistré que s'il est complet, sinon il est refusé avec sa raison
  (`started_mid_lap`, `data_gap`, `position_jump`, `pit_involved`), visible dans
  `GET /recorder/status`. Un tour coupé est invalide sur tout le tour, pas seulement au dernier
  échantillon.
- **Le serveur ne fait pas confiance à l'agent** : bornes dans `server/app/shared/contract.py`, et un
  nom venu de l'agent ne devient jamais un chemin de fichier sans passer par `Slug`.

## État

| Brique | État |
|---|---|
| `agent/` lecture d'ACC, enregistrement et rejeu, envoi par lots | Fait. **Vérifié sur un vrai ACC** : vitesse, pédales, rapport, tr/min, tours, position sur la piste (`x`, `z`), carburant, TC et ABS, forces G, météo. Non vu en vrai : passage aux stands, drapeaux et pénalités, `brake_bias` |
| `server/` ingestion, intégrité, `/stations`, `/stream` (SSE), tracés (`/tracks`) | Fait. Postes **en mémoire**, tracés (tours et morceaux) en fichiers JSON |
| `web/` Postes, Direct, Leaderboard, Live vidéo, mobile, PWA | Fait. Vérifié avec des lots envoyés au serveur (tests Playwright), pas encore avec le flux d'un vrai ACC |
| Vidéo des postes (OBS, MediaMTX) | Fait : WebRTC (faible latence) et HLS (repli), adresses https configurables (décisions 0019 et 0020) |
| PostgreSQL, SQLAlchemy, Alembic | **À faire** : conçu (décision 0008), `dependencies/docker-compose.yml` fournit la base |
| CI GitHub Actions | **À faire** |
| Authentification | **À faire** (clé d'API par poste prévue) |

## Tests

| Projet | Outil | Nombre | Commande |
|---|---|---|---|
| `server/` | pytest | 218 | `uv run pytest` |
| `agent/` | pytest | 66 | `uv run pytest` |
| `web/` | Vitest (contrats, store, fonctions pures) | 123 | `npm test` |
| `web/` | Playwright (vrai serveur, vrais lots, desktop et téléphone) | 30 | `npm run test:e2e` |

Tous passent au 2026-10-15 (macOS). Le décodage de la mémoire d'ACC (`layout.py`) est testé avec
des tampons synthétiques ; la lecture réelle ne se vérifie que sur Windows avec ACC
(`uv run simrace-agent probe`).

## Lancer l'ensemble

```bash
# dépendances (PostgreSQL, relais vidéo MediaMTX), depuis la racine
docker compose -f ./dependencies/docker-compose.yml up -d
docker compose -f ./dependencies/docker-compose.yml down    # pour arrêter

# serveur (http://localhost:8000)
cd server && uv sync && uv run uvicorn app.main:app --reload

# front (http://localhost:5173), configuration dans web/.env.local (voir web/.env.example)
cd web && npm install && npm run dev

# agent (sur le PC de jeu, ou ici avec un rejeu)
cd agent && uv sync && mkdir -p ../recordings
uv run simrace-agent probe                                      # vérifie la lecture d'ACC
uv run simrace-agent record --out ../recordings/session.jsonl   # roule dans ACC, Ctrl+C pour finir
uv run simrace-agent run --server http://<ip-serveur>:8000      # temps réel depuis ACC
uv run simrace-agent run --source replay --file ../recordings/session.jsonl --station-id sim-1
uv run simrace-agent gui     # fenêtre : envoyer, enregistrer, rejouer une session, tout arrêter
```

Sur le PC de jeu, `agent\build_exe.ps1` construit `agent\dist\simrace-agent.exe` : la même fenêtre,
sans installer Python ni uv. Les champs saisis (serveur, poste, dossier des replays) sont gardés
dans `%LOCALAPPDATA%\simrace-agent\settings.json`.

Sur un Mac, `agent/build_app.sh` construit `agent/dist/simrace-agent.app`, la même fenêtre (PyInstaller
ne construit que pour le système sur lequel il tourne). ACC n'existe pas sous macOS : les boutons
d'envoi et d'enregistrement sont masqués, seul le rejeu d'une session reste. Les réglages vont dans `~/.simrace-agent/settings.json`, les
replays et le `.env` à côté du `.app`.

Sous Windows PowerShell : `.\dependencies\docker-compose.yml`, pas de `&&` selon la version (une
commande par ligne), et `New-Item -ItemType Directory -Force recordings` au lieu de `mkdir -p`.

VS Code : `.vscode/launch.json` lance chaque brique, et l'ensemble
`demo: server + web + agent replay` démarre toute la démo sans le jeu.

Vidéo : OBS sur le PC de jeu publie vers MediaMTX sur le chemin `live/<station-id>` (le même
identifiant que `--station-id` de l'agent). Voir la décision 0019.

## Déploiement

- **Serveur** : `server/Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`), Python 3.12
  (`server/.python-version`). Configuration par variables `SIMRACE_*` (`server/app/shared/config.py`),
  dont `SIMRACE_CORS_ORIGINS` pour autoriser le front.
- **Front** : Node 22, `npm run build`, variables `VITE_API_URL`, `VITE_MAX_STATIONS`,
  `VITE_MEDIA_HOST`, ou `VITE_MEDIA_WEBRTC_URL` et `VITE_MEDIA_HLS_URL` derrière un proxy https.

## Choix de conception

Chaque choix est écrit dans [docs/decisions/](docs/decisions/README.md) (contexte, décision,
raisons, conséquences). Les principaux :

- **Agent vers serveur en POST par lots, pas en WebSocket** (0003) : chaque lot est vérifiable et
  rejouable, sans reconstruire un protocole par-dessus un flux.
- **Serveur vers navigateur en SSE** (0004) : flux à sens unique, HTTP ordinaire, reconnexion
  automatique d'`EventSource`.
- **Agent en Python** (0002) : lecture de la mémoire partagée Windows avec `ctypes`, une seule
  dépendance (`httpx`) sur le PC de jeu.
- **Lecture seule de la mémoire d'ACC** (0007) : l'agent ouvre la page, il ne la crée jamais.
- **Pas de package partagé** (0009) : le contrat existe en trois copies (agent, serveur, Zod),
  alignées par des tests.
- **Serveur organisé par contexte métier** (0010) : `app/features/` (`stations`, `ingestion`,
  `telemetry`, `tracks`) et `app/shared/`, en POO, composé dans `app/container.py`.
- **Ne pas stocker chaque paquet** (0008) : ACC émet environ 60 paquets/s ; on gardera les tours
  complets et un échantillon sur six.
- **Rejeu** (0006) : `record` et `--source replay` permettent de tester et de faire la démo sans
  le jeu.
- **File d'envoi de l'agent en mémoire, volontairement** : 500 lots, soit environ 100 s de serveur
  injoignable à un lot toutes les 200 ms. Au-delà, les plus anciens lots sont perdus et comptés
  (`dropped`), et le serveur voit le trou (`gaps`) : la perte est visible, jamais silencieuse.
  Évolution prévue : une boîte d'envoi SQLite sur le PC de jeu (`sqlite3` est dans Python, aucune
  dépendance en plus). Chaque lot est écrit avant l'envoi et supprimé à l'accusé : aucune perte,
  même si le serveur reste coupé longtemps ou si le PC redémarre. Elle passe après PostgreSQL
  côté serveur : tant que le serveur garde le dernier `seq` en mémoire, rejouer des lots après
  un redémarrage n'apporte presque rien.

## Développement avec agents IA

Le projet est développé avec Claude Code, avec revue humaine de chaque changement. Le cadre est
écrit : [CLAUDE.md](CLAUDE.md) et [AGENTS.md](AGENTS.md) (règles du projet),
[docs/decisions/](docs/decisions/README.md) (une décision n'est jamais réécrite, une nouvelle la
remplace) et [docs/HANDOFF.md](docs/HANDOFF.md) (ce qui est vérifié et ce qui ne l'est pas).
Les offsets de la mémoire d'ACC sont vérifiés sur le jeu, comparés à l'overlay et à SimHub.
