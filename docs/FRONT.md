# Plan du front (`web/`)

Statut : proposition, à valider avant de coder. Les wireframes sont dans le design Claude
« SimRace Wireframes » (3 écrans : Postes, Direct, Intégrité).

## Objectif

Montrer en 3 minutes : un poste qui roule, des courbes en direct, les temps au tour, et la preuve
que les données sont fiables (doublons, trous, rejets comptés). Un seul scénario de démo :
rejeu d'un enregistrement sur 2 ou 3 postes (`--source replay --station-id sim-N`).

## Ce que le serveur fournit aujourd'hui

| Source | Contenu | Rythme |
|---|---|---|
| `GET /stations` | Liste des postes : `station_id`, `machine` (nom du PC, affiché en gris), `run_id`, `online`, `last_seen`, `session` (circuit, voiture, pilote), `last_seq`, `batches`, `samples`, `rejected`, `duplicates`, `gaps`, `reject_reasons` | Interrogation toutes les 2 s |
| `GET /stream` (SSE) | Évènement `samples` : `{ station_id, session, samples: Sample[] }`, un évènement par lot accepté | Un lot toutes les 200 ms par poste, environ 12 échantillons |
| `GET /stations/{id}` | Un poste (même contenu), 404 `StationNotFoundError` s'il est inconnu | À l'ouverture d'un écran poste |
| `GET /tracks` | Circuits ayant des tours ou des morceaux enregistrés : `track`, `lap_count`, `best_lap_ms` (`null` sans tour), `piece_count` | Au chargement |
| `GET /tracks/{circuit}/reference` | Carte de référence : tour choisi par la stratégie (`best_time` par défaut), `points[i] = [x, z]` en mètres à la position `i / len(points)`, `length_m`, `strategy` | Une fois par circuit, mise en cache côté front |
| `GET /tracks/{circuit}/laps`, `/laps/{lap_id}` | Tours enregistrés (résumés, plus récent d'abord) et un tour avec sa trace | À la demande |
| `GET /tracks/{circuit}/pieces`, `/pieces/{id}` | Morceaux de trace enregistrés sans attendre la fin du tour (`reason` : `sector`, `pause`, `pit_entry`, `lap_end`, `stopped`, `size_limit`), `start_pos`, `end_pos`, `points[i] = [x, z]` dans l'ordre roulé | À la demande |
| `GET /recorder/status` | Enregistreur de tracés : `laps_saved`, `duplicate_laps`, `rejected` et `discarded` par raison | Écran Intégrité |
| `GET /health` | `subscribers` | Au besoin |

Erreurs : corps `{ "error": "<NomDeLErreur>", "detail": "..." }` avec 404 (inconnu), 422 (identifiant
mal formé). Un circuit sans tour enregistré répond 404 : le front retombe sur le tracé schématique.

`Sample` : `t_ms` (horloge de l'agent, epoch ms), `packet_id`, `speed_kmh`, `gas`, `brake`, `gear`,
`rpm`, `steer`, `status` (0 off, 1 replay, 2 live, 3 pause), `completed_laps`, `lap_time_ms`,
`last_lap_ms`, `best_lap_ms`, `sector`, `in_pit`, `track_pos` (0 à 1).

## Lacunes à connaître (elles décident de ce qu'on dessine)

| Lacune | Conséquence sur le front | Où la combler |
|---|---|---|
| L'agent n'envoie pas encore `x`, `z` (le serveur les accepte, optionnels) | Tant qu'aucune carte n'existe pour un circuit (`GET /tracks/{circuit}/reference` répond 404), on dessine un **tracé schématique** avec un curseur placé par `track_pos`. Une fois la carte enregistrée : vrai tracé, voiture placée par `(x, z)` ou par `track_pos`. | Agent : lire `carCoordinates` (HANDOFF, étape 1) |
| Pas de validité du tour | Colonne « Validité » affichée « en attente » | Étape 2 de la passation (`isValidLap`) |
| Pas d'évènement « tour terminé » | Le front le déduit : `completed_laps` augmente, le temps du tour terminé est `last_lap_ms` du nouvel échantillon (0 = inconnu) | Plus tard : table `laps` côté serveur |
| Historique des lots absent (compteurs seulement) | L'écran Intégrité affiche des compteurs et des raisons de rejet. La « chaîne des lots » (carré par `seq`) est une phase 2. | Persistance PostgreSQL (étape 3) ou `GET /stations/{id}/batches` |
| `Last-Event-ID` ignoré par le serveur | Après une coupure SSE, le front recharge `/stations` et repart du direct. Les courbes ont un trou visible. | Durcissement (étape 6) |
| CORS : `GET` seulement | Suffit pour le front. | |

## Modèle de données côté front

```ts
type Sample = { /* champs ci-dessus, mêmes noms */ };
type SessionInfo = { track: string; car: string; driver: string };

type StationSummary = {            // GET /stations
  station_id: string; machine: string | null; run_id: string; online: boolean; last_seen: string | null;
  session: SessionInfo; last_seq: number; batches: number; samples: number;
  rejected: number; duplicates: number; gaps: number;
  reject_reasons: Record<string, number>;   // "champ:type" -> nombre
};

type Channel = { t: Float64Array; v: Float32Array };  // tampon circulaire, 60 s à 60 Hz = 3 600 points

type LiveStation = {               // état dérivé du flux
  latest: Sample | null;
  speed: Channel; gas: Channel; brake: Channel;
  laps: Lap[];                      // déduits des changements de completed_laps
  lastSampleAt: number;             // pour détecter un poste muet
};
type Lap = { number: number; timeMs: number | null; best: boolean; valid: boolean | null };
```

Règles :

- Un `run_id` différent pour un même poste vide les tampons et les tours (l'agent a redémarré).
- Les échantillons sont ajoutés dans l'ordre d'arrivée. Un `t_ms` qui recule est ignoré (défense,
  le serveur ne réordonne pas).
- Statut 3 (pause) : les tampons ne reçoivent rien, le badge passe à « En pause ».
- Format français : virgule décimale, espace fine insécable, chiffres tabulaires. Temps de tour :
  `m:ss,mmm`.

## Flux de données

```
EventSource /stream --évènement samples--> reducer (par station_id) --> tampons Float32Array
fetch /stations (2 s) ------------------> liste des postes + compteurs d'intégrité
tampons --requestAnimationFrame (20 images/s)--> uPlot (vitesse, gaz et frein)
```

- Un seul `EventSource` pour toute l'application, partagé par les écrans (contexte React).
- Les tampons vivent hors de l'état React (références) : React ne se redessine pas à 60 Hz. Seuls
  les chiffres (KPI) sont rafraîchis à 10 Hz.
- État de connexion : `connecté`, `reconnexion`, `hors ligne`, toujours visible dans l'en-tête.
- Poste « muet » : `online` du serveur (5 s) combiné à `lastSampleAt` côté client.

## Écrans et routes

| Route | Écran | Public | Données |
|---|---|---|---|
| `/` | **Postes** : grille de cartes, KPI globaux | Opérateur du centre | `/stations` + dernier échantillon du flux |
| `/stations/:id` | **Direct** : KPI, courbes, position sur la piste, tours | Pilote, opérateur | flux `samples` filtré sur le poste |
| `/stations/:id/integrite` | **Intégrité** : compteurs, raisons de rejet, runs | Opérateur, démo recruteur | `/stations` (+ phase 2 : lots) |

## Stack proposée

Vite, React 18, TypeScript strict, React Router, uPlot (courbes, très rapide à 60 Hz), CSS simple
(variables issues des tokens « Flame & Sand »), Vitest pour le reducer et les formats, Playwright
pour le scénario de démo. Pas de bibliothèque d'état : un reducer et un contexte suffisent.
Si validée, elle doit être consignée dans `docs/decisions/0016-...` avant de coder.

## Ordre de construction

1. Squelette Vite + client de flux (reducer, tampons) + tests Vitest sur le reducer (doublons de
   `t_ms`, changement de `run_id`, déduction des tours).
2. Écran Postes (le plus simple, valide `/stations` et CORS).
3. Écran Direct : KPI, puis courbes uPlot, puis tracé schématique, puis tableau des tours.
4. Écran Intégrité (compteurs et raisons).
5. Playwright : lancer serveur + rejeu, vérifier qu'une courbe se dessine et qu'un doublon
   injecté incrémente le compteur.
6. Phase 2 selon l'avancement : chaîne des lots, validité du tour, coordonnées de piste.

## Décisions à trancher

1. Tracé de piste : décidé côté serveur (décision 0011, enregistrement des tours). Reste à
   faire côté agent : envoyer `x` et `z`.
2. Stack ci-dessus validée ou non (ADR à écrire, numéro 0016 : les 0010 à 0015 sont pris par le
   serveur).
3. Thème : « Flame & Sand » (clair, verre) retenu pour les wireframes. Un thème sombre est hors
   périmètre de ce design system.
