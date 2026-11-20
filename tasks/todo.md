# Apogée — suivi

Spec : `docs/superpowers/specs/2026-11-19-apogee-design.md`

## Plan 1 — Fondations et cave manuelle
Détail : `docs/superpowers/plans/2026-11-19-apogee-p1-fondations-cave.md`

- [x] Task 1 : squelette du projet
- [x] Task 2 : schéma de données
- [x] Task 3 : authentification et foyers
- [x] Task 4 : design system (taste-skill:design-taste-frontend)
- [x] Task 5 : écrans compte et administration
- [x] Task 6 : lieux
- [x] Task 7 : phases et validation de la fenêtre
- [x] Task 8 : vins
- [x] Task 9 : opérations de stock idempotentes
- [x] Task 10 : ajout d'un vin et fiche vin
- [x] Task 11 : « Quoi ouvrir », Cave et « Bue »
- [x] Task 12 : Docker et documentation
- [x] Task 13 : workflows CI/CD écrits
- [ ] Task 13 step 6 : créer Gavark/apogee, pousser, PR (en attente d'accord)
- [x] Vérification finale (revue de branche + vague de corrections)

## Plans suivants (à rédiger après le plan 1)
- [ ] Plan 2 : analyse IA de l'étiquette
- [ ] Plan 3 : notifications (phases + rappel mensuel)
- [ ] Plan 4 : réseau intermittent et resynchronisation

## Revue (plan 1, 2026-11-20)
- 13 tâches, chacune relue (spec + qualité) ; 6 boucles de correction ; revue finale de branche (opus) puis une vague de 13 corrections relue.
- `npm test` 294/294, `npm run check` 0 erreur, `npm run build` OK, image Docker construite et testée (healthz, redirection /setup).
- Décisions prises en cours de route : inscription sur invitation uniquement (pas de DISABLE_SIGNUP) ; ADDRESS_HEADER/XFF_DEPTH dans compose (derrière Caddy) ; fuseau des nouveaux comptes = TZ de l'instance ; job de test avant publication de l'image.
- À reprendre au début du plan 4 : aligner la longueur max de « précision » (200 à l'ajout, 100 au déplacement) ; tests de rejeu supplémentaires (deux membres sur un même lot).
- Petites dettes notées : doublons de code (upsert de lot, liste des couleurs, parsing d'id, statut d'invitation), pas d'UI de fuseau horaire, lots à 0 masqués sur la fiche.
