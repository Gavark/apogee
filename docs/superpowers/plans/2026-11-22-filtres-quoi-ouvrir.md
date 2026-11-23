# Filtres par phase sur « Quoi ouvrir » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ajouter sur « Quoi ouvrir » une rangée de puces (*Tout* + une par phase présente) qui n'affiche qu'une section à la fois, sans réseau.

**Architecture :** filtrage purement côté client dans `src/routes/app/+page.svelte`, sans toucher à l'adresse ni au chargeur serveur. La logique de sélection est une fonction pure testée dans `src/lib/home-filter.ts`. Les puces réutilisent `PhaseBadge`.

**Tech Stack :** SvelteKit 3 / Svelte 5 (runes), Paraglide (messages `messages/fr.json` et `messages/en.json`), Vitest (`tests/**/*.test.ts`, environnement node).

**Spec :** `docs/superpowers/specs/2026-11-22-filtres-quoi-ouvrir-design.md`

## Global Constraints

- Ordre des puces = `HOME_SECTION_ORDER` (`src/lib/phase.ts`) : past, last_call, peak, ready, too_young, unknown, limité aux phases présentes.
- Un seul choix à la fois. *Tout* par défaut. Toucher la puce active revient à *Tout*.
- Aucune modification de l'URL, de `+page.server.ts` ni de `_logic.ts` : la page doit rester servie hors ligne.
- Les puces sont des `<button type="button">` avec `aria-pressed`, d'une hauteur d'au moins `var(--tap)`, regroupées dans un conteneur `role="group"` avec un `aria-label`. La rangée ne passe pas à la ligne : elle défile horizontalement (`overflow-x: auto`).
- Textes FR et EN obligatoires pour chaque nouvelle clé : le test `tests/i18n/messages-completeness.test.ts` l'impose.
- Base de données : **ne jamais lancer le serveur de dev sur `./data/apogee.sqlite`**, qui est la base de production montée par Docker. Pour un essai manuel, utilisez `DATABASE_PATH` vers un fichier temporaire.

## Review Focus

1. Gestes hors ligne : `sections` est déjà recalculé avec `applyPending`. Le filtre s'applique *après*, et le total doit suivre les bouteilles affichées.
2. La phase choisie disparaît (dernier vin bu) → la page revient à *Tout* sans état bloqué (couvert par `activePhase`).
3. Une seule phase présente, ou une cave vide → aucune rangée de puces.
4. *Patience* filtrée → la section s'affiche dépliée (`<section>`, pas `<details>`).
5. Écran étroit (375 px) avec 6 puces → défilement horizontal, sans débordement de la page.

---

### Task 1 : filtre par phase sur « Quoi ouvrir »

**Files :**
- Create : `src/lib/home-filter.ts`
- Create : `tests/lib/home-filter.test.ts`
- Modify : `src/routes/app/+page.svelte`
- Modify : `messages/fr.json`, `messages/en.json`

**Interfaces :**
- Consumes : `Phase` (`$lib/phase`), les sections `{ phase: Phase; rows: CellarRow[] }[]` déjà calculées dans la page.
- Produces :
  - `activePhase(sections: { phase: Phase }[], selected: Phase | null): Phase | null` renvoie `selected` s'il fait partie des sections, sinon `null` (= *Tout*).
  - `visibleSections<S extends { phase: Phase }>(sections: S[], active: Phase | null): S[]` renvoie toutes les sections si `active` vaut `null`, sinon la seule section de cette phase.

- [ ] **Step 1 : écrire le test qui échoue** (`tests/lib/home-filter.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { activePhase, visibleSections } from '../../src/lib/home-filter';

const s = (phase: string) => ({ phase }) as { phase: import('../../src/lib/phase').Phase };
const sections = [s('last_call'), s('peak'), s('too_young')];

describe('activePhase', () => {
  it('keeps a selected phase that is present', () => expect(activePhase(sections, 'peak')).toBe('peak'));
  it('falls back to all when nothing is selected', () => expect(activePhase(sections, null)).toBeNull());
  it('falls back to all when the selected phase has gone', () => expect(activePhase(sections, 'ready')).toBeNull());
});

describe('visibleSections', () => {
  it('shows everything for null', () => expect(visibleSections(sections, null)).toEqual(sections));
  it('shows only the active phase', () => expect(visibleSections(sections, 'too_young')).toEqual([s('too_young')]));
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue.** `npx vitest run tests/lib/home-filter.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémenter `src/lib/home-filter.ts`** (les deux fonctions ci-dessus, pures, sans dépendance au framework).

- [ ] **Step 4 : relancer le test.** Même commande → PASS.

- [ ] **Step 5 : ajouter les messages** dans `fr.json` et `en.json`, près de `home_total` :
  - `home_filter_label` : « Filtrer par phase » / « Filter by phase » (aria-label du groupe) ;
  - `home_filter_all` : « Tout » / « All » ;
  - `home_total_filtered` : pluriel sur `count`, avec l'entrée `total`, sur le modèle de `home_total`. FR : « {count} bouteille sur {total} » / « {count} bouteilles sur {total} ». EN : « {count} bottle of {total} » / « {count} bottles of {total} ».

- [ ] **Step 6 : brancher la page** `src/routes/app/+page.svelte`
  - `let selected = $state<Phase | null>(null)`, `const active = $derived(activePhase(sections, selected))`, `const shown = $derived(visibleSections(sections, active))`.
  - Au clic sur une puce, `selected` prend la phase de la puce, ou `null` si elle était déjà active. La puce *Tout* remet `selected` à `null`.
  - Rangée affichée seulement si `sections.length > 1`, entre l'en-tête et les sections. Chaque puce contient `<PhaseBadge phase>` et le nombre de vins (`section.rows.length`). La puce active est mise en évidence (bordure ou fond d'accent) en plus de `aria-pressed`.
  - Boucle `{#each shown ...}` au lieu de `sections`. `too_young` reste en `<details>` uniquement quand `active === null`, sinon il passe par la branche `<section>`.
  - En-tête : `home_total({ count: total })` sans filtre. Avec un filtre : `home_total_filtered({ count: <bouteilles de shown>, total })`.

- [ ] **Step 7 : vérifier.** `npm run check` → 0 erreur. `npx vitest run` → tout passe.

- [ ] **Step 8 : committer.**

```bash
git add src/lib/home-filter.ts tests/lib/home-filter.test.ts src/routes/app/+page.svelte messages/fr.json messages/en.json
git commit -m "feat(accueil): filtres par phase sur « Quoi ouvrir »"
```

## Vérification finale

- [ ] Essai dans le navigateur avec une base temporaire (`DATABASE_PATH` dans le scratchpad), à 375 px : puces, filtre, retour à *Tout*, *Patience* dépliée, mode hors ligne.
- [ ] Dependabot : alertes ouvertes (`gh api repos/Gavark/apogee/dependabot/alerts --jq '[.[]|select(.state=="open")]|length'`), PR Dependabot ouvertes, `npm audit`. Corriger ce qui est corrigible.
