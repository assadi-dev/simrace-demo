# simrace-demo

Demo d'une plateforme de telemetrie Sim Racing: un **agent** installe sur le PC de jeu lit
Assetto Corsa Competizione (ACC), envoie la telemetrie par lots numerotes a un **serveur**
FastAPI, qui la valide et la diffuse en direct (SSE) a une interface React.

```
PC de jeu (Windows)                      Serveur
ACC -> memoire partagee                  FastAPI
  -> agent Python --POST /ingest/batches--> validation, doublons, trous
       (lots numerotes, accuse,            |- GET /stations  (sante des postes)
        reprise apres coupure)             '- GET /stream    (SSE) --> React (a faire)
```

> Agents IA et reprise du projet: lire [CLAUDE.md](CLAUDE.md), [docs/HANDOFF.md](docs/HANDOFF.md)
> et [docs/decisions/](docs/decisions/README.md).

## Etat

| Brique | Etat |
|---|---|
| `agent/` lecture ACC, enregistrement/rejeu, envoi par lots | fait, lecture ACC verifiee (vitesse, pedales, tours), **position x/z (trace de piste) ecrite mais pas encore verifiee** |
| `server/` ingestion, controle d'integrite, `/stations`, `/stream` (SSE), trace des circuits (`/tracks`) | fait, 214 tests, postes **en memoire**, traces (tours et morceaux) en fichiers JSON |
| PostgreSQL / SQLAlchemy / Alembic (sessions, tours) | a faire (`docker-compose.yml` fournit la base) |
| `web/` React (courbes, temps au tour, trace de piste, sante des postes) | a faire |
| CI GitHub Actions, Playwright | a faire |

## Premier test sur le PC de jeu (etape 1)

Les offsets des pages de memoire partagee (`agent/src/simrace_agent/layout.py`) viennent de la
documentation communautaire et sont a verifier.

1. Copier le dossier `agent/` sur le PC Windows, installer [uv](https://docs.astral.sh/uv/).
2. Lancer ACC, entrer en session (essais libres), rouler.
3. Dans `agent/`: `uv run simrace-agent probe`. La vitesse, les pedales, le temps du tour et
   la position doivent bouger avec le jeu. Si les valeurs sont absurdes, corriger `layout.py`.

## Lancer l'ensemble

```bash
# serveur
cd server && uv sync && uv run uvicorn app.main:app --reload

# agent (sur le PC de jeu, ou ici avec un rejeu)
cd agent && uv sync && mkdir -p ../recordings
uv run simrace-agent record --out ../recordings/monza.jsonl    # roule dans ACC, Ctrl+C pour finir
uv run simrace-agent run --server http://<ip-serveur>:8000     # temps reel depuis ACC
uv run simrace-agent run --source replay --file ../recordings/monza.jsonl --speed 1

# observer
curl -N http://localhost:8000/stream
curl http://localhost:8000/stations
```

Tests: `uv run pytest` dans `agent/` et dans `server/`.

## Choix de conception

- **Agent vers serveur en POST par lots, pas en WebSocket**: chaque lot a un `seq` (dans un
  `run_id` propre a chaque demarrage de l'agent). Le serveur acquitte; l'agent garde en file
  et renvoie ce qui n'est pas acquitte. Un doublon est acquitte sans etre recompte, un trou de
  `seq` est compte (`gaps`).
- **Serveur vers navigateur en SSE**: flux a sens unique, reconnexion automatique du
  navigateur, un evenement par lot (tableau d'echantillons).
- **Validation par echantillon**: un echantillon aberrant (vitesse > 500, position hors 0..1...)
  est rejete et compte avec sa raison (`reject_reasons`), sans perdre le reste du lot.
- **Rejeu**: `record` / `--source replay` permettent de tester et de faire la demo sans le jeu.
