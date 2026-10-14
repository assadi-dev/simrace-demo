# 0020 Adresses MediaMTX complètes pour un front en https

Statut : Acceptée. Date : 2026-10-15. Complète la décision 0019 (sans la remplacer).

## Contexte

La décision 0019 donne au front l'hôte MediaMTX seul (`VITE_MEDIA_HOST`). Le front construit
`http://<hôte>:8889` (WebRTC) et `http://<hôte>:8888` (HLS).

En production, le front est servi en https (`https://simracedemo-web-…sslip.io`). Un navigateur
refuse qu'une page https appelle une adresse http (contenu mixte) : la vidéo ne se charge pas, et
l'erreur ressemble à un problème de CORS. Le proxy de l'hébergeur expose MediaMTX en https sur
son propre domaine, sans port, et ce domaine ne mène qu'au WebRTC (8889). Le HLS (8888) n'y est
pas exposé.

## Décision

- Deux variables optionnelles, en URL complète : `VITE_MEDIA_WEBRTC_URL` et
  `VITE_MEDIA_HLS_URL`. Chacune remplace, pour son protocole, l'adresse construite depuis
  `VITE_MEDIA_HOST`.
- Absentes : rien ne change, `http://<VITE_MEDIA_HOST>:8889` et `:8888` comme avant (réseau
  local, développement).
- Le front calcule une adresse de base par protocole (`config.media.webrtc`, `config.media.hls`,
  `web/src/lib/config.ts`) et y ajoute `live/<flux>/whep` ou `live/<flux>/index.m3u8`.
- Un protocole sans adresse affiche « WebRTC non configuré » ou « HLS non configuré » sur la
  carte. Une adresse http lue depuis une page https affiche « adresse http bloquée par la page
  https », au lieu d'un échec réseau muet.

## Raisons

- Le proxy décide des domaines et des ports : le front ne peut pas les deviner depuis un hôte.
- Une URL par protocole permet d'exposer WebRTC et HLS sur deux domaines https différents, ou
  un seul des deux.
- L'hôte seul reste le réglage le plus simple sur un réseau local : il est gardé.

## Conséquences

- Production : `VITE_MEDIA_WEBRTC_URL=https://simracedemo-dependencies-…sslip.io`. Le HLS ne
  marche en https qu'après avoir exposé le port 8888 de MediaMTX sur un second domaine https dans
  l'hébergeur, puis renseigné `VITE_MEDIA_HLS_URL`.
- Les variables `VITE_*` sont figées au build : les changer demande de reconstruire le front.
- Le CORS de MediaMTX doit accepter l'origine du front (c'est le cas : il renvoie l'origine
  reçue).
- Le média WebRTC lui-même passe en UDP (ICE, port 8189) et n'est pas concerné par le contenu
  mixte. Pour un accès depuis Internet, `webrtcAdditionalHosts` de MediaMTX doit contenir
  l'adresse publique du serveur (décision 0019).
