# 0008 Stockage PostgreSQL et réduction des échantillons

Statut : Acceptée, **non implémentée**. Date : 2026-10-09.

## Contexte

Le serveur garde aujourd'hui l'état en mémoire. La fiche de poste cite PostgreSQL et SQLAlchemy.
ACC émet ~60 paquets par seconde par poste.

## Décision

- Base : **PostgreSQL**, accès par **SQLAlchemy 2 (async)**, migrations **Alembic**. Une base est
  fournie par `docker-compose.yml` (utilisateur, mot de passe et base : `simrace`).
- On n'écrit pas chaque paquet : on stocke les **tours terminés** et **un échantillon sur six**
  (~10 Hz) pour la télémétrie, par lots.
- Un tour se termine quand `completed_laps` augmente. Un tour est aussi vérifié (durée plausible,
  validité du tour d'ACC une fois lue).
- Écritures **idempotentes** : clé unique `(station_id, run_id, seq)` sur les lots.
- Le dernier `seq` de chaque poste est relu de la base au démarrage du serveur.

## Raisons

- Réduit fortement le volume sans perdre l'information utile pour l'analyse d'un tour.
- Garantit qu'un renvoi de lot par l'agent n'insère jamais de doublon.

## Conséquences

- La diffusion SSE continue de recevoir tous les échantillons ; la réduction ne concerne que le
  stockage.
- Tant que ce n'est pas fait, un redémarrage du serveur perd l'historique et le dernier `seq`.
