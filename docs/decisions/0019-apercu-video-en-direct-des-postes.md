# 0019 Aperçu vidéo en direct des postes : OBS, MediaMTX, FastAPI

Statut : Acceptée, **prévue pour plus tard, non implémentée**. Date : 2026-10-12.

## Contexte

Un opérateur de centre veut voir l'écran du pilote à côté de sa télémétrie. Il faut un retard
faible (moins d'une seconde) pour que l'image et les courbes restent cohérentes, sans alourdir le
PC de jeu ni l'agent Python (`httpx` seulement, décision 0002).

Le développement se fait aujourd'hui sur macOS, sans ACC ni PC de jeu Windows à disposition : la
chaîne vidéo ne peut pas être montée ni vérifiée de bout en bout maintenant. Elle est donc décidée
ici et reportée.

Options étudiées :

| Techno | Retard | Verdict |
|---|---|---|
| MJPEG sur HTTP, captures périodiques | 0,1 à 2 s | Gardé pour les vignettes basse résolution, pas pour le direct |
| RTMP/SRT vers HLS ou LL-HLS | 1 à 6 s | Trop lent pour suivre la télémétrie, gardé en secours |
| **WebRTC (WHIP en entrée, WHEP en sortie)** | 0,1 à 0,5 s | **Retenu** |
| WebSocket + images, WebCodecs | variable | Écarté : on réécrirait WebRTC en moins bien |
| Media over QUIC, WebTransport | faible | Écarté : pas encore mûr |

## Décision

```
OBS (sim-1) --WHIP--> MediaMTX <--auth (POST)-- FastAPI --video_url--> React
                         '-------------------WHEP----------------------^
```

- **Poste de jeu : OBS Studio** publie en WHIP (service `WHIP`, serveur
  `http://<mediamtx>:8889/<station_id>/whip`). Encodage matériel (NVENC) pour ne pas pénaliser le
  jeu. Le chemin du flux est le `station_id` de l'agent : vidéo et télémétrie se rattachent au
  même poste sans table de correspondance. Rien n'est ajouté à l'agent Python.
- **Serveur média : MediaMTX** (un binaire, image Docker). Il reçoit le WHIP et ressort le même flux
  en WebRTC (`/<station_id>/whep`) et en HLS (secours). Il ne contient aucune logique métier.
- **FastAPI** ne transporte jamais la vidéo. Il :
  - expose l'URL de lecture de chaque poste (champ `video_url` dans l'état des postes, ou route
    dédiée) ;
  - décide qui peut publier ou lire : MediaMTX est configuré avec `authMethod: http` et
    `authHTTPAddress` pointant vers une route FastAPI, appelée en POST à chaque publication ou
    lecture (`action`, `path`, `user`, `password`, `token`, `ip`, `protocol`...). Un statut `20x`
    autorise, tout autre refuse. Un poste inconnu ne peut pas publier ; un lien de lecture porte un
    jeton à durée limitée ;
  - peut signaler dans l'état du poste si le flux vidéo est actif ou non (API de MediaMTX).
- **Front** : un composant `<video>` qui négocie en WHEP avec `RTCPeerConnection`, flux complet
  seulement sur le poste sélectionné, vignettes basse résolution pour la grille des postes.

## Raisons

- WebRTC est la seule option mûre sous la seconde de retard dans un navigateur.
- OBS et MediaMTX font la capture, l'encodage et la diffusion : aucun code vidéo à écrire ni à
  maintenir, l'agent reste léger.
- MediaMTX donne WebRTC et HLS depuis la même source : un secours sans recoder.
- L'authentification déléguée garde la règle « le serveur ne fait pas confiance à l'agent » : c'est
  FastAPI qui connaît les postes et décide, MediaMTX applique.

## Conséquences

- Bande passante : compter 6 à 8 Mbit/s par poste en 1080p60. Pour plusieurs postes, flux complet
  sur un seul poste à la fois, vignettes ailleurs.
- Synchronisation image et télémétrie : les deux horloges diffèrent. Il faudra un repère commun
  (horodatage côté agent, décalage mesuré) avant d'afficher curseur et vidéo ensemble.
- Hors réseau local, WebRTC demande un serveur TURN.
- À vérifier au moment de l'implémentation, sur un vrai PC Windows avec ACC : impact de l'encodage
  sur les images par seconde du jeu, retard réel de bout en bout, configuration d'OBS par poste.
- Ajoute un service MediaMTX au futur `docker-compose`.
