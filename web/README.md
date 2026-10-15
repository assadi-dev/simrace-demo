# web : interface SimRace

Front de la démo : postes, leaderboard, direct d'un poste (avec les compteurs d'intégrité sur les cartes). Il lit le serveur
FastAPI (`../server`) : `GET /stations` toutes les 2 s et le flux SSE `GET /stream`.

Pile et raisons : [décision 0017](../docs/decisions/0017-pile-du-front.md). Plan des écrans :
[docs/FRONT.md](../docs/FRONT.md). Design : [design.md](../design.md) (thème Flame & Sand).

## Démarrer

```
npm install
npm run dev
```

Le serveur doit tourner sur `http://localhost:8000` (`cd ../server && uv run uvicorn app.main:app`).
Configuration dans `.env.local` (voir `.env.example`), validée par Zod au démarrage
(`src/lib/config.ts`) : `VITE_API_URL` (serveur, `http://localhost:8000` par défaut) et
`VITE_MAX_STATIONS` (nombre de postes du centre, pour « Postes en ligne N / max », 1 par défaut).
Redémarrer `npm run dev` après un changement. Le serveur n'autorise par défaut que
`http://localhost:5173` en CORS.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Typage strict (`tsc -b`) puis build |
| `npm run lint` | ESLint |
| `npm test` | Vitest : contrats Zod, store, fonctions pures |
| `npx playwright install chromium` | À faire une fois avant les tests e2e |
| `npm run test:e2e` | Playwright : lance `uvicorn` (port 8100) et Vite (port 5273), envoie de vrais lots comme l'agent ; n'utilise ni tes serveurs de développement ni `.env.local` |

## Organisation

```
src/
  routes/         routes par fichiers (TanStack Router) ; routeTree.gen.ts est généré
  contracts/      schémas Zod (miroir du serveur) + fixtures capturées sur un vrai serveur
  features/       logique par écran (stations, leaderboard)
  stores/         état du direct (Zustand)
  hooks/          useLiveStream : l'unique EventSource
  lib/            client API (validation Zod), formats
  components/     composants de l'application ; ui/ = shadcn/ui adapté au thème
e2e/              scénarios Playwright (agent.ts joue le rôle de l'agent)
public/           manifest PWA (manifest.webmanifest), favicon.ico, icons/
```

## PWA

L'application s'installe (« Ajouter à l'écran d'accueil », icône d'installation de Chrome) grâce à
`public/manifest.webmanifest` : affichage `standalone`, couleur `ink` (`#2D2C2A`), fond
`ambient-mid`. Pas de service worker : les données sont en direct (SSE), une mise en cache hors
ligne montrerait des valeurs périmées. Le test `e2e/pwa.spec.ts` vérifie les icônes et demande à
Chrome si l'application est installable.

Icônes : générées avec OpenArt (GPT Image 2, circuit orange `#E27100` sur fond `ink`, 1024 px),
puis déclinées en 16, 32 et 48 (`favicon.ico`, trait épaissi pour rester lisible), 180 (iOS), 192,
512 et 512 `maskable` (dessin réduit à la zone sûre de 80 %).

## Règles

- Aucune couleur en dur : uniquement les tokens de `src/index.css` (la palette Tailwind par défaut
  est retirée). Statut jamais à la couleur seule : pastille de forme distincte et libellé.
- Une valeur absente de l'API s'affiche `n.d.`, jamais inventée.
- Tableaux : `DataTable` (TanStack Table v9, tri). Colonnes de temps : `sortDescFirst: false` et
  `sortUndefined: "last"`.
- Ajouter un composant shadcn : `npx shadcn@latest add <nom>`, puis l'adapter aux tokens.
- Le contrat du serveur change : regénérer `src/contracts/fixtures/` et le schéma Zod.
