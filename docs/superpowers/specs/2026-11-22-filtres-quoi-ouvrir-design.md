# Filtres par phase sur « Quoi ouvrir » — conception courte

## Intention

« Quoi ouvrir » liste toutes les bouteilles en stock, groupées par urgence. L'utilisateur veut pouvoir n'afficher qu'une phase à la fois (au minimum À boire vite, À l'apogée, Prêt) pour choisir plus vite.

## Objectifs / non-objectifs

- **Objectif :** une rangée de puces en haut de la page : *Tout* puis une puce par phase présente dans la cave, dans l'ordre des sections (Ne tardez plus, À boire vite, À l'apogée, Prêt, Patience, À estimer). Chaque puce porte le nombre de vins de la phase.
- **Non-objectifs :** pas de filtre couleur, emplacement ou recherche ici (la Cave les a déjà). Pas de mémorisation du choix entre deux visites.
- **Anti-objectif :** que le filtre casse le hors-ligne ou demande le réseau.

## Approches

1. **Filtre côté page, sans changer l'adresse (choisi).** Instantané, fonctionne hors ligne : la copie hors ligne de la page est indexée par adresse, donc une adresse inchangée reste servie.
2. Filtre dans l'adresse (`?phase=`), comme la Cave. Écarté : chaque changement recharge la page et l'adresse filtrée n'a pas de copie hors ligne.

## Comportement

- Choix cumulatifs (révision du 2026-11-22) : chaque puce s'active ou se désactive séparément, et plusieurs phases peuvent s'afficher ensemble, dans l'ordre des sections. *Tout* est sélectionné par défaut, et le toucher vide la sélection. Désactiver la dernière puce active revient aussi à *Tout*.
- Une phase filtrée n'affiche que sa section. *Patience* s'affiche alors dépliée, et non repliée.
- Le compteur « N bouteilles » de l'en-tête suit le filtre.
- Une phase choisie qui disparaît (dernier vin bu ou vin passé à une autre phase) sort de la sélection. S'il ne reste aucune phase choisie, la page revient à *Tout*.
- Les puces ne s'affichent pas quand la cave ne contient qu'une seule phase, ni quand elle est vide.
- Les gestes en attente (hors ligne) restent appliqués comme aujourd'hui : on filtre les sections déjà recalculées.
- Accessibilité : chaque puce est un bouton avec `aria-pressed`. Sur mobile, la rangée défile horizontalement au lieu de passer à la ligne.
- Textes : FR et EN. Il faut « Tout » / « All », l'étiquette du groupe de puces pour les lecteurs d'écran, et « N bouteilles sur M » quand un filtre est actif (« en cave » n'a plus de sens pour une partie seulement). Les puces réutilisent les libellés de phase existants.

## Laissé au constructeur

- L'emplacement exact du code de filtrage. Choix proposé : une fonction pure testée, appelée par la page.
- Le style des puces, à aligner sur les badges de phase existants (`PhaseBadge`).
