# Apogée — Plan 3 : notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prévenir chaque membre du foyer, par une notification push quotidienne au plus, quand des vins changent de phase (prêt, apogée, à boire vite, passé), et chaque mois tant qu'il reste des bouteilles à boire vite ou passées.

**Architecture:** On reprend les briques push de babysleep (`D:\Dev\Gavark\CalculateurSommeilBebe\src\lib\server\push\{vapid,subscribe,send}.ts`, `src/routes/api/push/*`, `src/lib/components/EnablePushButton.svelte`, handlers `push`/`notificationclick` du service worker). Une table `notification_log` mémorise, par vin, les phases déjà constatées (avec une date de détection et un indicateur « silencieux »). Un passage toutes les 10 minutes (`setInterval` dans `hooks.server.ts`) traite les utilisateurs pour qui il est au moins 18h locales et qui n'ont pas encore été traités ce jour local : il constate les nouvelles phases du foyer, compose un seul message (changements depuis le dernier envoi de cet utilisateur + rappel mensuel s'il est dû), l'envoie à ses appareils et note le traitement. Tout est rattrapable : si le serveur était éteint, le prochain passage reprend là où on en était.

**Tech Stack:** SvelteKit, SQLite/Drizzle, `web-push` (déjà en dépendance), Paraglide, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-apogee-design.md` §6.4 (et §6.3 pour les phases).

## Global Constraints

- Phases notifiées : `ready`, `peak`, `last_call`, `past` (jamais `too_young` ni `unknown`).
- **Au plus un push par utilisateur et par jour local**, à partir de **18h** dans le fuseau de l'utilisateur (`users.timezone`).
- Rappel mensuel : au premier traitement d'un nouveau mois local, si le foyer a au moins une bouteille en stock en `last_call` ou `past` ; message « Ce mois-ci, N bouteilles à ne pas oublier » citant les **2 à 3** plus urgentes ; rien si la liste est vide ; fusionné avec le résumé de phases le même jour.
- Préférences par utilisateur : changements de phase et rappel mensuel, **activés par défaut**.
- Création d'un vin, modification de sa fenêtre, application d'une estimation IA : la phase courante est enregistrée **sans push** (on ne notifie que les changements dus au temps qui passe).
- Premier passage pour un foyer existant (mise à jour vers ce plan) : toutes les phases courantes sont enregistrées en silencieux (pas de rafale de notifications).
- Seuls les vins **en stock** (bouteilles > 0) comptent.
- Le clic sur la notification ouvre `/app` (« Quoi ouvrir »).
- Clés VAPID générées une fois et stockées dans `app_config` (comme babysleep) ; `VAPID_SUBJECT` facultatif.
- Isolation : un utilisateur ne reçoit que les vins de son foyer ; un abonnement ne peut être supprimé que par son propriétaire.
- FR/EN, aucune chaîne visible en dur ; tests sans réseau (envoi injecté).

## Review Focus

1. **Serveur éteint pendant plusieurs jours** → au redémarrage après 18h, un seul push par utilisateur qui regroupe tous les changements survenus depuis son dernier envoi. → Task 3.
2. **Deux membres dans des fuseaux différents** → chacun reçoit son message à 18h chez lui, et aucun ne perd les changements constatés lors du passage de l'autre. → Task 3.
3. **Abonnement expiré** (le service push répond 404/410) → abonnement supprimé, les autres appareils reçoivent quand même. → Task 1.
4. **L'utilisateur modifie la fenêtre d'un vin** de sorte qu'il passe « à boire vite » → pas de notification pour ce changement. → Task 2.
5. **Mise à jour d'une instance qui a déjà 100 vins** → aucune notification de masse le premier soir. → Task 2.

---

### Task 1: Abonnements push et envoi

**Files:**
- Modify: `src/lib/server/db/schema.ts` (+ `pushSubscriptions` comme babysleep ; `users` + `notifyPhases` int défaut 1, `notifyMonthly` int défaut 1, `lastDispatchDate` texte null `YYYY-MM-DD`, `lastDispatchAt` int null, `lastMonthlyMonth` texte null `YYYY-MM`), migration générée
- Create: `src/lib/server/push/{vapid,subscribe,send}.ts` (transplantés), `src/routes/api/push/{subscribe,unsubscribe,vapid-public-key}/+server.ts`
- Test: `tests/server/push/{vapid,subscribe,send}.test.ts` (portés et adaptés)

**Interfaces:**
- `getVapidKeys(db): Promise<{ publicKey; privateKey }>`, `vapidDetails(keys)`.
- `registerSubscription(db, userId, { endpoint; p256dh; auth; userAgent })`, `listSubscriptionsForUser(db, userId)`, `revokeSubscription(db, userId, id): boolean`, `deleteSubscriptionByEndpoint(db, endpoint)`.
- `type PushPayload = { title: string; body: string; url: string; tag: string }`.
- `type PushSender = (sub: { endpoint; p256dh; auth }, payload: PushPayload, vapid) => Promise<{ statusCode: number }>` ; `sendToUser(db, userId, payload, sender = webPushSender): Promise<{ sent: number; dead: number; failed: number }>` — 404/410 → abonnement supprimé (`dead`), autre erreur → `failed` (journalisé sans détail), succès → `lastSeenAt` mis à jour.
- API : `POST /api/push/subscribe` (401 JSON sans session — pas de redirection —, 429 au-delà de 5/h par utilisateur+IP, 400 si `endpoint` non https / > 1024 caractères / clés manquantes, 204), `POST /api/push/unsubscribe` (`{ id }` ou `{ endpoint }`, seulement les abonnements de l'utilisateur), `GET /api/push/vapid-public-key` (texte).

- [ ] **Step 1: Porter les tests de babysleep** (`tests/server/push/{vapid,subscribe}.test.ts`) avec les fixtures d'Apogée ; écrire `send.test.ts` : envoi à deux abonnements, l'un 410 → supprimé et `dead: 1`, l'autre 201 → `sent: 1` ; erreur réseau → `failed`, abonnement conservé ; un utilisateur ne peut pas révoquer l'abonnement d'un autre.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Schéma + migration, transplanter, adapter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat(push): abonnements, clés VAPID, envoi`

