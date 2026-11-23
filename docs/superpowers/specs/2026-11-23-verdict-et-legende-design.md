# Verdict à « Bue » et légende des phases : conception courte

## Intention

Apogée estime quand ouvrir chaque bouteille, mais rien ne dit aujourd'hui si ces fenêtres tombent juste. Le verdict donné en buvant (trop tôt, à point, trop tard) est la seule mesure de la promesse de l'appli. Il servira plus tard à calibrer les estimations. La légende rend l'écran principal lisible : l'ordre d'urgence des phases n'est pas évident (« Ne tardez plus » ou « À boire vite » ?).

Ces deux chantiers sont la priorité « maintenant » du conseil LLM du 2026-11-22.

## Objectifs / non-objectifs

- **Verdict.** Juste après « Bue », une fenêtre propose *Trop tôt · À point · Trop tard*, une note facultative et « Plus tard ». Le verdict se donne ou se corrige ensuite depuis l'historique de la fiche du vin. Il fonctionne hors ligne.
- **Légende.** Un bouton « ? » sur « Quoi ouvrir » ouvre la liste des phases dans l'ordre d'urgence, avec une phrase par phase.
- **Non-objectifs :**
  - la calibration des fenêtres à partir des verdicts ;
  - un bilan ou des statistiques ;
  - une note de qualité sur 5 : la colonne `rating` existe mais reste inutilisée ;
  - un rappel par notification.
- **Anti-objectifs :**
  - ralentir « Bue » : le geste part toujours en un appui, et le verdict vient après, facultatif ;
  - casser le hors-ligne.

## Approches (choix de l'utilisateur : n° 1)

1. **Choisie.** Verdict demandé juste après « Bue », modifiable ensuite depuis l'historique.
2. Verdict seulement depuis l'historique. Écartée : on oublierait de le donner.
3. Verdict juste après, sans modification possible. Écartée : on ne peut pas se raviser une fois la bouteille finie.

Le verdict est stocké dans une nouvelle colonne `consumptions.verdict` (`'early' | 'right' | 'late'`, nullable). `rating` n'est pas détourné : une note de qualité et un jugement de moment sont deux choses différentes.

## Comportement

### Verdict

- Après un « Bue » réussi ou mis en file, la fenêtre de verdict s'ouvre avec le nom du vin et son millésime. Elle est montée au niveau de l'application, comme le toast : quand la dernière bouteille est bue, le vin quitte la liste, mais la fenêtre reste.
- Un appui sur l'un des trois choix enregistre le verdict, avec la note si elle est saisie, et ferme la fenêtre. « Plus tard », ou une fermeture, n'enregistre rien. Le toast d'annulation de « Bue » reste disponible.
- Le verdict est envoyé comme un nouveau geste de stock `review`, dans la même file que les autres (hors ligne compris). Juste après « Bue », il vise le geste de consommation par son `opId`, car l'identifiant en base n'existe pas encore hors ligne. Le serveur retrouve la consommation grâce au résultat enregistré dans `applied_ops`. Depuis l'historique, il vise directement l'identifiant de consommation. Si la consommation n'existe plus (« Bue » annulé), le geste est rejeté sans bruit.
- Dans l'historique de la fiche, chaque bouteille bue affiche son verdict et sa note, avec un bouton pour donner ou corriger le verdict, qui rouvre la même fenêtre pré-remplie. Un nouvel envoi remplace le verdict précédent.
- La note fait au plus 200 caractères (`MAX_TEXT_LEN`). Elle est facultative et vide par défaut.
- Seuls les membres du foyer peuvent modifier ses consommations, avec le même contrôle que les autres gestes.

### Légende

- Le bouton « ? » se trouve à côté du titre « Quoi ouvrir ». Il reste toujours visible, même sans puces, et a une étiquette accessible « Comprendre les phases ».
- La fenêtre liste les 6 phases dans l'ordre `HOME_SECTION_ORDER`. Chaque ligne affiche son `PhaseBadge` et une phrase :
  - Ne tardez plus : la fenêtre est dépassée, buvez-le sans attendre ;
  - À boire vite : son apogée est passée, ou c'est la dernière année de sa fenêtre ;
  - À l'apogée : le meilleur moment pour l'ouvrir ;
  - Prêt : bon à boire, il peut encore progresser ;
  - Patience : trop jeune, il s'ouvre à partir de l'année indiquée ;
  - À estimer : pas encore de fenêtre, saisissez-la ou demandez une estimation à l'IA.
- Elle fonctionne hors ligne, car tout le texte est dans la page.

## Contraintes

- Les textes doivent exister en FR et en EN. Le test de complétude des messages l'impose.
- La migration Drizzle est additive : une colonne nullable.
- Les gestes `review` passent par le même contrôle d'utilisateur que les autres gestes (`x-apogee-user`, verrou de synchronisation) et sont rejoués sans double effet, grâce à l'idempotence par `opId`.

## Laissé au constructeur

- La forme exacte de la fenêtre et le style du bouton « ? », à aligner sur `Sheet` et sur les badges existants.
- Le nom du module d'état qui ouvre la fenêtre de verdict, sur le modèle de `toast.svelte.ts`.
