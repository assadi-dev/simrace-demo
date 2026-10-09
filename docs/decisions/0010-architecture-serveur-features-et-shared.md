# 0010 Architecture du serveur : features, shared, DDD pragmatique en POO

Statut : Acceptée. Date : 2026-10-09.

## Contexte

Le serveur tenait dans quatre fichiers (`main.py`, `stations.py`, `hub.py`, `schemas.py`). L'ajout
de l'enregistrement des tracés, de nouvelles routes pour le front et de la persistance
(PostgreSQL, décision 0008) demande une structure qui reste lisible à l'oral et où l'on peut
remplacer un stockage sans toucher à la logique métier.

## Décision

- Le serveur est organisé par **contexte métier** dans `server/app/features/<contexte>/`, plus un
  dossier `server/app/shared/` pour ce qui sert à plusieurs contextes.
- Un contexte contient seulement les fichiers dont il a besoin, parmi : `domain.py`, `schemas.py`
  (DTO Pydantic de l'API), `controller.py`, `routes.py`, `services.py`, `repository.py`,
  `factory.py`, `strategy.py`.
- **Tout est écrit en classes** (POO) : entités, services, contrôleurs, routes (une classe qui
  possède un `APIRouter`), dépôts, fabriques, stratégies. Les dépendances sont passées au
  constructeur.
- Dépôts et stratégies sont des **classes abstraites** (`ABC`) avec au moins une implémentation en
  mémoire ou fichier. PostgreSQL sera une implémentation de plus.
- La **composition** (qui construit quoi) est dans un seul endroit : `app/container.py`
  (`ApplicationContainer`) et `app/main.py` (`ApiApplication`).
- Les contextes communiquent par **évènements** sur un bus en mémoire (`shared/events.py`)
  quand l'un réagit à l'autre (`SamplesAccepted` alimente la diffusion SSE et l'enregistrement des
  tracés). Un abonné en erreur n'empêche jamais l'ingestion.
- Les erreurs métier sont des exceptions (`shared/errors.py`) traduites en HTTP à un seul endroit.
- Validation : Pydantic aux frontières (entrée des lots, échantillons un par un, sorties de
  l'API). Les règles métier (doublons, trous, validité d'un tour) sont dans le domaine, testées
  sans HTTP.

## Contextes

| Contexte | Rôle | Routes |
|---|---|---|
| `stations` | État d'un poste, intégrité des lots (doublons, trous, rejets), politique « en ligne » | `GET /stations`, `GET /stations/{id}` |
| `ingestion` | Réception d'un lot, validation échantillon par échantillon, évènement `SamplesAccepted` | `POST /ingest/batches` |
| `telemetry` | Diffusion en direct (SSE) | `GET /stream` |
| `tracks` | Détection des tours, validation, enregistrement des tracés, carte de référence | `GET /tracks`, `/tracks/{t}/reference`, `/tracks/{t}/laps`, `/recorder/status` |

## Raisons

- Chaque dossier répond à une question métier simple, ce qui se défend en 20 minutes.
- Les stratégies et fabriques ne sont là que là où il y a une vraie variation : politique « en
  ligne » (silence, plus tard signal de vie), règles de validité d'un tour, rééchantillonnage,
  choix de la carte de référence.
- Le passage à PostgreSQL ne change que les classes `repository.py`.

## Conséquences

- Le contrat avec l'agent (`Sample`, `SessionInfo`) vit dans `app/shared/contract.py` (il se
  trouvait dans `app/schemas.py`). La règle de la décision 0009 reste : l'aligner champ par champ
  avec `agent/src/simrace_agent/models.py`.
- Les tests sont rangés comme le code : `server/tests/features/<contexte>/` et
  `server/tests/shared/`.
- L'agent n'est pas concerné par cette décision.
