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
│   ├── quiestce.js             Qui est-ce ? (duel uniquement)
│   ├── grid-moteur.js          Pokémon Grid : critères, génération des grilles, règles du duel
│   ├── grid.js                 Pokémon Grid : interface (solo et duel)
│   ├── firebase.js             Comptes et statistiques (Firebase)
│   ├── compte.js               Page « Mon compte »
│   ├── classement.js           Page « Classements »
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
    ├── generer_pokemon.py      Script qui génère pokemon.json
    └── verifier_grid.mjs       Vérifie que toutes les grilles de Pokémon Grid sont remplissables (Node)
```

## Mise en page

Les pages occupent toute la largeur de l'écran (`main` n'a plus de largeur maximale). Dans le salon multijoueur, l'iframe du duel fait presque la hauteur de la fenêtre et le titre de la page est masqué pendant un duel (classe `en-duel` sur `body`, posée par `multi.js`) pour limiter les barres de défilement. En mode duel, les titres des jeux sont réduits (classe `embed`). Les plateaux carrés (Memory, Pokémon Grid) ont une largeur plafonnée selon la hauteur de l'écran, pour ne pas dépasser la fenêtre.

## Première utilisation : générer `pokemon.json`

Les jeux lisent `Ressource/pokemon.json`. Ce fichier n'est pas fourni : il se génère depuis [PokéAPI](https://pokeapi.co) avec Python 3.8 ou plus (aucune dépendance à installer).

```
python3 outils/generer_pokemon.py
```

Le script écrit directement dans `Ressource/pokemon.json` (compte quelques minutes). Relis le diff, puis commit le fichier.

À refaire quand de nouveaux Pokémon sortent (par exemple une nouvelle génération). La génération est complète à chaque fois et il n'y a pas de mise à jour automatique.

Pour chaque Pokémon, le fichier contient : numéro, nom français, génération, types, talents, taille, poids, statistiques de base (`stats` : `pv`, `atq`, `def`, `atqs`, `defs`, `vit`) et leur total (`total`), description du Pokédex, stade d'évolution, indicateur full évolué (`final`, vrai aussi pour un Pokémon sans évolution), statuts (`legendaire`, `fabuleux`, `bebe`, `starter`), `ligne` (identifiant de la famille d'évolution, partagé par un Pokémon, ses évolutions et leurs formes), images (normale et shiny) et cri.

Le fichier contient aussi toutes les formes alternatives (Méga, régionales, Gigamax, etc.), chacune comme une entrée à part avec son propre nom, ses types et ses stats. Le champ `forme` donne sa catégorie (`mega`, `primal`, `gmax`, `alola`, `galar`, `hisui`, `paldea` ou `autre`) et `base` le nom du Pokémon de base. Pour un Pokémon de base, `forme` vaut `null`. `id` est unique et `num` est le numéro du Pokédex. Chaque forme a aussi un champ `suffixe` (celui de PokéAPI, par exemple `rapid-strike` ou `totem`) que Pokémon Grid utilise pour écarter les formes qui ne sont pas de vrais Pokémon. À la fin de la génération, le script liste les formes dont le nom français n'a pas été trouvé (nom avec des mots anglais) : corrige-les dans `RENOMMER`, en haut du script.

Seul Pokémon Grid utilise ces formes (`Core.load(true)`) ; les autres jeux les ignorent : le filtre se trouve dans `Core.load()` (`Ressource/core.js`).

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
4. La partie est un **duel** : une seule question, chacun propose une réponse à son tour, sans limite d'essais, et le premier qui trouve gagne la manche. Les victoires sont comptées dans le salon, et le joueur qui commence alterne à chaque manche. À tout moment, l'un ou l'autre peut revenir à la sélection des jeux (bouton « Retour à la sélection des jeux ») sans quitter le salon ni perdre les victoires.
   - Jeux « Deviner » et Pokédle : les propositions des deux joueurs s'affichent des deux côtés.
   - Jeux à choix (plus ou moins, types, intrus, shiny) : un mauvais choix est éliminé, puis c'est à l'autre joueur.
   - Qui est-ce ? (deux variantes, uniquement en duel) : voir ci-dessous.
   - Memory : 12 paires (24 cartes), chacun son tour. Réussir une paire fait rejouer, se tromper passe la main, et celui qui trouve le plus de paires gagne (égalité possible). Le nombre de paires se règle avec `PAIRES_DUEL` dans `Ressource/memory.js`.

### Qui est-ce ?

Mode réservé au multijoueur (grisé sur l'accueil), avec deux tuiles dans le salon :

- **Groupe aléatoire** : 30 Pokémon tirés au hasard.
- **Groupe personnalisé** : chaque joueur ajoute 15 Pokémon (autocomplétion, « Un au hasard » ou « Compléter au hasard »). Les doublons entre les deux sélections sont remplacés au hasard pour garder 30 Pokémon.

Chacun choisit en secret le Pokémon que l'autre doit deviner. Puis, à tour de rôle, le joueur dont c'est le tour écrit une question (réponse par Oui ou Non) ou clique sur « Deviner le Pokémon » pour proposer une tuile, puis valide ou annule dans un popup (idem pour le choix du Pokémon secret). Une mauvaise proposition fait passer la main et cache la tuile. Un clic sur une tuile la cache ou la réaffiche.

- **Plateau de l'adversaire en direct :** à côté de ton plateau, un mini-plateau montre les tuiles que l'adversaire a cachées ou réaffichées, en temps réel (message `cache` relayé par le salon). Les tuiles cachées sont donc visibles des deux côtés ; seul le Pokémon secret reste privé.
- **Zoom :** chaque tuile a un bouton 🔍 qui ouvre l'image en grand (utile pour les questions sur les couleurs). Un clic sur l'image la double, Échap ou un clic à côté ferme. Le zoom fonctionne aussi sur les tuiles cachées.
- **Ton Pokémon secret :** dès que tu l'as choisi, un bandeau jaune en haut de la page affiche son image et son nom (clic sur l'image pour zoomer).

Les Pokémon secrets ne circulent jamais avant la fin : c'est le joueur concerné qui répond aux propositions.

Fonctionnement : les deux pages génèrent la même question avec la même graine (`?seed=`), donc seuls les coups circulent (pour Qui est-ce ?, aussi les tuiles cachées). Chaque jeu tourne dans un `iframe` avec `?duel=1` et envoie ses coups au salon, qui les relaie à l'adversaire.

La connexion passe par le serveur public gratuit de [PeerJS](https://peerjs.com). Certains réseaux (écoles, entreprises) peuvent bloquer la connexion entre joueurs, et si l'hôte quitte, le salon se ferme.

## Ajouter un jeu

1. **Jeu « Deviner »** : ajoute un mode dans `Ressource/guess.js` (affichage de la question dans `question()`, révélation dans `reveal()`), puis crée `main/deviner-<mode>.html` en copiant une page existante et en changeant `data-mode`.
2. **Jeu à choix multiples** : ajoute une fonction dans l'objet `JEUX` de `Ressource/qcm.js` (elle renvoie `q`, `choix`, `bonne` et `expl`), puis crée la page avec `data-jeu`.
3. **Autre type de jeu** : utilise `Core.seed()` pour l'aléatoire et appelle `Core.fin(mode, score)` à la fin d'une partie solo : le score est le nombre d'essais et cela sauvegarde le record (le plus bas).
4. Ajoute la page au menu correspondant et, si elle doit être jouable à plusieurs, à la liste `CATS` de `Ressource/multi.js`. Pour qu'elle fonctionne en duel, appuie-toi sur `Core.Duel` (voir `guess.js` ou `qcm.js`).

## Sauvegardes

Dans tous les jeux solo, le score est le nombre d'essais : plus il est bas, mieux c'est, et le record est le plus bas obtenu (Deviner : 10 au mieux, une question ratée compte 4 ; jeux à choix : un mauvais choix est éliminé et compte comme un essai ; Pokédle : nombre de propositions, un abandon n'enregistre rien ; Memory : nombre de coups, 6 au mieux). Les records sont stockés dans le `localStorage` du navigateur, via `Core.Store` dans `core.js`. Quand une base de données arrivera (comptes utilisateurs), c'est le seul endroit à modifier.

## Pokémon Grid

Page `main/grid.html` (menu Réflexion). Une grille 3×3 : chaque ligne et colonne a un critère (type, génération, légendaire, fabuleux, stade d'évolution, starter, Méga, Gigamax, forme régionale, statistique) et chaque case demande un Pokémon qui valide les deux. Toutes les formes alternatives (Méga, Primo, Gigamax, régionales, mais aussi styles, coloris et formes diverses comme Shifours Style Mille Poings ou les 4 Plumeline) sont des Pokémon à part entière ; elles héritent de la génération, du stade, du statut starter et légendaire de leur espèce. Sont écartés, dans `grid-moteur.js` (`SUFFIXES_EXCLUS`, `BASES_SANS_FORMES`) : casquettes et costumes de Pikachu, Pikachu et Évoli Partenaire, Totems, Éthernatos Infinimax, Zygarde Générateur et les formes Météno (simples couleurs).

- **Difficultés :** Facile (types et générations, au moins 10 Pokémon valides par case), Normal (au moins 3, avec statut, stade et starter), Difficile (au moins 1, avec au moins un critère rare : starter, Méga, Gigamax, forme régionale ou statistique extrême), Expert (critères du Normal, statistiques comprises, au moins 3 par case, et deux Pokémon de la même lignée évolutive, champ `ligne`, ne peuvent pas être dans la grille ; la grille est garantie remplissable avec une lignée par case, en solo comme en duel).
- **Critères de statistiques :** une statistique de base (PV, Attaque, Défense, Atq. Spé., Déf. Spé., Vitesse) au-dessus ou en dessous d'un seuil, jamais un seuil trivial. Normal et Expert : `≥ 120` (`≥ 110` pour les PV) ou `≤ 40`. Difficile : en plus `≥ 150` ou `≤ 25` (critères « rares »). Il y a aussi des critères sur le total des statistiques (`≥ 600`, `≤ 250` ; `≥ 680`, `≤ 200` en Difficile). Facile n'en a pas. Chaque critère de statistique a deux fois moins de chances d'être tiré qu'un critère classique (`POIDS_STAT = 0.5` dans `grid-moteur.js`). Une grille a au plus 2 critères de statistique en Normal et Expert, 3 en Difficile (`maxStats` dans `DIFFS`), jamais deux sur la même statistique. `node outils/verifier_grid.mjs` affiche la fréquence réelle d'un critère de stat par rapport aux autres (visée : environ 0,5 ; elle dépend de `pokemon.json`, car les filtres de difficulté écartent plus souvent les critères rares). Les seuils sont dans `grid-moteur.js` (`CRITERES_STATS`) ; un critère qui n'a pas assez de Pokémon valides pour la difficulté est écarté automatiquement. Ils demandent le champ `stats` de `pokemon.json` : après la mise à jour, relance `python3 outils/generer_pokemon.py` (sans ce champ, seuls les critères de total sont actifs).
- **Grilles toujours remplissables :** chaque grille renvoyée par le moteur (solo comme duel, toutes difficultés) est vérifiée par appariement : 9 Pokémon différents, et une lignée différente par case en Expert. Si aucune grille ne convient au bout de 3 000 essais (très improbable), le moteur se rabat sur des types et générations seulement (`secours: true`). Pour contrôler sur le vrai `pokemon.json` : `node outils/verifier_grid.mjs` (option : nombre de grilles par difficulté, 1000 par défaut). Le script refait la vérification critère par critère, rejoue chaque grille en duel, et se termine en erreur au moindre problème.
- **Solo :** score = nombre d'essais (9 = parfait). Un nom hors liste ou un Pokémon déjà posé est refusé sans coût, retirer un Pokémon est gratuit. La grille est garantie remplissable avec 9 Pokémon différents. La partie est sauvegardée (localStorage), on peut abandonner pour voir une solution (sans score) et copier un résultat en emojis. Un record par difficulté (`grid-facile`, `grid-normal`, `grid-difficile`, `grid-expert`).
- **Duel (salon) :** morpion à tour de rôle sur la même grille, 1 min 30 par tour. Un Pokémon valide sur une case libre la prend, sur une case adverse la vole (avec un Pokémon jamais proposé pour cette case). Un Pokémon invalide fait perdre le tour ; un Pokémon déjà posé ou déjà proposé pour la case est refusé sans perdre le tour. Trois cases alignées gagnent ; si la grille est pleine, celui qui a le plus de cases gagne (9 cases : pas d'égalité). Le détail des Pokémon proposés est visible en touchant une case. Pas de score, seulement les victoires (`grid`).
- **Partager une grille (solo) :** chaque grille a un code (`difficulté-graine-taille`, par exemple `n-1x2y3z-zz`) et un lien `grid.html?grille=code`. La graine fait générer la même grille (un code partagé avant l'ajout des critères de statistiques ne redonne pas la même grille) ; la taille sert à prévenir si `pokemon.json` a changé depuis (la grille peut alors différer). Le lien est aussi ajouté au résultat copié. On colle un code ou un lien dans le menu des difficultés pour jouer la grille d'un ami.
- **Fin de partie :** une fois la grille terminée (réussite ou abandon en solo, fin du duel), toucher une case affiche toutes les possibilités de cette case (le Pokémon placé est en vert).
- **Code :** `Ressource/grid-moteur.js` (sans interface, testable) et `Ressource/grid.js` (affichage). Les formes viennent de `Core.load(true)`.

## Comptes et classements (Firebase)

Les comptes sont **facultatifs** : sans compte, tout fonctionne avec les records locaux. Connecté, chaque partie terminée est aussi enregistrée sur le compte.

- **Connexion :** pseudo + mot de passe (8 caractères minimum), sans e-mail réel. Le pseudo sert à fabriquer un e-mail factice (`pseudo@joueurs.pokemongames.invalid`) pour Firebase Authentication, qui gère le hachage : aucun mot de passe n'est stocké dans la base. Conséquence : un mot de passe oublié n'est pas récupérable.
- **Pages :** `main/compte.html` (connexion, inscription, profil, statistiques, camembert des jeux les plus joués, suppression du compte) et `main/classement.html`.
- **Données (Firestore, eur3) :** `joueurs/{uid}` (pseudo, date de création) et `classements/{jeu}/joueurs/{uid}` (pseudo, record, parties, total, derniere, duels, victoires, nuls). Le profil et les classements lisent les mêmes documents. Les profils sont publics (pseudo et statistiques).
- **Ce qui est enregistré :** le record (le plus petit score), le nombre de parties terminées, la moyenne, et les duels (victoires, nuls, défaites). Les abandons ne comptent pas. En « Deviner », seules les parties avec toutes les générations sont classées.
- **Sécurité :** Firestore n'a pas d'injection de type SQL. `firestore.rules` valide chaque écriture : propriétaire du document, champs autorisés, score plausible, record cohérent, une seule partie à la fois, 3 secondes minimum entre deux écritures, pseudo conforme au compte. Le risque restant est la triche (les scores sont calculés dans le navigateur) : les règles la limitent sans l'éliminer.
- **Mise en place :** publier `firestore.rules` (console Firebase > Firestore > Règles > Publier, ou `firebase deploy --only firestore:rules`) et autoriser le domaine du site dans Authentication > Paramètres > Domaines autorisés.
- **Tests des règles :** `npm install` puis `npm test` (Node, Java et firebase-tools requis) lancent `tests/regles.test.mjs` sur l'émulateur.

## À faire

- Attaques dans le jeu « Caractéristiques » (demande beaucoup d'appels à PokéAPI).

## Crédits

Données et images : [PokéAPI](https://pokeapi.co). Pokémon est une marque de Nintendo, Game Freak et Creatures Inc. Ce projet est un projet de fan, sans but commercial.
