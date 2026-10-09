# 0004 Serveur vers navigateur : SSE

Statut : Acceptée. Date : 2026-10-09.

## Contexte

Le front React affiche les données en direct. Il ne fait que recevoir.

## Décision

`GET /stream` diffuse en **Server-Sent Events**. Un événement `samples` par lot reçu, contenant
`station_id`, `session` et un tableau d'échantillons. Chaque événement a un `id` croissant.

## Raisons

- Flux à sens unique : un WebSocket bidirectionnel n'apporte rien.
- HTTP ordinaire, reconnexion automatique d'`EventSource`.
- L'utilisateur connaît SSE (Mercure sur un projet précédent).
- FastAPI le fournit : `fastapi.sse.EventSourceResponse` et `ServerSentEvent` (vérifié dans la
  documentation officielle le 2026-10-09 ; fonctionne avec FastAPI 0.143 installé).

## Conséquences

- Pas de reprise `Last-Event-ID` pour l'instant : les `id` sont émis mais il n'y a pas de tampon
  d'événements à rejouer.
- Le hub (`server/app/features/telemetry/hub.py`) jette les plus anciens événements d'un abonné trop lent.
- Navigateur en HTTP/1.1 : limite d'environ 6 connexions ouvertes par serveur, sans effet pour une
  démo.
