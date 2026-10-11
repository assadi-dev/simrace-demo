# 0017 Pile du front : Vite, React, shadcn/ui, TanStack, Zod, Zustand, nuqs

Statut : Acceptée. Date : 2026-10-11. Remplace la pile proposée dans [docs/FRONT.md](../FRONT.md)
(React Router, CSS simple, pas de bibliothèque d'état).

## Contexte

`web/` n'existait pas. Le propriétaire est développeur full-stack (Node, TypeScript, React en
production) et connaît déjà ces outils : le front doit rester lisible et défendable à l'oral. Le
design system est celui du dépôt ([design.md](../../design.md), thème « Flame & Sand »), cible
shadcn/ui et Tailwind v4.

## Décision

| Outil | Rôle dans le front |
|---|---|
| Vite, React 19, TypeScript strict | Base du projet (`web/`) |
| Tailwind v4 + shadcn/ui (Radix) | Composants. Les tokens de `design.md` sont dans `src/index.css`, la palette Tailwind par défaut est retirée : aucune couleur en dur |
| TanStack Router | Routes par fichiers (`src/routes/`), liens et paramètres typés |
| TanStack Table v9 | Tous les tableaux, via un composant `DataTable` générique (tri) rendu avec les composants shadcn |
| TanStack Query | Données du serveur à interroger : `GET /stations` toutes les 2 s |
| Zustand | État du direct : connexion du flux SSE, dernier échantillon de chaque poste |
| Zod | Définition et validation des contrats (`src/contracts/`) : réponses HTTP et évènements SSE |
| nuqs | État de la vue dans l'URL (par exemple `?circuit=monza` sur le leaderboard), pour partager un lien |
| Vitest | Fonctions pures, store, contrats |
| Playwright | Scénarios de démo contre un **vrai** serveur FastAPI et le vrai front, sans mock |

Où va chaque état : serveur interrogé dans Query, flux en direct dans Zustand, choix partageable
dans l'URL (nuqs), le reste dans `useState`.

## Raisons

- Query et Zustand ne se recouvrent pas : le polling de `/stations` a besoin de cache et de
  relance, le flux SSE pousse des évènements qu'aucune requête ne représente.
- Zod valide à la frontière : le serveur ne fait pas confiance à l'agent, le front ne fait pas
  confiance au serveur. Une réponse hors contrat devient une `ApiError` (`ContractViolation`) ou
  un évènement SSE compté dans `invalidEvents`, jamais un `undefined` qui se promène dans l'UI.
- TanStack Router et TanStack Table sont typés de bout en bout et partagent le même état d'esprit
  (headless, composable).

## Conséquences

- **Le contrat existe maintenant en trois exemplaires** (agent, serveur, `web/src/contracts/`).
  Garde-fou : `telemetry.test.ts` compare les champs d'un vrai évènement SSE du serveur
  (`src/contracts/fixtures/`) avec ceux du schéma Zod, car Zod ignore sans bruit les champs
  inconnus. Si le serveur change son contrat, regénérer les fixtures et mettre le schéma à jour.
  Piste si le contrat grossit : exporter un schéma depuis OpenAPI plutôt que le recopier (voir
  décision 0009).
- Les champs optionnels arrivent à `null` dans le flux (le serveur sérialise avec `model_dump`) :
  les schémas utilisent `nullish()`.
- **TanStack Table v9** a une API différente de la v8 (`useTable`, `tableFeatures`,
  `table.FlexRender`) et la plupart des exemples en ligne sont en v8. Les colonnes de temps
  utilisent `sortDescFirst: false` (le plus rapide d'abord) et `sortUndefined: "last"` (un temps
  inconnu reste en bas dans les deux sens), ce que les tests Playwright vérifient.
- Le flux SSE ne rejoue pas l'historique : un poste n'a de valeurs en direct qu'après son prochain
  lot. Le front affiche `n.d.` plutôt que d'inventer (design.md, principe 6).
- Pas encore de bibliothèque de courbes : uPlot reste le choix prévu (docs/FRONT.md) et sera ajouté
  avec l'écran Direct, pas avant.
- `npm audit` signale 7 alertes élevées, toutes dans la chaîne `braces`, `micromatch`, `fast-glob`,
  puis le paquet `shadcn` (outillage de build) et `ts-morph`. Rien n'est livré au navigateur ;
  `npm audit fix --force` est un changement cassant, à ne pas lancer sans relire.
