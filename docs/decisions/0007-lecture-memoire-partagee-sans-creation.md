# 0007 Lecture de la mémoire partagée sans jamais créer la page

Statut : Acceptée. Date : 2026-10-09.

## Contexte

ACC expose trois pages de mémoire partagée nommées `Local\acpmf_physics`,
`Local\acpmf_graphics` et `Local\acpmf_static`. Ouvrir une page nommée avec `mmap.mmap(..., tagname=...)`
peut en créer une si elle n'existe pas encore, ce qui pourrait gêner le jeu à son démarrage.

## Décision

`agent/src/simrace_agent/sources/acc.py` lit chaque page avec `OpenFileMappingW` (lecture seule) et
`MapViewOfFile`, copie le début de la page, puis la libère. Si la page n'existe pas, il lève
`SourceError` (« ACC est-il lancé et en session ? ») et réessaie toutes les 2 secondes. L'agent ne
crée jamais de page.

## Raisons

- Pas d'effet de bord sur ACC.
- Une copie par lecture évite de garder des références sur une mémoire que le jeu réécrit en
  permanence.

## Conséquences

- Le code n'a pas été exécuté sur un vrai Windows avec ACC (voir `docs/HANDOFF.md`).
- Les pages sont lues ~120 fois par seconde au maximum (`poll_hz`) ; l'agent n'émet un
  échantillon que si le `packetId` de la page physique a changé.
- Les offsets sont dans `layout.py`, isolés du code Windows pour être testés avec des tampons
  synthétiques sur n'importe quelle machine.
