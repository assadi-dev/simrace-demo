# SimRace : design.md

Direction artistique du front SimRace (thème **Flame & Sand**). Ce fichier est la référence des tokens : chaque valeur ci-dessous existe en variable CSS dans `src/index.css` et en classe Tailwind v4 via `@theme inline`. Les composants shadcn/ui lisent ces variables, on ne code jamais une couleur en dur dans un composant.

Source : design system « Open MDM — Flame & Sand » (tokens.json, cible shadcn/ui + Tailwind v4), appliqué aux 4 écrans du wireframe SimRace (Postes, Direct, Intégrité, Leaderboard).

---

## 1. Principes

1. **Verre sur ambiance.** Le fond de l'app est toujours le dégradé `gradient-ambient`. Toutes les surfaces (en-tête, cartes, tableaux) sont du verre translucide (`card` + contour `card-border` de 1px). Jamais d'aplat blanc opaque, sauf les popovers.
2. **Une seule police, trois graisses.** Inter en 400, 500 et 600. Tout ce qui est grand (titres, valeurs) est en 600 avec un interlettrage resserré.
3. **Chiffres tabulaires partout.** `font-variant-numeric: tabular-nums` est posé sur le `body` : les chronos et les vitesses ne « dansent » pas quand ils changent.
4. **Un seul bouton sombre par zone.** L'action principale est en `ink` (Obsidian), le reste en `secondary` (verre dense) ou `ghost`.
5. **Un statut ne se lit jamais à la couleur seule.** Toujours pastille + libellé (+ icône Lucide quand la place le permet).
6. **Aucune donnée inventée.** Une valeur que l'API ne fournit pas s'affiche `n.d.` avec le badge `Phase 2`. Une valeur calculée par le front le dit dans son aide (« Calculée : … »).
7. **Icônes : Lucide uniquement** (`lucide-react`), trait 2px, 16–22px, couleur `currentColor`.

---

## 2. Couleurs

### 2.1 Primitives

| Token | Valeur | Rôle |
|---|---|---|
| `flame-50` | `#FFF6EC` | Primitive, pas d'usage direct |
| `flame-100` | `#FDE8D0` | → `primary-soft` |
| `flame-200` | `#F7D3A8` | Fin de `gradient-flame` |
| `flame-300` | `#F2B474` | Primitive |
| `flame-400` | `#EA903A` | → `ring`, milieu de `gradient-flame` |
| `flame-500` | `#E27100` | **Golden Flame** → `primary`, `chart-1` |
| `flame-600` | `#C15F00` | Primitive |
| `flame-700` | `#9E4A00` | → `primary-text` (texte et liens orange, surtitres) |
| `flame-800` | `#743806` | Primitive |
| `flame-900` | `#4F2805` | Primitive |
| `sand-0` | `#FFFFFF` | → `primary-foreground`, `ink-foreground` |
| `sand-50` | `#FEF7EC` | → `popover` |
| `sand-100` | `#FBF0DD` | Primitive |
| `sand-200` | `#F2EDE5` | Primitive |
| `sand-300` | `#E6DFD2` | = `ambient-mid`, repli de `background` |
| `sand-400` | `#D3CEC5` | Primitive |
| `sand-500` | `#A8A29A` | → `chart-other` |
| `sand-600` | `#87837E` | Primitive (trop faible pour un contour) |
| `sand-700` | `#66615A` | → `muted-foreground` |
| `sand-800` | `#3D3A36` | Primitive |
| `sand-900` | `#2D2C2A` | **Obsidian** → `ink` |
| `sand-950` | `#1F1C18` | → `foreground` |

### 2.2 Ambiance et verre

| Token | Valeur | Usage |
|---|---|---|
| `ambient-top` | `#D3D3D3` | Haut du fond (zone la plus grise : les contrastes y sont mesurés) |
| `ambient-mid` | `#E6DFD2` | Milieu du fond |
| `ambient-bottom` | `#FEEED2` | Bas du fond |
| `card` | `#FFFFFF47` (blanc 28 %) | En-tête, Card, conteneurs de tableau |
| `card-strong` | `#FFFFFF8C` (blanc 55 %) | Champs, en-tête de Table, pills, bouton `secondary`, mini-cartes internes |
| `card-border` | `#FFFFFF99` (blanc 60 %) | Contour 1px de toute surface de verre |
| `card-inner` | `#FFFFFF73` (blanc 45 %) | Mini-cartes posées dans une Card (stats de la jauge, températures). Ajout SimRace |

### 2.3 Sémantique (variables shadcn)

