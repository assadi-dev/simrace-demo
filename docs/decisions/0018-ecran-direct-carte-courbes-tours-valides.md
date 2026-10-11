# 0018 Écran Direct : carte réelle, trace hors piste, courbes et tours valides

Statut : Acceptée. Date : 2026-10-11.

## Contexte

L'écran Direct (maquette 2) dessinait un tracé schématique et listait tous les tours. Le serveur
enregistre maintenant une carte de référence par circuit (décisions 0011 et 0012) et l'agent envoie
`x`, `z` et `is_valid_lap` (décisions 0011 et 0016). Le propriétaire a demandé : la vraie carte, une
trace d'une autre couleur quand la voiture n'est pas sur la piste, seulement les tours valides
d'ACC, les courbes uPlot et une remise à zéro de la distance et de la vitesse moyenne.

## Décision

- **Carte** : `GET /tracks/{circuit}/reference`, relue toutes les 60 s ; un 404 garde le tracé
  schématique. Le nom du circuit passe par `trackSlug`, copie de `Slug.from_untrusted` (le serveur
  refuse un nom non nettoyé). Dessin en mètres, `x` vers la droite, `z` vers le bas : vérifié sur
  les morceaux réels d'Imola, qui tourne alors dans le sens inverse des aiguilles d'une montre comme
  le vrai circuit (inverser `z` donne un miroir). La voiture est placée par `x`, `z`, sinon par
  `track_pos`.
- **Trace du tour en cours** : un point tous les 2 m, remise à zéro au passage de ligne (compteur ou
  bouclage de `track_pos`, comme le serveur). Un point est **hors piste** s'il est aux stands
  (`in_pit`) ou à plus de **12 m** de la trajectoire de référence (grille de 25 m pour chercher le
  segment le plus proche). Sur la piste : orange (`primary`) ; sinon `chart-2` à 50 % d'opacité.
- **Tours** : seuls les tours terminés avec `is_valid_lap` vrai sont listés ; le meilleur se compare
  à eux seuls. Le tour en cours reste en tête avec sa validité du moment. Le nombre de tours masqués
  (invalides ou validité non lue) est affiché.
- **Courbes** : uPlot, vitesse puis accélérateur et frein. Tampons circulaires de 60 s à 60 Hz par
  poste, hors de l'état React, redessinés à 20 images/s. Fenêtre 10, 30 ou 60 s dans l'URL
  (`?fenetre=`), bouton « Figer les courbes ». La pause n'ajoute rien, un trou de plus de 1 s coupe
  la ligne.
- **Distance et vitesse moyenne** : bouton de remise à zéro, propre au navigateur (rien n'est
  envoyé au serveur).

## Raisons

- La référence est un tour roulé, pas l'axe de la piste : une piste fait 12 à 15 m de large, une
  voiture sur le bord opposé à la trajectoire est donc à 12 m au plus. Au-delà, elle a quitté la
  piste. Le seuil est une constante (`OFF_TRACK_M`) facile à régler.
- ACC ne dit pas « hors piste » point par point : `is_valid_lap` passe à faux pour tout le reste du
  tour, il ne sert pas à colorer la trace.

## Conséquences

- Une roue hors piste (moins de 12 m) n'est pas détectée ; à régler sur un vrai jeu.
- Sans carte de référence, la trace n'est pas dessinée (les coordonnées n'ont pas d'équivalent sur
  le tracé schématique).
- Avec d'anciens enregistrements sans `is_valid_lap`, le tableau ne montre que le tour en cours.

## Complément : validité des tours plus robuste (2026-10-12)

Constat sur un vrai jeu : des tours avec virages coupés étaient affichés « Valide », et le plus
rapide d'entre eux devenait « Meilleur ». Lire `is_valid_lap` sur le seul dernier échantillon du
tour ne suffit pas. Le front (`src/features/direct/laps.ts`) applique maintenant deux règles :

- **Invalidité retenue** : un tour est invalide si un seul de ses échantillons a eu `is_valid_lap`
  à faux. Le passage de ligne est reconnu par le compteur ou par le bouclage de `track_pos` ; un
  nouveau passage ne compte qu'après la mi-tour (entre 0,5 et 0,9), ou si le compteur a déjà servi
  le précédent. Le tour de sortie des stands (non compté par ACC) ne contamine donc pas le premier
  tour lancé.
- **Contrôle par le meilleur temps d'ACC** : ACC ne retient que les tours valides dans
  `best_lap_ms`. Deux secondes après la ligne, un tour plus rapide que ce meilleur temps est
  invalide (« plus rapide que le meilleur d'ACC »). Un tour n'est listé qu'après ce contrôle ; si
  ACC n'a pas de meilleur temps (0), pas de conclusion.

Le tableau affiche le nombre de tours masqués par raison, pour vérifier ces règles sur un vrai jeu.
Non vérifié : qu'ACC ne compte vraiment que les tours valides dans `best_lap_ms`, et le moment où
il remet `isValidLap` à vrai. Le serveur ne se sert toujours pas de la validité pour accepter un
tour de référence.
