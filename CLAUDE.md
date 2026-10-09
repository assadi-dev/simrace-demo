# simrace-demo

Démo technique d'une plateforme de télémétrie Sim Racing. Un **agent** installé sur le PC de jeu
lit Assetto Corsa Competizione (ACC), envoie la télémétrie par lots numérotés à un **serveur**
FastAPI, qui la valide puis la diffuse en direct (SSE) à une interface React.

## Pourquoi ce projet existe

C'est un projet de démonstration préparé pour un échange de 20 minutes avec un recruteur, pour une
mission de développeur full-stack sur une plateforme Sim Racing (centres de simulation, données de
course en temps réel). La fiche de poste demande : Python, APIs, PostgreSQL, SQLAlchemy, traitement
temps réel, architecture distribuée, **fiabilité des données** (intégrité, exactitude, traçabilité,
reprise après erreur), UI pour pilotes/centres/opérateurs, tests, CI/CD, Docker, Playwright, usage
d'agents IA de développement avec revue humaine.

Conséquences pour toi, agent IA :
- Le projet doit **se montrer** en quelques minutes : courbes en direct, temps au tour, trace de
  piste, état des postes. Une démo qui tourne vaut mieux qu'une architecture complète.
- Insister sur la **robustesse des données** (doublons, trous, rejets, reprise) plus que sur le
  volume de fonctionnalités.
- Le propriétaire est développeur full-stack (Node/TypeScript/React en production). Son Python
  vient de projets personnels. Garde le code simple, lisible et défendable à l'oral.

## À lire avant de modifier quoi que ce soit

1. [docs/HANDOFF.md](docs/HANDOFF.md) : état exact, ce qui est vérifié ou non, prochaines étapes.
2. [docs/decisions/README.md](docs/decisions/README.md) : décisions prises et leurs raisons. Ne
   reviens pas sur une décision sans en discuter avec l'utilisateur et sans écrire une nouvelle
   décision qui remplace l'ancienne.

## Architecture

```
PC de jeu (Windows)                      Serveur
ACC -> mémoire partagée                  FastAPI
  -> agent Python --POST /ingest/batches--> validation, doublons, trous
       (lots numérotés, accusé,            |- GET /stations  (santé des postes)
        reprise après coupure)             |- GET /tracks/{circuit}/reference  (tracé de piste)
                                           '- GET /stream    (SSE) --> React (à faire)
```