| Token | Valeur | Usage |
|---|---|---|
| `background` | `ambient-mid` | Repli à plat ; le `body` peint `gradient-ambient` par-dessus |
| `foreground` | `sand-950` `#1F1C18` | Texte courant, titres, valeurs |
| `card-foreground` | `foreground` | Texte dans une Card |
| `popover` | `sand-50` `#FEF7EC` | Menus, SelectContent (opaque) |
| `popover-foreground` | `sand-950` | |
| `primary` | `flame-500` `#E27100` | Accent, Checkbox/Switch actifs. Texte blanc dessus seulement ≥ 16px 600 |
| `primary-foreground` | `#FFFFFF` | |
| `primary-soft` | `flame-100` `#FDE8D0` | Fond d'icône, badge `default` |
| `primary-text` | `flame-700` `#9E4A00` | Liens, fil d'Ariane, surtitres « Source : … » |
| `secondary` | `card-strong` | Bouton et badge `secondary` |
| `secondary-foreground` | `sand-950` | |
| `muted` | `card-strong` | TabsList, ligne sélectionnée, en-tête de Table |
| `muted-foreground` | `sand-700` `#66615A` | Libellés, aides, unités |
| `subtle-foreground` | `#8C877F` | Graduations d'axe, placeholder. Jamais pour une info utile |
| `accent` | `card-strong` | Survol `ghost` / `outline` |
| `accent-foreground` | `sand-950` | |
| `destructive` | `danger-text` `#A91F2F` | Bouton destructif, texte d'erreur |
| `border` | `#1F1C1814` (encre 8 %) | Séparateurs de lignes, Separator |
| `border-strong` | `#1F1C1824` (encre 14 %) | Contour `outline`, encadrés pointillés « Notes » |
| `input` | `card-border` | Contour des Input / Select |
| `ring` | `flame-400` `#EA903A` | Focus clavier (`ring-ring/50`, 3px) |
| `ink` | `sand-900` `#2D2C2A` | **Nav active**, bouton principal, segment actif de ToggleGroup, pill de valeur |
| `ink-foreground` | `#FFFFFF` | Texte sur `ink` (14:1) |

### 2.4 Statuts

Chaque statut = pastille (`*`) + fond (`*-soft`) + texte (`*-text`). Toujours avec un libellé.

| Statut SimRace | Token | Pastille | Fond | Texte | Forme de pastille |
|---|---|---|---|---|---|
| En ligne | `success` | `#1FBF5E` | `#1FBF5E1F` | `#0B6E34` | rond plein |
| En pause | `warning` | `#E8A317` | `#E8A31724` | `#7F5300` | carré arrondi (2px) |
| Hors ligne | `danger` | `#E5484D` | `#E5484D1A` | `#A91F2F` | anneau 2px (rond vide) |
| Phase 2 / info | `info` | `#3B8FEF` | `#3B8FEF1A` | `#155CB2` | aucune (badge texte) |

La forme de la pastille change avec le statut : un daltonien les distingue sans la couleur.

### 2.5 Données et graphiques

| Token | Valeur | Usage |
|---|---|---|
| `chart-1` | `#E27100` | Série 1, pilote 1 sur la carte |
| `chart-2` | `#3B8FEF` | Série 2, pilote 2 |
| `chart-3` | `#12A091` | Série 3, pilote 3 |
| `chart-4` | `#8C3F8F` | Série 4, pilote 4 |
| `chart-other` / `chart-5` | `#A8A29A` | Au-delà de 4 séries |
| `chart-track` | `#F4E2CB` | Piste des barres de progression, segments éteints |
| `seq-1…4` | `#EA903A` `#D96C00` `#AA5400` `#743806` | Échelle séquentielle (magnitudes) |
| `delta-faster` | = `success-text` `#0B6E34` | **Delta positif = plus rapide** (préfixe `+`) |
| `delta-slower` | = `danger-text` `#A91F2F` | **Delta négatif = plus lent** (préfixe `−`) |
| `delta-equal` | = `muted-foreground` | Écart nul `0,000` |
| `flag-yellow` | `#E8C317` | Pastille « Drapeau jaune » (toujours avec le libellé) |

L'ordre des couleurs de pilote est fixe et suit l'ordre des postes, il ne tourne jamais.

---

## 3. Dégradés (4 autorisés)

| Token | Valeur | Usage |
|---|---|---|
| `gradient-ambient` | `linear-gradient(180deg, #D3D3D3 0%, #E6DFD2 50%, #FEEED2 100%)` | Fond du `body` uniquement (`bg-fixed`) |
| `gradient-flame` | `linear-gradient(90deg, #E27100 0%, #EA903A 55%, #F7D3A8 100%)` | Barre « position sur le tour », barres de part (rejets) |
| `gradient-flow` | `linear-gradient(90deg, #EB9629 0%, #C0A771 50%, #7DC1DE 100%)` | Graphes temporels (aires), jamais en aplat |
| Verre | `card` + `card-border` sur `gradient-ambient` | Toutes les surfaces |

