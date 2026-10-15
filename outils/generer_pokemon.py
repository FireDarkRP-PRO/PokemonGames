#!/usr/bin/env python3
"""Génère Ressource/pokemon.json depuis PokéAPI (Python 3.8+, aucune dépendance).

Usage, depuis la racine du projet :
    python3 outils/generer_pokemon.py

Chaque Pokémon est une entrée, ainsi que chacune de ses formes alternatives
(Méga, régionales, Gigamax, etc.). Les formes ont un champ "forme" (catégorie)
et un champ "base" (nom du Pokémon de base) ; pour les Pokémon de base, "forme" vaut null.
"id" est unique (identifiant PokéAPI du Pokémon), "num" est le numéro du Pokédex.

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
    t = suffixe.split('-')[0]
    return t if t in ('mega', 'primal', 'gmax', *REGIONS) else 'autre'


def nom_forme(nom, suffixe, form):
    """Nom français de la forme : celui de PokéAPI s'il existe, sinon reconstruit."""
    fr = next((n['name'] for n in form['names'] if n['language']['name'] == 'fr'), None)
    if fr and fr != nom:
        return fr
    t = suffixe.split('-')
    if t[0] == 'mega':
        return f'Méga-{nom}' + (f' {t[1].upper()}' if len(t) > 1 else '')
    if t[0] == 'primal':
        return f'Primo-{nom}'
    if t[0] == 'gmax':
        return f'{nom} Gigamax'
    if t[0] in REGIONS:
        reste = ' '.join(t[1:])
        return f'{nom} {REGIONS[t[0]]}' + (f' ({reste})' if reste else '')
    return f'{nom} ({suffixe.replace("-", " ")})'


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
        e = entree(sp, p, nom_forme(nom, suf, form), categorie(suf), nom, suf)
        if e['image']:  # sans image, la forme est inutilisable dans les jeux
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

    def stade(n):
        return 1 + stade(pere[n]) if pere.get(n) else 1

    vus = set()
    for p in out:
        if p['forme']:  # noms toujours uniques : ils servent de réponse dans les jeux
            if p['nom'] in vus:
                p['nom'] += f" ({p['_suf'].replace('-', ' ')})"
            if p['nom'] in vus:
                p['nom'] += f" #{p['id']}"
        vus.add(p['nom'])
        p['stade'] = stade(p.pop('_en'))
        p.pop('_pere')
        p.pop('_suf')
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    formes = sum(1 for p in out if p['forme'])
    print(f'\n{len(out)} entrées dont {formes} formes alternatives, écrites dans {OUT}')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
