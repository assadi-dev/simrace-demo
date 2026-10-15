# 0021 Température des pneus à la place de la distance et de la vitesse moyenne

Statut : Acceptée. Date : 2026-10-15. Remplace la ligne « Distance et vitesse moyenne » de la
décision 0018.

## Contexte

La carte Vitesse de l'écran Direct montrait, à côté de la jauge, le rapport, une distance parcourue
et une vitesse moyenne calculées par le front (intégration de la vitesse), avec un bouton de remise
à zéro. Le propriétaire a demandé de les remplacer par la température des quatre pneus, lue dans ACC
(`tyre_temp_c`, décision 0013), présentée comme le widget pneus du jeu.

## Décision

- La carte Vitesse garde le rapport et affiche **Température des pneus** : quatre valeurs en °C,
  arrondies au degré, disposées comme la voiture vue de dessus (avant en haut), autour d'une icône
  dessinée en SVG. Une valeur absente s'affiche `n.d.`.
- La mini-carte est un composant réutilisable, `src/components/tyre-temps.tsx` (`TyreTemps`), qui
  reçoit les quatre valeurs et non un échantillon entier : elle servira aussi sur la page Live vidéo.
  La mise en forme est une fonction pure testée (`src/lib/tyres.ts`).
- Les icônes dessinées pour le projet sont rangées dans `src/shared/icons/`.
- La distance, la vitesse moyenne, leur calcul (`trip` dans l'historique d'un poste) et le bouton de
  remise à zéro sont supprimés.

## Raisons

- La température des pneus vient du jeu ; la distance et la moyenne étaient des valeurs déduites
  par le navigateur, moins parlantes pour un pilote ou un opérateur.
- La pression (psi) n'est pas affichée : le propriétaire a choisi la température.

## Conséquences

- Les températures des pneus n'ont été lues qu'à l'arrêt (décision 0013) : leur valeur en roulant
  reste à vérifier sur un vrai ACC.
