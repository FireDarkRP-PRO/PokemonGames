# Jeux Pokémon

Site de mini-jeux Pokémon, 100 % statique, hébergé sur GitHub Pages. Chaque jeu se joue seul ou à plusieurs dans un salon multijoueur.

## Les jeux

| Catégorie | Jeux |
|---|---|
| Deviner | Silhouette, cri, image pixelisée, description du Pokédex, caractéristiques |
| Réflexion | Pokédle, plus ou moins, efficacité des types, intrus |
| Autre | Memory, « Lequel est le shiny ? », lien vers le Starter à l'aveugle |
| Multijoueur | Salon à code (PeerJS) : tout le monde joue aux mêmes questions, scores en direct |

## Arborescence

```
.
├── index.html                  Menu principal
├── README.md
├── Ressource/
│   ├── style.css               Style commun
│   ├── core.js                 Outils partagés (données, aléatoire, sauvegarde, fin de partie)
│   ├── guess.js                Moteur des jeux « Deviner »
│   ├── qcm.js                  Plus ou moins, types, intrus, shiny
│   ├── pokedle.js              Pokédle
│   ├── memory.js               Memory
│   ├── multi.js                Salon multijoueur
│   └── pokemon.json            Données (à générer, voir ci-dessous)
├── main/
│   ├── deviner.html            Sous-menu Deviner
│   ├── deviner-*.html          Un fichier par jeu Deviner
│   ├── reflexion.html          Sous-menu Réflexion
│   ├── reflexion-*.html        Un fichier par jeu Réflexion
│   ├── autre-*.html            Memory et shiny
│   └── multi.html              Salon multijoueur
└── outils/
    └── generer_pokemon.py      Script qui génère pokemon.json
```

## Première utilisation : générer `pokemon.json`

Les jeux lisent `Ressource/pokemon.json`. Ce fichier n'est pas fourni : il se génère depuis [PokéAPI](https://pokeapi.co) avec Python 3.8 ou plus (aucune dépendance à installer).

```
python3 outils/generer_pokemon.py
```

Le script écrit directement dans `Ressource/pokemon.json` (compte quelques minutes). Relis le diff, puis commit le fichier.

À refaire quand de nouveaux Pokémon sortent (par exemple une nouvelle génération). La génération est complète à chaque fois et il n'y a pas de mise à jour automatique.

Pour chaque Pokémon, le fichier contient : numéro, nom français, génération, types, talents, taille, poids, total des stats, description du Pokédex, stade d'évolution, images (normale et shiny) et cri.

Le fichier contient aussi toutes les formes alternatives (Méga, régionales, Gigamax, etc.), chacune comme une entrée à part avec son propre nom, ses types et ses stats. Le champ `forme` donne sa catégorie (`mega`, `primal`, `gmax`, `alola`, `galar`, `hisui`, `paldea` ou `autre`) et `base` le nom du Pokémon de base. Pour un Pokémon de base, `forme` vaut `null`. `id` est unique et `num` est le numéro du Pokédex.

Pour l'instant, les jeux ignorent ces formes : le filtre se trouve dans `Core.load()` (`Ressource/core.js`).

## Tester en local

Les pages chargent `pokemon.json` avec `fetch`, ce qui ne marche pas en ouvrant les fichiers directement. Lance un petit serveur à la racine du projet :

```
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

## Déploiement

Dans les réglages du dépôt GitHub : *Pages*, puis branche `main`, dossier racine. Tous les liens sont relatifs, le site fonctionne donc aussi dans un sous-dossier (`utilisateur.github.io/depot/`).

## Multijoueur

- L'hôte crée un salon et partage le code à 5 caractères. Les autres le saisissent pour rejoindre.
- L'hôte choisit le jeu. Une graine aléatoire (`?seed=`) est envoyée à tous, qui reçoivent donc les mêmes questions.
- Chaque jeu tourne dans un `iframe` et envoie son score au salon à la fin de la partie.
- La connexion passe par [PeerJS](https://peerjs.com) (WebRTC) et son serveur public gratuit. Certains réseaux (écoles, entreprises) peuvent bloquer la connexion entre joueurs, et si l'hôte quitte, le salon se ferme.

## Ajouter un jeu

1. **Jeu « Deviner »** : ajoute un mode dans `Ressource/guess.js` (affichage de la question dans `question()`, révélation dans `reveal()`), puis crée `main/deviner-<mode>.html` en copiant une page existante et en changeant `data-mode`.
2. **Jeu à choix multiples** : ajoute une fonction dans l'objet `JEUX` de `Ressource/qcm.js` (elle renvoie `q`, `choix`, `bonne` et `expl`), puis crée la page avec `data-jeu`.
3. **Autre type de jeu** : utilise `Core.seed()` pour l'aléatoire et appelle `Core.fin(mode, score, max)` à la fin de la partie. Cela sauvegarde le meilleur score et prévient le salon multijoueur.
4. Ajoute la page au menu correspondant et, si elle doit être jouable à plusieurs, à la liste `JEUX` de `Ressource/multi.js`.

## Sauvegardes

Les meilleurs scores sont stockés dans le `localStorage` du navigateur, via `Core.Store` dans `core.js`. Quand une base de données arrivera (comptes utilisateurs), c'est le seul endroit à modifier.

## À faire

- Remplacer le lien du Starter à l'aveugle dans `index.html` (actuellement `#`).
- Comptes utilisateurs avec une base de données.
- Attaques dans le jeu « Caractéristiques » (demande beaucoup d'appels à PokéAPI).

## Crédits

Données et images : [PokéAPI](https://pokeapi.co). Pokémon est une marque de Nintendo, Game Freak et Creatures Inc. Ce projet est un projet de fan, sans but commercial.
