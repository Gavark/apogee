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
- [x] Task 13 step 6 : dépôt Gavark/apogee créé, PR #1 fusionnée, image GHCR publiée
- [x] Vérification finale (revue de branche + vague de corrections)

## Plan 2b — Sauvegarde automatique
Détail : `docs/superpowers/plans/2026-11-20-apogee-p2b-sauvegarde.md`
- [x] Task 1 : script `scripts/run-backup.sh` (paire base + photos vérifiée, rotation)
- [x] Task 2 : conteneur `apogee-backup`, doc, essai réel (sauvegarde, rotation, restauration)
- [x] Task 3 : copie vers Google Drive (`scripts/sync-backups-offsite.ps1`), tâche `\Apogee\Backup vers Google Drive` à 23:15 vers `G:\Mon Drive\Perso\Backup\Apogee`
- [x] Revue finale + corrections (fichiers `.partial`, échec visible si `apk` ou les sauvegardes s'arrêtent)
- [ ] Après le premier déploiement d'Apogée sur ce PC : vérifier `backups\sync-offsite.log` (lignes `OK:`)

## Plans suivants (à rédiger après le plan 1)
- [ ] Plan 2 : analyse IA de l'étiquette — `docs/superpowers/plans/2026-11-20-apogee-p2-ia-etiquette.md`
  - [x] Task 1 : contrat IA, normalisation, prompt
  - [x] Task 2 : connecteurs Anthropic / compatible OpenAI, config
  - [x] Task 3 : photos, analyses enregistrées, limite quotidienne
  - [x] Task 4 : API d'analyse, redimensionnement
  - [x] Task 5 : ajout par photo
  - [x] Task 6 : fiche — photo, provenance, ré-estimation
  - [x] Task 7 : admin IA, docs
  - [x] Vérification finale (revue de branche + 12 corrections relues)
  - [x] Essai réel avec une vraie clé : 1er appel refusé (400, enum + type tableau dans le schéma) → corrigé en anyOf ; étiquette de test Gigondas 2018 lue en 5,3 s (~1,4 ct) ; étiquette réelle Gevrey-Chambertin sans millésime lue en 6,2 s (~1,8 ct), confiance faible justifiée
- [ ] Plan 3 : notifications — `docs/superpowers/plans/2026-11-20-apogee-p3-notifications.md`
  - [x] Task 1 : abonnements push et envoi
  - [x] Task 2 : suivi des phases
  - [x] Task 3 : résumé quotidien et rappel mensuel
  - [x] Task 4 : réglages, appareils, service worker
  - [x] Vérification finale (revue de branche + corrections relues ; push réel via FCM vérifié dans Chromium)
  - [ ] Essai sur le navigateur de l'utilisateur après déploiement
- [ ] Plan 4 : réseau intermittent — `docs/superpowers/plans/2026-11-20-apogee-p4-hors-ligne.md`
  - [x] Task 1 : file d'opérations, surcouche optimiste (+ précision max 100)
  - [x] Task 2 : envoi via la file, synchronisation
  - [x] Task 3 : service worker (lecture hors ligne, Background Sync, cloisonnement par compte)
  - [x] Task 4 : écrans réseau requis, docs, vérification hors ligne
  - [x] Vérification finale (revue de branche + 2 vagues de corrections relues ; deux essais hors ligne au navigateur)
  - [x] Dependabot : configuré (alertes, correctifs de sécurité, `dependabot.yml`), 0 alerte, `npm audit` 0
  - [ ] 6 PR Dependabot de mises à jour majeures à trancher (session dédiée)
  - [ ] Essai hors ligne sur le téléphone de l'utilisateur après déploiement (démarrage depuis l'icône sans réseau)

## Revue (plan 1, 2026-11-20)
- 13 tâches, chacune relue (spec + qualité) ; 6 boucles de correction ; revue finale de branche (opus) puis une vague de 13 corrections relue.
- `npm test` 294/294, `npm run check` 0 erreur, `npm run build` OK, image Docker construite et testée (healthz, redirection /setup).
- Décisions prises en cours de route : inscription sur invitation uniquement (pas de DISABLE_SIGNUP) ; ADDRESS_HEADER/XFF_DEPTH dans compose (derrière Caddy) ; fuseau des nouveaux comptes = TZ de l'instance ; job de test avant publication de l'image.
- À reprendre au début du plan 4 : aligner la longueur max de « précision » (200 à l'ajout, 100 au déplacement) ; tests de rejeu supplémentaires (deux membres sur un même lot).
- Petites dettes notées : doublons de code (upsert de lot, liste des couleurs, parsing d'id, statut d'invitation), pas d'UI de fuseau horaire, lots à 0 masqués sur la fiche.

## Revue (plan 2, 2026-11-20)
- 7 tâches relues une à une (6 boucles de correction), revue finale de branche (opus) puis 12 corrections relues.
- `npm test` 431/431, `npm run check` 0 erreur, `npm run build` OK. Parcours vérifiés au navigateur avec un faux fournisseur compatible OpenAI.
- Choix : modèle par défaut `claude-opus-5-5` (effort medium, max_tokens 16000, timeout 30 s, 1 nouvel essai), repli automatique `fallbacks: "default"`, sortie structurée JSON Schema (15/16 unions).
- Reste : essai réel avec la clé de l'utilisateur ; README à préciser (la limite compte aussi les réponses facturées inexploitables) ; petites dettes notées dans le ledger (alerte en double, URL se terminant par ?/#).

## Revue (plan 4, 2026-11-20)
- 4 tâches relues une à une (6 boucles de correction), revue finale de branche (opus), puis 7 corrections + 2 dernières, relues.
- `npm test` 708/708, `npm run check` 0 erreur, `npm run build` OK. Deux essais réels hors ligne (Chromium, base jetable) : lecture en cache + bandeau, démarrage depuis `/` sans réseau, « Bue » optimiste et resynchro sans doublon, annulation avant envoi et annulation différée conservée après fermeture, avertissement à la déconnexion, cache vidé et non servi à un autre compte.
- Choix : en-tête `x-apogee-user` refusé par le serveur (409) s'il ne correspond pas à la session ; annulation d'un geste déjà tenté = rejeu puis opération inverse ; délai de 4 s seulement à l'ouverture des pages ; `start_url` `/app` avec `id` `/`.
- Petites dettes notées : résultats de Background Sync non affichés si aucun onglet ouvert, déplacement hors ligne vers un emplacement non affiché, cache de pages sans limite, date du bandeau = dernier chargement en ligne, un geste rejeté indéfiniment (5xx) bloque la file.
