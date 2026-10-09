# 0002 L'agent Windows est en Python

Statut : Acceptée. Date : 2026-10-09.

## Contexte

L'agent lit la mémoire partagée d'ACC. L'utilisateur est à l'aise en TypeScript et a envisagé de
l'écrire en TypeScript.

## Décision

L'agent est en **Python** (>= 3.11), avec `httpx` comme seule dépendance.

## Raisons

- Python lit la mémoire partagée Windows avec la bibliothèque standard et `ctypes`, sans
  extension native. Node n'a pas de lecture native d'une zone mémoire nommée ; les options
  trouvées (`acc-node-wrapper`, `node-easy-ipc`, `node-filemap`, `koffi`) sont soit anciennes,
  soit demandent Visual Studio pour compiler.
- La fiche de poste demande du back-end Python : le projet montre du Python utilisé pour de vrai.
- TypeScript reste le langage du front React.

## Conséquences

- Si un jour l'agent doit passer en TypeScript, le point d'entrée serait `acc-node-wrapper` (à
  vérifier avec la version actuelle du jeu) ou `koffi` avec la structure décrite dans `layout.py`.
