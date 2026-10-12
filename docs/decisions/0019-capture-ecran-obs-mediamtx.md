# 0019 Capture d'écran du jeu : OBS vers MediaMTX

Statut : Acceptée, flux vidéo non encore affiché dans le front. Date : 2026-10-12.

## Contexte

La télémétrie seule ne montre pas ce que voit le pilote. Le propriétaire veut capturer l'écran du
jeu sur le PC de jeu et pouvoir le revoir dans le navigateur, à côté des courbes.

## Décision

- **OBS Studio** sur le PC de jeu capture ACC (source « Capture de jeu ») et publie un flux par
  poste vers **MediaMTX**, lancé par `docker-compose.yml` (service `mediamtx`).
- Chemin du flux : `live/<station-id>` (minuscules, chiffres, tirets), le même identifiant que
  `--station-id` de l'agent.
- Entrées : RTMP (port 1935) ou SRT (UDP 8890). Sorties : WebRTC/WHEP (8889, faible latence) et HLS
  (8888, repli). API de contrôle sur 127.0.0.1:9997.
- Configuration dans `mediamtx/mediamtx.yml`. Aucune authentification : démo sur réseau local.

## Raisons

- MediaMTX est un seul binaire, sans code à écrire, et convertit RTMP/SRT en WebRTC et HLS.
- La vidéo ne passe pas par le serveur FastAPI : il garde son rôle (télémétrie validée).
- Le flux reste indépendant de la télémétrie : une coupure vidéo n'affecte pas l'intégrité des lots.

## Conséquences

- Réglage OBS : Paramètres > Diffusion > Service « Personnalisé », serveur
  `rtmp://<ip-du-serveur>:1935/live`, clé `sim-1`. Encodage x264 ou NVENC, GOP de 1 s, B-frames à 0,
  profil `baseline` ou `main` (WebRTC refuse certains profils).
- Lecture de test : `http://localhost:8889/live/sim-1` (WebRTC) ou `http://localhost:8888/live/sim-1` (HLS).
- Si le front est ouvert depuis un autre appareil, mettre l'IP du serveur dans `webrtcAdditionalHosts`.
- À faire plus tard : lecteur vidéo dans la page Direct (WHEP), et authentification avant tout
  usage hors réseau local.
