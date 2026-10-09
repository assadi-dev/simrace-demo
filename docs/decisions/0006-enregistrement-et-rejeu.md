# 0006 Enregistrement et rejeu de sessions

Statut : Acceptée. Date : 2026-10-09.

## Contexte

Il faut pouvoir tester, développer sur macOS et faire la démo sans lancer le jeu, ni depuis le
poste Windows.

## Décision

- `simrace-agent record --out fichier.jsonl` enregistre ce qu'une source produit : première ligne
  `{"session": {...}}`, puis un échantillon par ligne.
- `simrace-agent run --source replay --file fichier.jsonl [--speed N]` rejoue l'enregistrement à la
  cadence d'origine (accélérable) en réécrivant `t_ms` avec l'heure courante.
- Les fichiers vont dans `recordings/` (ignoré par git).

## Raisons

- Tests reproductibles et démo possible partout.
- Un fichier de rejeu sert aussi de cas de test pour la CI.

## Conséquences

- Le format JSONL fait partie du contrat : l'enregistrement dépend des champs de `Sample`. Si
  `Sample` change, les anciens enregistrements peuvent ne plus se charger.
