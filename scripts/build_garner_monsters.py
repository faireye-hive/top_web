#!/usr/bin/env python3
"""Restaura a população de Garner a partir do Client, sem alterar suas fontes."""
import argparse
import hashlib
import gzip
import json
import random
import shutil
import subprocess
import sys
import tempfile
import struct
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Lance'))
from selecionar_assets import parse_table


@lru_cache(maxsize=8)
def terrain_sector(x, z):
    return gzip.decompress((ROOT / f'assets/garner/terrain/{x}-{z}.gmap.gz').read_bytes())


def valid_birth(x, z, sea):
    for dx, dz in ((0, 0), (.3, 0), (-.3, 0), (0, .3), (0, -.3)):
        px, pz = x + dx, z + dz
        if not 0 <= px < 4096 or not 0 <= pz < 4096:
            return False
        ix, iz = int(px), int(pz)
        data = terrain_sector(ix // 256, iz // 256)
        at = 20 + ((iz % 256) * 256 + ix % 256) * 7
        region = struct.unpack_from('<H', data, at + 4)[0]
        quadrant = int((pz % 1) * 2) * 2 + int((px % 1) * 2)
        if (region & 1 if sea else not region & 9) or data[at + 6] & (1 << quadrant):
            return False
    return True


def population(client):
    table = parse_table(client / 'scripts/table/characterinfo.txt')
    source = client / 'scripts/offline/garner/garnerChaSpn.txt'
    species, regions, spawns = {}, [], []
    for line in source.read_text(encoding='utf-8-sig').splitlines():
        if not line or line.startswith('//'):
            continue
        row = line.split('\t')
        serial = int(row[0])
        start, end = [[int(n) / 100 for n in cell.split(',')] for cell in row[1:3]]
        ids, counts, times = [[int(n) for n in cell.split(',')] for cell in (row[4], row[5], row[7])]
        # Linha 89 tem um tempo excedente no arquivo original.
        assert len(ids) == len(counts) and len(times) >= len(ids)
        times = times[:len(ids)]
        regions.append(dict(id=serial, name=row[10], start=start, end=end,
                            characters=ids, counts=counts, respawnSeconds=times))
        for char_id, count, seconds in zip(ids, counts, times):
            key = f'original-{char_id}'
            char = table[char_id]
            level = int(char[60])
            species[key] = dict(name=char[1], sourceCharacterId=char_id,
                                model=f'models/garner-{char_id}.glb', level=level,
                                habitat='sea' if int(char[26]) == 1 else 'land',
                                maxHp=int(char[61]), attack=round((int(char[65]) + int(char[66])) / 2),
                                defense=round(float(char[68])), accuracy=round(float(char[69])), evasion=round(float(char[70])),
                                attackSpeed=round(1000 / max(400, int(char[75])), 3),
                                moveSpeed=int(char[78]) / 100, patrolSpeed=1, immobile=int(char[78]) == 0,
                                aggressive=int(char[53]) == 10, xp=10 + 3 * level)
            # O original sorteia pontos dentro destes retângulos. Semente fixa
            # mantém a distribuição reproduzível no cliente web e nos testes.
            rng = random.Random(serial * 10000 + char_id)
            for index in range(count):
                for attempt in range(10000):
                    x, z = [round(rng.uniform(a, b), 2) for a, b in zip(start, end)]
                    if valid_birth(x, z, species[key]['habitat'] == 'sea'):
                        break
                else:
                    raise ValueError(f'Região {serial}: sem ponto válido para {char_id}')
                spawns.append(dict(species=key, x=x, z=z, region=serial, slot=index,
                                   respawnSeconds=seconds))
    return dict(version=3, map='garner', streaming=True,
                source='Client/scripts/offline/garner/garnerChaSpn.txt + scripts/table/characterinfo.txt',
                sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                note='Espécies, quantidades e regiões originais; pontos sorteados com semente fixa. '
                     'Atributos base do CharacterInfo; XP web = 10 + 3 × nível. '
                     'População ativa limitada por proximidade no mobile e desktop.',
                regions=regions, species=species, spawns=spawns)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client', type=Path)
    parser.add_argument('--manifest-only', action='store_true')
    args = parser.parse_args()
    client = args.client.expanduser().resolve()
    data = population(client)
    dest = ROOT / 'assets/monsters'
    if not args.manifest_only:
        with tempfile.TemporaryDirectory(prefix='garner-monsters-') as tmp:
            ids = [str(s['sourceCharacterId']) for s in data['species'].values()]
            subprocess.run([sys.executable, str(ROOT / 'Lance/criar_personagens.py'), str(client),
                            '--ids', *ids, '--acoes', '1,5,7,17', '--outdir', tmp], check=True)
            for species in data['species'].values():
                shutil.copy2(Path(tmp) / f"personagem_{species['sourceCharacterId']}.glb",
                             dest / species['model'])
    (dest / 'manifest.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f"Garner: {len(data['regions'])} regiões, {len(data['species'])} espécies, {len(data['spawns'])} nascimentos.")


if __name__ == '__main__':
    main()
