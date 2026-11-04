# Comité de lecture — Suivi des projets reçus

Application web autonome (HTML, CSS, JavaScript sans dépendance) pour suivre les projets reçus par un producteur cinéma / TV : fiches de lecture, filtres multi-critères, tri par date de réception, tableau croisé et flux mensuel.

## Contenu
- `index.html` — structure de l'interface
- `styles.css` — mise en forme (thèmes clair et sombre)
- `app.js` — logique : fiches, filtres, tri, tableau croisé, export/import
- `data.js` — listes de référence (formats, genres, statuts…) et 30 projets d'exemple fictifs

## Utilisation
- **En local** : ouvrez `index.html` dans un navigateur (double-clic). Aucune installation nécessaire.
- **En ligne** : déposez les quatre fichiers sur n'importe quel hébergement statique (Vercel, Netlify, GitHub Pages, OVH, serveur web…).

## Données
Les données sont conservées en mémoire pendant la session. Utilisez **Données → Exporter en JSON** pour sauvegarder, puis **Importer un JSON** à la prochaine ouverture. L'export CSV (séparateur `;`, compatible Excel) reprend les projets filtrés.

### Activer l'enregistrement automatique dans le navigateur (optionnel)
Pour un usage personnel hors de l'aperçu Perplexity, vous pouvez faire persister les données dans le navigateur. Dans `app.js`, remplacez :

```js
  let projects = seed();
  let dirty = false;
  const save = () => { dirty = true; };
```

par :

```js
  const KEY = "comite-lecture-v1";
  let projects;
  try { projects = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { projects = seed(); }
  let dirty = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(projects)); } catch { dirty = true; } };
```

Les données restent alors propres à ce navigateur et à cet ordinateur.

## Personnaliser
- Listes de formats, genres, statuts, avis, types d'expéditeur : `window.REF` dans `data.js`.
- Projets d'exemple : `window.SEED` dans `data.js` (vous pouvez vider le tableau : `window.SEED = [];`).
- Couleurs et polices : variables en tête de `styles.css` (polices Boska et Satoshi chargées depuis Fontshare).
