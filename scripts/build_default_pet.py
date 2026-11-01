#!/usr/bin/env python3
"""Exporta Mordo Junior (item 681 / efeito 526), com PAR, EFF e voo originais."""
import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'Lance'), str(ROOT / 'tool')]
from converter import GLBWriter, parse_lgo
from criar_efeitos import decode_par, decode_eff, index_textures, resolve_texture
from selecionar_assets import parse_table


def build(client):
    base = ROOT / 'assets/pets'
    (base / 'textures').mkdir(parents=True, exist_ok=True)
    items = parse_table(client / 'scripts/table/iteminfo.txt')
    effects = parse_table(client / 'scripts/table/sceneffectinfo.txt')
    # O campo visual do item aponta para sceneffectinfo, não characterinfo.
    assert items[681][1] == 'Mordo Junior' and '526' in items[681][-5:]
    par_name = effects[526][1]
    par = decode_par((client / 'effect' / par_name).read_bytes())
    resources = {par_name: {'kind': 'par', **par}}
    textures = index_textures(client)
    meshes = set()
    for system in par['systems']:
        name = system['model'].lower()
        system['effect'] = name
        if name in resources:
            continue
        eff = decode_eff((client / 'effect' / name).read_bytes())
        for part in eff['parts']:
            for field in ['texture', 'frames']:
                names = part[field] if field == 'frames' else [part[field]]
                converted = []
                for tex in names:
                    source = resolve_texture(textures, tex)
                    if not source:
                        raise FileNotFoundError(f'Textura de Mordo Jr: {tex}')
                    dest = source.stem.replace('.tga', '') + '.png'
                    image = Image.open(source).convert('RGBA')
                    image.thumbnail((256, 256))
                    image.save(base / 'textures' / dest, optimize=True)
                    converted.append(dest)
                part[field] = converted if field == 'frames' else converted[0]
            if part['model'].lower().endswith('.lgo'):
                meshes.add(part['model'])
        resources[name] = {'kind': 'eff', **eff}
    writer = GLBWriter()
    gltf = writer.gltf
    gltf['materials'] = [{'name': 'Material EFF de Mordo Jr', 'doubleSided': True}]
    for name in sorted(meshes):
        raw = (client / 'model/effect' / name).read_bytes()
        geometry = parse_lgo(raw, name)
        transform = np.array(struct.unpack_from('<16f', raw, 16)).reshape(4, 4).T
        positions = geometry['position'] @ transform[:3, :3].T + transform[:3, 3]
        attrs = {'POSITION': writer.arr(positions.astype('<f4'), 5126, 'VEC3', minmax=True)}
        attrs['TEXCOORD_0'] = writer.arr(geometry['uv'].astype('<f4'), 5126, 'VEC2')
        primitive = {'attributes': attrs, 'indices': writer.arr(geometry['indices'].astype('<u2'), 5123, 'SCALAR'), 'material': 0}
        gltf['nodes'].append({'name': Path(name).stem, 'mesh': len(gltf['meshes'])})
        gltf['scenes'][0]['nodes'].append(len(gltf['nodes']) - 1)
        gltf['meshes'].append({'primitives': [primitive]})
    (base / 'mordo-jr.glb').write_bytes(writer.binary())
    manifest = {'version': 1, 'defaultPet': 'mordo-jr', 'name': 'Mordo Jr', 'itemId': 681,
                'effectId': 526, 'model': 'mordo-jr.glb', 'source': 'Client: iteminfo 681 → sceneffectinfo 526 → fjlxiao1.par',
                'resources': resources, 'skills': {'mordo-jr': {'channels': [
                    {'kind': 'actor', 'dummy': -1, 'visual': [{'kind': 'scene', 'files': [par_name]}]}]}}}
    (base / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Mordo Jr: {len(meshes)} malha(s), {len(par["systems"])} sistemas de voo e aura.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client', type=Path)
    build(parser.parse_args().client.expanduser().resolve())