| Dossier | Rôle | Stack |
|---|---|---|
| `agent/` | Lit ACC (Windows), enregistre/rejoue des sessions, envoie des lots | Python >= 3.11, `httpx` seulement |
| `server/` | Ingestion, contrôle d'intégrité, diffusion SSE, état des postes, enregistrement des tracés | FastAPI, Pydantic, Python >= 3.12, POO, `app/features/` + `app/shared/` |
| `web/` | Interface React (n'existe pas encore) | React, TypeScript |
| `docs/` | Décisions et passation | Markdown |

Deux projets `uv` indépendants (`agent/` et `server/`), chacun avec son `pyproject.toml`, son
`uv.lock` et son `.venv`. Ne mets pas de dépendance lourde dans l'agent : il tourne sur le PC de
jeu.

### Organisation du serveur (décision 0010)

`server/app/features/<contexte>/` : un dossier par contexte métier (`stations`, `ingestion`,
`telemetry`, `tracks`), avec les fichiers dont il a besoin parmi `domain`, `schemas`, `controller`,
`routes`, `services`, `repository`, `factory`, `strategy`. `server/app/shared/` : ce qui sert à
plusieurs contextes (contrat avec l'agent, horloge, évènements, erreurs, configuration, `Slug`).
`app/container.py` compose tout, `app/main.py` crée l'application. Les tests sont rangés pareil
dans `server/tests/`.

## Commandes

Depuis `server/` ou `agent/` (même syntaxe sous Windows PowerShell) :

```
uv sync
uv run pytest
```

```
# serveur
cd server && uv run uvicorn app.main:app --reload

# agent : sonde de lecture ACC (Windows, ACC lancé en session)
cd agent && uv run simrace-agent probe

# agent : envoi au serveur (depuis ACC ou depuis un enregistrement)
uv run simrace-agent run --server http://localhost:8000
uv run simrace-agent run --source replay --file ../recordings/session.jsonl --station-id sim-1
uv run simrace-agent record --out ../recordings/session.jsonl
```

PowerShell : pas de `mkdir -p` ni de `&&` selon la version. Crée `recordings\` avec
`New-Item -ItemType Directory -Force recordings` et enchaîne les commandes sur des lignes séparées.

## Règles du projet

- **Contrat agent/serveur** : `agent/src/simrace_agent/models.py` (`Sample`, `SessionInfo`) et
  `server/app/shared/contract.py` doivent rester alignés champ par champ. Il n'y a volontairement
  pas de package partagé (voir décision 0009). Si tu changes l'un, change l'autre et les tests des
  deux. `x` et `z` (position monde, décision 0011) et les mesures de pneus et de freins (4 valeurs par
  mesure, décision 0013), le carburant, les aides TC et ABS (décision 0014) et les forces G (décision 0015) et les drapeaux et pénalités (décision 0016) sont optionnels et
  existent des deux côtés.
- **Serveur en POO** : tout est classe (entités, services, contrôleurs, routes, dépôts, fabriques,
  stratégies), dépendances passées au constructeur, composition dans `app/container.py`. Un dépôt
  ou une stratégie est une classe abstraite avec une implémentation concrète séparée. Les
  contrôleurs qui touchent à l'état partagé sont `async` (boucle d'évènements, pas de thread).
  Cette règle ne concerne pas l'agent.
- **Tracés de circuit** : le serveur enregistre un fichier JSON par tour valide, et un par
  **morceau** de trace (secteur franchi, pause, entrée aux stands, fin de tour : décision 0012),
  jamais écrasés. Un nom venu de l'agent (circuit, poste, run) ne devient jamais un chemin sans
  passer par `Slug`.
- **Ne crée jamais une page de mémoire partagée côté agent** : lecture seule avec
  `OpenFileMappingW`, jamais `CreateFileMapping` (voir décision 0007).
- **Ne persiste pas chaque paquet** : ACC émet ~60 paquets/s. Stocke les tours complets et un
  échantillon sur six pour la télémétrie, par lots (voir décision 0008).
- **Le serveur ne fait pas confiance à l'agent** : tout échantillon est validé (bornes dans
  `shared/contract.py`), un rejet est compté avec sa raison, il ne fait jamais échouer tout un lot.
- Un nouveau `run_id` = l'agent a redémarré, la numérotation `seq` repart de 1.
- **Langue** : documentation et commentaires en français, identifiants de code en anglais. Pas de
  tiret cadratin (—) dans les textes rédigés pour l'utilisateur. Les commentaires du code existant
  n'ont pas d'accents (conserve ce style dans les fichiers Python).
- Ajoute des tests avec chaque changement de comportement. La lecture de la vraie mémoire
  partagée ne peut se tester que sur Windows avec ACC ; le décodage (`layout.py`) se teste avec des
  tampons synthétiques sur n'importe quelle machine.

## Ce qui n'est pas vérifié

Vérifié sur un vrai ACC le 2026-10-09 avec `probe` : la physique (vitesse, pédales, rapport,
tr/min), le tour, son temps, `pos`, le statut, et le circuit, la voiture et le pilote.

La position monde (`x`, `z`, offsets 252, 256, 976 et 1216 de `layout.py`) a été lue avec `probe`
sur un tour réel : pas de saut, distance cohérente avec la vitesse. À noter : ACC ne fait pas
avancer `completed_laps` au passage de ligne du tour de sortie des stands (décision 0011).

Le tour de sortie des stands d'une vraie session est enregistré en morceau (4783 m, 603 points).

**Jamais vu sur un vrai jeu** : la répartition de freinage `brake_bias` (lit 0,75, SimHub affiche 54,0, décision 0016), les valeurs des drapeaux et des pénalités (offsets 1220, 1224, 1228, décision 0016), la valeur des pneus et des freins en roulant (offsets 88, 152, 348, 740, 756 de la page physique, décision 0013 : lus à l'arrêt, plausibles), le champ `sector` d'ACC (déclencheur « secteur » des morceaux), un
passage aux stands, le temps du dernier et du meilleur tour. Le serveur, le rejeu et l'envoi par lots sont testés de bout en bout avec
des enregistrements rejoués. Voir le détail dans [docs/HANDOFF.md](docs/HANDOFF.md).
