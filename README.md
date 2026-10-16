# Jeux Pokémon

Site de mini-jeux Pokémon, 100 % statique, hébergé sur GitHub Pages. Chaque jeu se joue seul ou à plusieurs dans un salon multijoueur.

## Les jeux

| Catégorie | Jeux |
|---|---|
| Deviner | Silhouette, cri, image pixelisée, description du Pokédex, caractéristiques |
| Réflexion | Pokédle, plus ou moins, efficacité des types, intrus |
| Autre | Memory, « Lequel est le shiny ? », lien vers le Starter à l'aveugle |
| Multijoueur | Duel à deux dans un salon à code (PeerJS) : chacun son tour, le premier qui trouve gagne |

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

Pour chaque Pokémon, le fichier contient : numéro, nom français, génération, types, talents, taille, poids, total des stats, description du Pokédex, stade d'évolution, indicateur full évolué (`final`), images (normale et shiny) et cri.

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

Un salon réunit **deux joueurs** (PeerJS, WebRTC) :

1. L'hôte crée un salon et partage le code à 5 caractères ; l'autre joueur le saisit pour rejoindre.
2. Une fois connectés, l'hôte clique sur **Jouer** : les deux joueurs voient la liste de tous les jeux.
3. Le joueur non hôte **suggère** un jeu en cliquant dessus (l'hôte voit la suggestion en jaune). L'hôte peut lancer n'importe quel jeu.
4. La partie est un **duel** : une seule question, chacun propose une réponse à son tour, sans limite d'essais, et le premier qui trouve gagne la manche. Les victoires sont comptées dans le salon, et le joueur qui commence alterne à chaque manche.
   - Jeux « Deviner » et Pokédle : les propositions des deux joueurs s'affichent des deux côtés.
   - Jeux à choix (plus ou moins, types, intrus, shiny) : un mauvais choix est éliminé, puis c'est à l'autre joueur.
   - Memory : 12 paires (24 cartes), chacun son tour. Réussir une paire fait rejouer, se tromper passe la main, et celui qui trouve le plus de paires gagne (égalité possible). Le nombre de paires se règle avec `PAIRES_DUEL` dans `Ressource/memory.js`.

Fonctionnement : les deux pages génèrent la même question avec la même graine (`?seed=`), donc seuls les coups circulent. Chaque jeu tourne dans un `iframe` avec `?duel=1` et envoie ses coups au salon, qui les relaie à l'adversaire.

La connexion passe par le serveur public gratuit de [PeerJS](https://peerjs.com). Certains réseaux (écoles, entreprises) peuvent bloquer la connexion entre joueurs, et si l'hôte quitte, le salon se ferme.

## Ajouter un jeu

1. **Jeu « Deviner »** : ajoute un mode dans `Ressource/guess.js` (affichage de la question dans `question()`, révélation dans `reveal()`), puis crée `main/deviner-<mode>.html` en copiant une page existante et en changeant `data-mode`.
2. **Jeu à choix multiples** : ajoute une fonction dans l'objet `JEUX` de `Ressource/qcm.js` (elle renvoie `q`, `choix`, `bonne` et `expl`), puis crée la page avec `data-jeu`.
3. **Autre type de jeu** : utilise `Core.seed()` pour l'aléatoire et appelle `Core.fin(mode, score)` à la fin d'une partie solo : le score est le nombre d'essais et cela sauvegarde le record (le plus bas).
4. Ajoute la page au menu correspondant et, si elle doit être jouable à plusieurs, à la liste `CATS` de `Ressource/multi.js`. Pour qu'elle fonctionne en duel, appuie-toi sur `Core.Duel` (voir `guess.js` ou `qcm.js`).

## Sauvegardes

Dans tous les jeux solo, le score est le nombre d'essais : plus il est bas, mieux c'est, et le record est le plus bas obtenu (Deviner : 10 au mieux, une question ratée compte 4 ; jeux à choix : un mauvais choix est éliminé et compte comme un essai ; Pokédle : nombre de propositions, un abandon n'enregistre rien ; Memory : nombre de coups, 6 au mieux). Les records sont stockés dans le `localStorage` du navigateur, via `Core.Store` dans `core.js`. Quand une base de données arrivera (comptes utilisateurs), c'est le seul endroit à modifier.

## À faire

- Comptes utilisateurs avec une base de données.
- Attaques dans le jeu « Caractéristiques » (demande beaucoup d'appels à PokéAPI).

## Crédits

Données et images : [PokéAPI](https://pokeapi.co). Pokémon est une marque de Nintendo, Game Freak et Creatures Inc. Ce projet est un projet de fan, sans but commercial.
