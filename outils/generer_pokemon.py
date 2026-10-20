#!/usr/bin/env python3
"""Génère Ressource/pokemon.json depuis PokéAPI (Python 3.8+, aucune dépendance).

Usage, depuis la racine du projet :
    python3 outils/generer_pokemon.py

Chaque Pokémon est une entrée, ainsi que chacune de ses formes alternatives
(Méga, régionales, Gigamax, etc.). Les formes ont un champ "forme" (catégorie)
et un champ "base" (nom du Pokémon de base) ; pour les Pokémon de base, "forme" vaut null.
"id" est unique (identifiant PokéAPI du Pokémon), "num" est le numéro du Pokédex.

Champs de statut (hérités par les formes) : "legendaire", "fabuleux", "bebe", "starter" (lignée complète d'un
starter de départ), "final" (pleinement évolué, y compris un Pokémon sans évolution) et "stade" (1, 2, 3...).
Les formes sans image restent dans le fichier avec "image": null.
"ligne" est l'identifiant de la famille d'évolution (Salamèche, Reptincel, Dracaufeu et ses formes : même valeur) ;
le niveau « Expert » de Pokémon Grid s'en sert pour interdire deux Pokémon de la même lignée.
Chaque forme a aussi un champ "suffixe" (celui de PokéAPI : "rapid-strike", "pom-pom", "totem"...) que Pokémon Grid
utilise pour écarter les formes qui ne sont pas de vrais Pokémon (casquettes de Pikachu, Totems...).
À la fin, le script liste les formes dont le nom français n'a pas été trouvé sur PokéAPI (nom avec des mots anglais).

Relis ensuite le diff et commit le fichier quand de nouveaux Pokémon sortent.
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

API = 'https://pokeapi.co/api/v2'
OUT = Path(__file__).resolve().parent.parent / 'Ressource' / 'pokemon.json'
TYPES = {
    'normal': 'Normal', 'fire': 'Feu', 'water': 'Eau', 'electric': 'Électrik', 'grass': 'Plante',
    'ice': 'Glace', 'fighting': 'Combat', 'poison': 'Poison', 'ground': 'Sol', 'flying': 'Vol',
    'psychic': 'Psy', 'bug': 'Insecte', 'rock': 'Roche', 'ghost': 'Spectre', 'dragon': 'Dragon',
    'dark': 'Ténèbres', 'steel': 'Acier', 'fairy': 'Fée',
}
REGIONS = {'alola': "d'Alola", 'galar': 'de Galar', 'hisui': 'de Hisui', 'paldea': 'de Paldea'}
# Les 3 starters de départ de chaque génération : leur lignée complète compte comme « starter ».
STARTERS = {
    'bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile', 'treecko', 'torchic', 'mudkip',
    'turtwig', 'chimchar', 'piplup', 'snivy', 'tepig', 'oshawott', 'chespin', 'fennekin', 'froakie',
    'rowlet', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble', 'sprigatito', 'fuecoco', 'quaxly',
}
# Espèces dont une seule forme peut évoluer (les autres formes sont pleinement évoluées) : espèce -> suffixe.
SEULE_FORME_QUI_EVOLUE = {
    'farfetchd': 'galar', 'mr-mime': 'galar', 'corsola': 'galar', 'linoone': 'galar',
    'qwilfish': 'hisui', 'basculin': 'white-striped',
}
# Noms français corrigés (PokéAPI se trompe ou mélange le nom anglais et le nom français de l'espèce).
RENOMMER = {
    'Diagla Originel': 'Dialga Originel',
    'Calyrex Cavalier du Froid': 'Sylveroy Cavalier du Froid',
    'Calyrex Cavalier d’Effroi': 'Sylveroy Cavalier d’Effroi',
}
# Mots de suffixe traduits, et mots déjà portés par le nom (Méga, Gigamax, Primo).
MOTS = {'female': 'femelle', 'male': 'mâle'}
IGNORES = {'mega', 'gmax', 'primal'}


def get(url, essais=3):
    for k in range(1, essais + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'jeux-pokemon'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(0.5 * k)
    raise RuntimeError('Échec : ' + url)


@lru_cache(maxsize=None)
def talent_fr(url):
    a = get(url)
    return next((n['name'] for n in a['names'] if n['language']['name'] == 'fr'), a['name'])


def categorie(suffixe):
    t = suffixe.split('-')
    if 'gmax' in t:  # y compris « amped-gmax », « single-strike-gmax »...
        return 'gmax'
    if 'mega' in t and not ({'zen', 'totem', 'cap'} & set(t)):  # y compris « female-mega », « curly-mega »...
        return 'mega'
    if t[0] in ('mega', 'primal', *REGIONS) and not ({'zen', 'totem', 'cap'} & set(t)):  # combat, totems, casquettes : « autre »
        return t[0]
    return 'autre'


def mots(suffixe):
    """Suffixe PokéAPI lisible : « female-mega » -> « femelle »."""
    return ' '.join(MOTS.get(x, x) for x in suffixe.split('-') if x not in IGNORES)


def nom_forme(nom, suffixe, form):
    """Nom français de la forme et un booléen : False si le nom garde des mots anglais (à relire)."""
    fr = next((n['name'] for n in form.get('names', []) if n['language']['name'] == 'fr'), None)
    if fr and fr != nom:
        return fr, True
    t = suffixe.split('-')
    if categorie(suffixe) == 'autre':  # styles, coloris, formes de combat... : nom court de la forme, précédé de l'espèce
        court = next((n['name'] for n in form.get('form_names', []) if n['language']['name'] == 'fr'), None)
        if court and court != nom:
            return (court if nom.lower() in court.lower() else f'{nom} {court}'), True
    if 'gmax' in t:
        reste = ' '.join(x for x in t if x != 'gmax')
        return f'{nom} Gigamax' + (f' ({reste})' if reste else ''), True
    if 'mega' in t:
        reste = [x.upper() if len(x) == 1 else MOTS.get(x, x) for x in t if x != 'mega']
        return f'Méga-{nom}' + (' ' + ' '.join(reste) if reste else ''), True
    if t[0] == 'primal':
        return f'Primo-{nom}', True
    if t[0] in REGIONS:
        reste = ' '.join(t[1:])
        return f'{nom} {REGIONS[t[0]]}' + (f' ({reste})' if reste else ''), True
    return f'{nom} ({mots(suffixe)})', False


def entree(sp, p, nom, forme=None, base=None, suffixe=None):
    art = (p['sprites'].get('other') or {}).get('official-artwork') or {}
    ab = [a for a in p['abilities'] if not a['is_hidden']] or p['abilities']
    descs = [f for f in sp['flavor_text_entries'] if f['language']['name'] == 'fr']
    e = {
        'id': p['id'],
        'num': sp['id'],
        'nom': nom,
        'forme': forme,
        'gen': int(sp['generation']['url'].rstrip('/').split('/')[-1]),
        'ligne': int(sp['evolution_chain']['url'].rstrip('/').split('/')[-1]) if sp.get('evolution_chain') else -sp['id'],
        'legendaire': bool(sp.get('is_legendary')),
        'fabuleux': bool(sp.get('is_mythical')),
        'bebe': bool(sp.get('is_baby')),
        'types': [TYPES.get(t['type']['name'], t['type']['name']) for t in p['types']],
        'talents': [talent_fr(a['ability']['url']) for a in ab],
        'taille': p['height'] / 10,
        'poids': p['weight'] / 10,
        'total': sum(x['base_stat'] for x in p['stats']),
        # La description du Pokédex n'existe que pour le Pokémon de base.
        'desc': ' '.join(descs[-1]['flavor_text'].replace('\u00ad', '').split()) if descs and not forme else None,
        'image': art.get('front_default'),
        'shiny': art.get('front_shiny'),
        'cri': (p.get('cries') or {}).get('latest'),
        '_en': sp['name'],
        '_pere': (sp.get('evolves_from_species') or {}).get('name'),
        '_suf': suffixe,
    }
    if base:
        e['base'] = base
    return e


def fiches(s):
    """Le Pokémon de base et toutes ses formes alternatives."""
    sp = get(s['url'])
    nom = next((n['name'] for n in sp['names'] if n['language']['name'] == 'fr'), sp['name'])
    out = []
    for v in sp['varieties']:
        p = get(v['pokemon']['url'])
        if v['is_default']:
            out.append(entree(sp, p, nom))
            continue
        suf = p['name'][len(sp['name']) + 1:] if p['name'].startswith(sp['name'] + '-') else p['name']
        form = get(p['forms'][0]['url']) if p['forms'] else {'names': []}
        nom_f, francais = nom_forme(nom, suf, form)
        e = entree(sp, p, RENOMMER.get(nom_f, nom_f), categorie(suf), nom, suf)  # image possiblement null
        if not francais:
            e['_anglais'] = True
        out.append(e)
    return out


def main():
    total = get(f'{API}/pokemon-species?limit=1')['count']
    results = get(f'{API}/pokemon-species?limit={total}')['results']
    out = []
    with ThreadPoolExecutor(max_workers=20) as ex:
        for i, lot in enumerate(ex.map(fiches, results), 1):
            out.extend(lot)
            print(f'\r{i}/{len(results)} espèces', end='', flush=True)
    out.sort(key=lambda p: (p['num'], p['id']))

    pere = {p['_en']: p['_pere'] for p in out}
    parents = set(pere.values()) - {None}  # espèces dont au moins une autre évolue

    def stade(n):
        return 1 + stade(pere[n]) if pere.get(n) else 1

    def starter(n):  # l'espèce ou l'un de ses ancêtres est un starter de départ
        return n in STARTERS or (pere.get(n) is not None and starter(pere[n]))

    vus = set()
    anglais = []
    for p in out:
        if p['forme']:  # noms toujours uniques : ils servent de réponse dans les jeux
            if p['nom'] in vus:
                p['nom'] += f" ({mots(p['_suf']) or p['_suf']})"
            if p['nom'] in vus:
                p['nom'] += f" #{p['id']}"
        vus.add(p['nom'])
        # Full évolué : ne peut plus évoluer (un Pokémon sans évolution l'est aussi).
        seule = SEULE_FORME_QUI_EVOLUE.get(p['_en'])
        p['final'] = (p['_suf'] != seule) if seule else p['_en'] not in parents
        p['starter'] = starter(p['_en'])
        p['stade'] = stade(p.pop('_en'))
        p.pop('_pere')
        suf = p.pop('_suf')
        if p['forme']:
            p['suffixe'] = suf
        if p.pop('_anglais', False):
            anglais.append(p['nom'])
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    formes = sum(1 for p in out if p['forme'])
    print(f'\n{len(out)} entrées dont {formes} formes alternatives, écrites dans {OUT}')
    if anglais:
        print(f'{len(anglais)} formes ont gardé un nom avec des mots anglais (à corriger dans RENOMMER si besoin) :')
        for n in anglais:
            print('  -', n)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
