# Ménage des photos orphelines et du cache de pages : conception courte

## Intention

Deux dettes connues (chantier n° 8 du conseil LLM du 2026-11-22) qui grossissent sans bruit : des photos d'étiquettes que plus rien n'utilise s'accumulent dans `data/photos/` (et dans chaque archive nocturne), et le cache de pages hors ligne du navigateur n'a pas de plafond. On les traite avant qu'elles ne posent problème, sans jamais risquer une photo encore utilisée ni le démarrage hors ligne.

## État actuel

**Photos.** Fichiers `<photosDir>/<householdId>/<uuid>.<jpg|png|webp>` (`src/lib/server/photos.ts`), `photosDir` = `PHOTOS_DIR` ou `dirname(DATABASE_PATH)/photos`. Deux colonnes y renvoient : `wines.label_photo` (la photo d'un vin) et `label_analyses.photo_path` (la photo envoyée à l'IA). Une photo est écrite **au moment de l'analyse** (`analyzeAndStore`), avant toute fiche ; elle n'est rattachée à un vin qu'à l'ajout (`createWine`, `addStock`) ou à l'application de la fenêtre IA (`applyAiWindow`), et jamais en remplacement d'une photo existante. Déjà bien géré : suppression d'un vin (fichier effacé s'il n'est plus utilisé par un autre vin) et suppression d'un foyer (dossier entier).

Une photo devient orpheline quand :

1. **l'ajout est abandonné** après l'analyse (cas le plus courant), ou la proposition IA n'est pas appliquée ;
2. **une nouvelle photo est analysée pour un vin qui en a déjà une** : elle ne peut jamais lui être rattachée ;
3. **l'insertion en base échoue** après l'écriture du fichier (`insertRow` lève) ;
4. **le nettoyage d'une suppression échoue** (`cleanupQuietly` journalise et continue).

Effet de bord trouvé : à la suppression d'un vin, `label_analyses.photo_path` garde le chemin du fichier effacé. Un ajout tardif à partir de cette analyse rattache alors un fichier absent (`hasPhoto` vrai, image en 404).

**Cache de pages.** `PAGE_CACHE` (`apogee-pages`) garde le HTML et le `__data.json` de `/app`, `/app/cave` (une entrée par combinaison de filtres) et `/app/wines/<id>`. Rien ne le borne : chaque vin consulté et chaque filtre ajoutent deux entrées, pour toujours. **La déconnexion le vide déjà** (`leaveActiveUser` sur la page Compte) ; un changement de compte aussi (`becomeActiveUser`). Rien à ajouter là, sinon un test qui le garantit déjà (`offline-session.test.ts`).

## Objectifs / non-objectifs

- **Corriger à la source** les cas 3 et le chemin mort : effacer le fichier si l'insertion de l'analyse échoue ; vider `label_analyses.photo_path` quand le fichier est effacé (suppression d'un vin, ménage).
- **Ménage quotidien** des photos orphelines restantes (cas 1, 2, 4), sûr et journalisé.
- **Plafond du cache de pages** avec éviction des plus anciennes.
- **Non-objectifs :** déplacer les photos, changer leur format, supprimer des lignes de `label_analyses`, un écran d'administration, un ménage manuel à la demande.
- **Anti-objectifs :** supprimer une photo encore référencée par un vin ; casser un ajout en cours ou une file hors ligne ; faire échouer la sauvegarde nocturne ; casser le démarrage hors ligne depuis l'icône.

## Approches pour le ménage des photos

1. **Choisie : dans l'appli, tâche quotidienne** sur le modèle du résumé du soir (`hooks.server.ts`) : un passage toutes les 10 minutes qui n'agit qu'une fois par jour local, **à partir de 14 h** (loin de la sauvegarde de 3 h et de celle lancée au démarrage du conteneur). L'appli connaît déjà les chemins, a la base en écriture, et better-sqlite3 + `fs` synchrones rendent le passage atomique vis-à-vis des requêtes : aucun ajout ne peut se glisser entre « non référencée » et « supprimée ».
2. Au démarrage seulement. Écartée : le conteneur peut tourner des semaines sans redémarrer.
3. Dans le conteneur `apogee-backup`, après une sauvegarde vérifiée. Séduisant (on n'efface qu'une photo déjà archivée), mais il faudrait monter `data/` en écriture, réécrire la règle « référencée » en shell, et une course avec l'appli qui rattache une photo au même moment reste possible. Écartée.

## Comportement du ménage

- Parcourt `<photosDir>/<n>/` (dossiers numériques) ; ne regarde que les fichiers au nom exact `uuid.ext` (`isSafeRelPath`). **Tout le reste est ignoré** (fichier inconnu, sous-dossier, lien).
- Une photo est supprimée seulement si : **aucun vin** ne la référence (`wines.label_photo`, tous foyers), **aucune analyse de moins de 7 jours** ne la référence, et le fichier a **plus de 7 jours** (mtime). 7 jours couvrent largement un ajout en cours ou un geste resté en file hors ligne.
- Après suppression : `label_analyses.photo_path` est remis à `NULL` pour ce chemin (un ajout très tardif crée alors la fiche sans photo plutôt qu'avec une image cassée).
- **Garde-fou** : si des fichiers existent mais qu'aucun vin ne référence la moindre photo (base vide ou mauvaise base montée), rien n'est supprimé et un avertissement est journalisé.
- **Journal** : une ligne `[photos] orphan removed: <foyer>/<uuid>.<ext>` par fichier, puis un bilan `[photos] sweep: N removed, M recent kept` (en anglais, comme les autres journaux serveur). Une erreur de fichier journalise son code et passe au suivant.
- **Sauvegardes** : une photo n'est supprimée qu'après 7 jours d'orphelinat, donc après ~7 archives nocturnes la contenant ; avec la rétention de 30 archives, elle reste récupérable un mois. Le ménage à 14 h ne croise pas la sauvegarde de 3 h ; si l'appli redémarre, le premier passage attend 10 minutes, la sauvegarde lancée au démarrage du conteneur est finie. `docs/BACKUP.md` gagne un paragraphe.

## Plafond du cache de pages

- **Par nombre d'entrées : 120** (environ 60 pages, HTML + données), plutôt que par âge : une copie ancienne d'une fiche reste utile hors ligne, alors que c'est le nombre qui grossit sans fin (une entrée par vin et par filtre).
- Chaque entrée stockée porte un en-tête `x-apogee-stored-at` (horodatage). Après chaque mise en cache, si le cache dépasse 120 entrées, les plus anciennes sont supprimées (sans en-tête = les plus anciennes).
- **Jamais évincées** : `/app` et `/app/__data.json`, la page d'arrivée de l'icône (`start_url`, et `/` redirigé vers `/app` hors ligne).
- Logique pure dans `page-cache.ts` (`entriesToEvict`), testée ; le service worker n'ajoute que l'horodatage et l'appel après `store()`. Rien d'autre n'y change (la file de gestes et le Background Sync appartiennent à la session `fix/file-gestes`).

## Laissé au constructeur

Découpage des fonctions, noms exacts, forme des tests. Aucun texte affiché à l'utilisateur, donc pas de message FR/EN à ajouter.