---

### Task 2: Suivi des phases

**Files:**
- Modify: `src/lib/server/db/schema.ts` (+ `notificationLog` : `id`, `wineId` FK cascade, `phase` texte, `detectedAt` int, `silent` int défaut 0 ; unique `(wineId, phase)` ; index `(detectedAt)` ; `households` + `phaseScanDate` texte null `YYYY-MM-DD`), migration générée
- Create: `src/lib/server/notifications/phases.ts`
- Modify: `src/lib/server/wines.ts` (`createWine`, `updateWine`, `applyAiWindow` appellent `markCurrentPhaseSilently`)
- Test: `tests/server/notifications/phases.test.ts`, `tests/server/wines.test.ts`

**Interfaces:**
- `NOTIFIED_PHASES = ['ready', 'peak', 'last_call', 'past'] as const`.
- `markCurrentPhaseSilently(db, wineId: number, year: number): void` — si la phase courante est notifiable et absente du journal, l'insère avec `silent = 1`.
- `scanHouseholdPhases(db, householdId: number, year: number, today: string, now: number): { newEvents: number }` — une fois par jour (`households.phaseScanDate === today` → rien) : pour chaque vin **en stock** du foyer dont la phase courante est notifiable et absente du journal → insertion `silent = 0`, `detectedAt = now` ; **premier scan du foyer** (`phaseScanDate` nul) → insertions toutes `silent = 1` ; met `phaseScanDate = today`.
- `householdReferenceTimeZone(db, householdId): string` — fuseau du membre le plus ancien (plus petit `users.id`), défaut `Europe/Paris` ; sert à calculer l'année du scan.

