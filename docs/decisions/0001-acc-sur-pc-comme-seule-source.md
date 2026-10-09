# 0001 ACC sur PC est la seule source de la démo

Statut : Acceptée. Date : 2026-10-09.

## Contexte

La démo doit lire la télémétrie d'un jeu de course pendant une course. L'utilisateur possède un
PC avec Assetto Corsa Competizione (ACC) et Forza Motorsport 7, et une PS5. Les jeux examinés :

| Jeu | Données disponibles (d'après des sources communautaires, aucune officielle vérifiée) |
|---|---|
| Forza Motorsport 7 | UDP « Data Out » en clair, facile |
| Assetto Corsa (2014) | mémoire partagée et UDP |
| ACC (PC) | mémoire partagée Windows, plus une API de diffusion en UDP |
| ACC (PS5) | aucune télémétrie exposée |
| Gran Turismo 7 (PS5) | UDP chiffré (Salsa20), non officiel, déchiffrement communautaire |
| AC EVO | mémoire partagée depuis la version 0.6, pas d'UDP confirmé, version encore changeante |

## Décision

La démo ne supporte qu'**ACC sur PC**, lu par la mémoire partagée Windows.

## Raisons

- ACC est le jeu le plus lié à la compétition et aux centres de simulation, donc le plus crédible
  face au client.
- La mémoire partagée donne tout ce qu'il faut pour un pilote seul : pédales, vitesse, temps de
  tour, secteur, position normalisée sur le circuit.
- Elle n'est lisible qu'en local : cela impose un **agent sur chaque poste** envoyant à un serveur
  central, ce qui ressemble à l'architecture d'un centre de simulation.
- Forza, plus simple, a été écarté pour concentrer l'effort sur un seul jeu.

## Conséquences

- L'agent ne fonctionne que sous Windows (hors rejeu).
- L'architecture garde une séparation « source » (`sources/`) pour ajouter un autre jeu plus tard :
  Forza (UDP en clair) serait le plus simple ; GT7 demanderait un déchiffrement non officiel ; ne
  pas utiliser AC EVO tant que sa télémétrie n'est pas stable.
- L'API de diffusion UDP d'ACC (autres voitures, classement) est reportée à une version ultérieure.
