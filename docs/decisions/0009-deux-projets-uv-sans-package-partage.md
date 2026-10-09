# 0009 Deux projets uv, sans package partagé

Statut : Acceptée. Date : 2026-10-09.

## Contexte

L'agent et le serveur échangent les mêmes champs (`Sample`, `SessionInfo`). L'agent tourne sur le PC
de jeu et doit rester léger. L'utilisateur utilise `uv` et `hatchling` dans ses autres projets
Python (par exemple `cv-analyser-api`).

## Décision

- `agent/` et `server/` sont deux projets `uv` indépendants (chacun son `pyproject.toml`, son
  `uv.lock`, son `.venv`).
- Le contrat est dupliqué volontairement : dataclasses dans `agent/src/simrace_agent/models.py`,
  modèles Pydantic dans `server/app/shared/contract.py` (anciennement `server/app/schemas.py`,
  déplacé par la décision 0010).

## Raisons

- L'agent n'embarque ni FastAPI ni Pydantic : une seule dépendance (`httpx`).
- Un package partagé ajouterait de l'outillage pour une quinzaine de champs.

## Conséquences

- Il faut garder les deux définitions alignées à la main. Les tests de bout en bout (rejeu vers le
  serveur) détectent un désaccord de nom ou de type.
- Si le contrat grossit, envisager un schéma commun (JSON Schema ou OpenAPI exporté du serveur)
  plutôt qu'un package partagé.