**Jauge de vitesse segmentée** : 24 segments arrondis. Segments allumés : interpolation `#E27100 → #EE9A45` de gauche à droite. Segments éteints : `#F5CFA2 → #F8ECDD` (s'estompent vers la droite). Tokens : `gauge-on-from`, `gauge-on-to`, `gauge-off-from`, `gauge-off-to` (mélangés avec `color-mix`).

---

## 4. Typographie

Famille unique : `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Graisses : 400 / 500 / 600.

| Style | Taille / interligne | Graisse | Interlettrage | Usage SimRace | Classe utilitaire |
|---|---|---|---|---|---|
| `display` | 44 / 48 | 600 | −1.2px | (vitrine) | `text-display` |
| `metric` | 32 / 38 | 600 | −0.8px | Valeur de KPI, stats de la jauge | `text-metric` |
| `page-title` | 26 / 32 | 600 | −0.5px | h1 de page | `text-page-title` |
| `metric-sm` | 24 / 30 | 600 | −0.4px | Valeurs des cartes poste, régime sous la jauge | `text-metric-sm` |
| `brand` | 22 / 28 | 600 | −0.3px | « SimRace » dans l'en-tête | `text-brand` |
| `card-title` | 18 / 24 | 600 | −0.3px | Titre de Card, valeur de température | `text-card-title` |
| `nav` / `button` | 15 / 20 | 500 (600 actif) | 0 | Liens de nav, boutons | `text-nav` |
| `body` | 14 / 20 | 400 | 0 | Cellules de Table, descriptions | `text-sm` |
| `body-medium` | 14 / 20 | 500 | 0 | 1re colonne, titre de carte poste | `text-sm font-medium` |
| `label` | 13 / 18 | 500 | 0 | Libellé de KPI | `text-label` |
| `caption` | 13 / 18 | 400 | 0 | Sous-titres, métadonnées | `text-caption` |
| `table-head` | 12 / 16 | 500 | 0 | TableHead (`muted-foreground`) | `text-table-head` |
| `badge` | 12 / 16 | 600 | 0 | Badges de statut, pills | `text-badge` |
| `eyebrow` | 12 / 16 | 600 | 1.4px, MAJUSCULES | « Source : GET /stations », « Notes » (`primary-text`) | `text-eyebrow` |
| `meta` | 12 / 18 | 400 | 0 | Aides sous un KPI, notes de graphe | `text-meta` |
| `micro` | 11 / 14 | 600 | 0 | Compteurs, sous-libellés de cellule de lot | `text-micro` |
| `mono` | 13 / 18 | 400 | 0 | Codes serveur (`speed_kmh:less_than_equal`), run_id | `font-mono text-[13px]` |

Règle : les libellés de tableau, les pills et les chronos ne passent jamais à la ligne (`whitespace-nowrap`) ; un tableau trop large défile horizontalement dans son conteneur.

---

## 5. Espacements

Base Tailwind v4 : `--spacing: 4px`.

| Token | Valeur | Usage |
|---|---|---|
| `space-1` | 4px | Gap entre lignes de texte serrées |
| `space-1.5` | 6px | Pastille ↔ libellé de badge, chaîne des lots |
| `space-2` | 8px | Gap des pills, des mini-cartes, icône ↔ libellé |
| `space-2.5` | 10px | Padding vertical des mini-cartes de température |
| `space-3` | 12px | Gap interne de Card, cellules de Table (`p-3`) |
| `space-3.5` | 14px | Padding horizontal des mini-cartes |
| `space-4` | 16px | Padding des cartes internes, gap en-tête |
| `space-4.5` | 18px | Padding horizontal des boutons et liens de nav |
| `space-5` | 20px | **Gap entre Card**, padding des KPI |
| `space-6` | 24px | **Padding des Card et de la page** |
| `space-7` | 28px | Entre grandes sections |
| `space-8` | 32px | Gap horizontal de l'en-tête |

---

## 6. Rayons

| Token | Valeur | Usage |
|---|---|---|
| `radius-sm` | 10px | Items de Select / menu |
| `radius-md` | 14px | Input, Select, mini-cartes de température |
| `radius-lg` | 16px | Conteneur de Table, mini-cartes de la jauge, encadré Phase 2 |
| `radius-xl` | 20px | **Card**, KPI |
| `radius-2xl` | 22px | **En-tête de page** |
| `radius-3xl` | 28px | Grandes sections |
| `radius-full` | 999px | Badges, pills, boutons, liens de nav, barres de progression |
| `radius-cell` | 12px | Cellules de la chaîne des lots (52×52) |

---

## 7. Tailles et cibles

| Élément | Valeur |
|---|---|
| Cible tactile minimum | 44px de haut (boutons, liens de nav, pills cliquables) |
| Select / Input | 46px de haut |
| Segment de ToggleGroup | 38px dans un conteneur à padding 4px |
| Pastille de statut | 8×8px |
| Barre de progression | 8px de haut |
| Icône de mini-carte | 22px |
| Cellule de lot | 52×52px |
| Largeur de page | fluide, 1280–1440px de référence, gutter 24px (16px sous 640px) |

---

## 8. Composants (mapping shadcn/ui)

| Composant | Base shadcn | Spécificités SimRace |
|---|---|---|
| `AppHeader` | — | Verre `card`, `rounded-2xl`, `px-6 py-4`. Marque + nav en pills + indicateur de flux |
| Lien de nav | `Button` variant `ghost` / `ink` | Actif = `ink` + texte blanc 600 ; inactif = transparent 500 ; `rounded-full h-11 px-4.5` |
| `Card` | `Card` | Verre `card` + `border-card-border`, `rounded-xl`, `p-6`, `gap-3` ; pas d'ombre |
| `KpiCard` | `Card` | Libellé `label` muted, valeur `metric`, aide `meta` muted ; `p-5` |
| `StatusBadge` | `Badge` | Variants `success` / `warning` / `danger` avec pastille de forme distincte |
| `PhaseBadge` | `Badge` variant `info` | Texte « Phase 2 », sans pastille |
| `Button` | `Button` | Variants `ink` (principal), `secondary` (verre dense + contour), `ghost`, `outline`, `link` (`primary-text`) ; `rounded-full h-11 px-4.5 text-[15px] font-semibold` |
| Table | `Table` | Conteneur `card` `rounded-lg` `overflow-x-auto` ; en-tête `card-strong` `text-table-head` ; lignes séparées par `border` ; cellules `p-3` `whitespace-nowrap` |
| `ToggleGroup` | `ToggleGroup` | Conteneur verre `rounded-2xl p-1` ; item actif `ink` |
| `Select` | `Select` | `h-11.5 rounded-md bg-card-strong border-card-border` |
| `FlameProgress` | `Progress` | Piste `chart-track`, indicateur `gradient-flame`, `h-2 rounded-full` |
| `SpeedGauge` | — (SVG) | Demi-cercle 0–420 km/h, 24 segments ; valeur entière `metric` au centre ; régime `metric-sm` dessous ; carré 1:1 |
| `TrackMap` | — (SVG) | Tracé schématique (pas de coordonnées dans le flux) ; trait `border-strong` 16px ; points pilote `chart-n` cerclés de blanc ; carré = pause |
| `TemperatureChip` | — | Mini-carte `card-inner`, `rounded-md`, icône Lucide `thermometer` (air) / `route` (piste) en `primary-text` |
| `DeltaValue` | — | `+0,512` vert / `−1,203` rouge / `0,000` gris, `font-semibold` |
| Encadré « Notes » | — | `border border-dashed border-border-strong rounded-xl`, surtitre `eyebrow` |

---

Tailles de texte et `cn` : chaque taille ajoutée ici (`text-…`) doit aussi être déclarée dans `src/lib/utils.ts`, sinon la fusion de classes la prend pour une couleur et la supprime à côté de `text-muted-foreground`. Les composants importent `cn` depuis `@/lib/utils` (règle ESLint).

## 9. Icônes (Lucide)

| Usage | Icône |
|---|---|
| Température de l'air | `thermometer` |
| Température de la piste | `route` |
| En ligne | `circle-check` |
| En pause | `pause` |
| Hors ligne | `circle-alert` |
| Phase 2 / info | `info` |
| Drapeau | `flag` |
| Flux connecté | `radio` |

---

## 10. Accessibilité

- Texte courant ≥ 4,5:1 sur la zone la plus grise du fond (`ambient-top`). `muted-foreground` tient 4,6:1 sur `card`.
- Texte blanc sur `primary` (3,2:1) : seulement ≥ 16px semi-bold. Pour un bouton plein, préférer `ink`.
- `subtle-foreground` (2,7:1) : décoratif uniquement.
- Focus visible : `ring-[3px] ring-ring/50` sur tous les éléments interactifs.
- Graphiques SVG : `role="img"` + `aria-label` qui dit la valeur ; décor en `aria-hidden`.
- Statuts et deltas : toujours un signe ou un libellé en plus de la couleur.
