# 0005 Validation et rejet par échantillon

Statut : Acceptée. Date : 2026-10-09.

## Contexte

Un lot contient plusieurs échantillons. Un seul échantillon aberrant ne doit pas faire perdre tout
le lot, et on veut pouvoir expliquer pourquoi une donnée a été refusée (exactitude, traçabilité).

## Décision

- L'enveloppe du lot (`Batch`) est validée strictement : une enveloppe invalide est un 422.
- Les échantillons arrivent comme des dictionnaires et sont validés **un par un** avec le modèle
  `Sample` (bornes dans `server/app/shared/contract.py`). Un échantillon invalide est rejeté, compté dans
  `rejected` et sa raison est comptée dans `reject_reasons` (par exemple
  `speed_kmh:less_than_equal`). Le reste du lot est accepté.
- `/stations` expose ces compteurs pour l'opérateur.

## Raisons

- Montre le contrôle d'exactitude sans perdre de données valides.
- Les rejets sont visibles et classés, utile pour diagnostiquer un capteur ou un agent défaillant.

## Conséquences

- Les bornes (vitesse <= 500 km/h, position normalisée entre 0 et 1, temps de tour <= 1 h, etc.)
  sont des choix de démo ; les ajuster si des données réelles sont refusées à tort.
- Une vérification plus fine (tour trop court, saut de position) viendra avec la détection de
  tours, au moment de la persistance.
