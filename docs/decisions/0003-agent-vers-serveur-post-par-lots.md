# 0003 Agent vers serveur : POST par lots numérotés

Statut : Acceptée. Date : 2026-10-09.

## Contexte

L'agent produit ~60 échantillons par seconde. La fiche de poste insiste sur la fiabilité des
données : intégrité, exactitude, traçabilité, reprise après erreur.

## Décision

L'agent envoie des **lots** (toutes les 200 ms par défaut) par `POST /ingest/batches`, pas par
WebSocket.

- Un lot contient `station_id`, `run_id`, `seq`, `session` et `samples`.
- `run_id` est généré à chaque démarrage de l'agent ; `seq` démarre à 1 et croît de 1 par lot.
- Le serveur répond par un accusé (`accepted` ou `duplicate`, nombres d'échantillons acceptés et
  rejetés).
- L'agent garde les lots non acquittés dans une file (500 maximum) et les renvoie dans l'ordre,
  avec un délai croissant (0,5 s jusqu'à 10 s). Une erreur 4xx (hors 408 et 429) abandonne le lot
  pour ne pas bloquer la file ; les erreurs réseau, 5xx, 408 et 429 sont réessayées.
- Côté serveur : `seq` déjà vu = doublon, acquitté sans être recompté ; `seq` en avance = les lots
  manquants sont comptés (`gaps`) mais le lot est accepté ; nouveau `run_id` = la numérotation
  repart de 1.

## Raisons

- Chaque lot est vérifiable et rejouable : accusé de réception, pas de doublon, pas de trou
  silencieux. Un flux WebSocket continu n'offre pas cela sans reconstruire un protocole.
- Plus simple à tester (requêtes HTTP ordinaires) et à rejouer.
- Coût : un peu plus de latence (~200 ms), acceptable pour une démo.

## Conséquences

- Le serveur doit retenir le dernier `seq` par poste. Aujourd'hui en mémoire, donc perdu au
  redémarrage du serveur (limite connue, à régler avec la persistance, voir décision 0008).