- [ ] **Step 1: Écrire les tests**

```ts
it('premier scan d\'un foyer : tout est silencieux, aucun événement', …)
it('scan suivant, un vin passe ready → peak (année suivante) : un événement non silencieux', …)
it('un vin hors stock (0 bouteille) n\'est jamais compté', …)
it('deux scans le même jour : le second ne fait rien', …)
it('createWine / updateWine (fenêtre changée) / applyAiWindow enregistrent la phase courante en silencieux', …)
it('un vin modifié pour passer last_call aujourd\'hui ne produit pas d\'événement au scan', …)
it('phases too_young et unknown jamais enregistrées', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat(notifications): suivi des changements de phase`

---

### Task 3: Résumé quotidien et planification

**Files:**
- Create: `src/lib/server/notifications/digest.ts`, `src/lib/server/notifications/tick.ts`
- Modify: `src/hooks.server.ts` (`setInterval(…, 10 * 60 * 1000)` + un premier passage 60 s après le démarrage), `messages/{fr,en}.json`
- Test: `tests/server/notifications/{digest,tick}.test.ts`

**Interfaces:**
- `type Digest = { phaseCounts: Partial<Record<'ready'|'peak'|'last_call'|'past', number>>; monthly: { bottles: number; names: string[] } | null }`.
- `buildDigest(db, user: { id; householdId; notifyPhases; notifyMonthly; lastDispatchAt; lastMonthlyMonth }, monthKey: string, year: number): Digest | null` — `phaseCounts` = événements non silencieux du foyer avec `detectedAt > lastDispatchAt` (ou tous si nul) **et vin toujours en stock**, si `notifyPhases` ; `monthly` si `notifyMonthly`, `lastMonthlyMonth !== monthKey` et au moins une bouteille `last_call`/`past` en stock (nombre de **bouteilles**, 2 à 3 noms les plus urgents : `past` d'abord, puis `drinkUntil` croissant) ; `null` si les deux sont vides.
- `formatDigest(d: Digest, locale: 'fr'|'en'): PushPayload` — titre « Apogée », corps qui énumère les phases (« 3 vins entrent à leur apogée, 1 est à boire vite ») puis le rappel (« Ce mois-ci, 4 bouteilles à ne pas oublier : Chinon 2016, Gigondas 2018… ») avec les pluriels Paraglide, `url: '/app'`, `tag: 'apogee-daily'`.
- `runNotificationTick(db, now: Date, sender?: PushSender): Promise<{ processed: number; sent: number }>` — pour chaque utilisateur qui a au moins un abonnement et dont l'heure locale est ≥ 18 et `lastDispatchDate !== aujourd'hui local` : `scanHouseholdPhases` (année et date du fuseau de référence du foyer), `buildDigest`, `sendToUser` si non nul, puis **dans tous les cas** `lastDispatchDate = aujourd'hui`, `lastDispatchAt = now`, et `lastMonthlyMonth = monthKey` si le rappel a été inclus. Un utilisateur sans abonnement n'est pas traité (ses changements restent en attente jusqu'à son premier abonnement — voir Review Focus 1 : on ne lui « vole » rien).
- Erreurs : une exception sur un utilisateur est journalisée (nom d'erreur seulement) et n'empêche pas les autres.

- [ ] **Step 1: Écrire les tests** (horloge injectée, `sender` simulé)

```ts
it('17h59 locales : rien ; 18h00 : un push', …)
it('deux passages le même soir : un seul push', …)
it('serveur éteint 3 jours : un seul push qui regroupe les changements des 3 jours', …)
it('deux membres, Paris et Montréal : chacun à 18h locales, le second reçoit aussi les changements constatés au passage du premier', …)
it('1er du mois avec 2 bouteilles past : rappel inclus, fusionné avec les phases ; le lendemain plus de rappel', …)
it('mois où le serveur était éteint le 1er : rappel au premier passage du mois', …)
it('rappel : rien si aucune bouteille last_call/past ; noms limités à 3, past d\'abord', …)
it('préférences : phases désactivées → seulement le rappel ; rappel désactivé → seulement les phases ; les deux → rien', …)
it('vin bu entre la détection et l\'envoi (0 bouteille) → non compté', …)
it('formatDigest FR/EN et pluriels (1 vin / 3 vins, 1 bouteille / 4 bouteilles)', …)
it('erreur sur un utilisateur → les autres sont traités', …)
```

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter + brancher dans `hooks.server.ts`.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`.
- [ ] **Step 5: Commit** — `feat(notifications): résumé quotidien et rappel mensuel`

---

### Task 4: Interface et service worker

**Files:**
- Create: `src/routes/account/notifications/+page.{svelte,server.ts}`, `src/routes/account/notifications/_logic.ts`, `src/lib/components/EnablePushButton.svelte` (transplanté, restylé)
- Modify: `src/service-worker/index.ts` (handlers `push` et `notificationclick` comme babysleep, sans la logique « onglet focalisé » propre aux bébés : on affiche toujours la notification), `src/routes/account/+page.svelte` (carte « Notifications »), `messages/{fr,en}.json`, `README.md`
- Test: `tests/server/account-notifications.test.ts`

**Interfaces:**
- `_logic.ts` : `getNotificationSettings(db, userId) → { notifyPhases: boolean; notifyMonthly: boolean; devices: { id; userAgent; createdAt; lastSeenAt }[] }`, `saveNotificationSettings(db, userId, { notifyPhases, notifyMonthly })`, `sendTestNotification(db, userId, locale, sender?)` → `{ sent; dead; failed }`.
- Page `/account/notifications` : bouton d'activation (états : non supporté, refusé, inactif, actif ; sur iOS hors appli installée : message « Installez Apogée sur l'écran d'accueil pour recevoir les notifications »), deux interrupteurs (phases, rappel mensuel), liste des appareils avec « Retirer », bouton « Envoyer une notification de test » (limité à 3 par heure), explication courte de l'heure d'envoi (18h, fuseau du compte).
- README : section « Notifications » (HTTPS obligatoire, iOS 16.4+ après installation sur l'écran d'accueil, envoi à 18h, `VAPID_SUBJECT` facultatif dans le tableau de configuration et le compose).

- [ ] **Step 1: Écrire les tests** : réglages par défaut activés ; enregistrement des interrupteurs ; liste limitée aux appareils de l'utilisateur ; test de notification avec `sender` simulé ; limite 3/h.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter page, composant, service worker, docs.** **Step 4: Lancer** — PASS ; `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Vérification navigateur** (Chromium via Playwright ou le navigateur intégré, `npm run dev` avec une base jetable) : activer les notifications (accorder la permission), vérifier l'abonnement en base, « Envoyer une notification de test » → la notification s'affiche (ou, si l'environnement ne peut pas afficher de notification système, vérifier le passage par le handler `push` via `self.registration.getNotifications()`), désactiver un interrupteur et recharger.
- [ ] **Step 6: Commit** — `feat(notifications): réglages, appareils, service worker`

---

## Vérification finale

- [ ] `npm test`, `npm run check`, `npm run build` ; CI verte.
- [ ] **Essai réel sur ce PC (avec l'accord de l'utilisateur)** : Apogée lancé sur `http://localhost` (les navigateurs acceptent le push sur localhost), compte réglé sur un fuseau où il est déjà plus de 18h, un vin en stock dont la phase notifiable n'est pas encore dans `notification_log` (insertion directe en base), `lastDispatchDate` vide ; au passage suivant, une notification « Apogée » arrive dans le navigateur du PC et son clic ouvre « Quoi ouvrir ».
- [ ] `tasks/todo.md` mis à jour.
