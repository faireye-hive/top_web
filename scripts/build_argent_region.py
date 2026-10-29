#!/usr/bin/env python3
"""Recorta os assets existentes para Argent, sem modificar os originais.

O GLB estático é compactado incluindo só nós, malhas, materiais e texturas
referenciados no recorte. Não requer o cliente nem dependências externas.
"""
import copy
import gzip
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
OX, OZ, SIZE = 1984, 2528, 512


def compact_library(source, output, names):
    data = source.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    original = json.loads(data[20:20 + length])
    if original.get('animations') or original.get('skins'):
        raise ValueError('Este recorte aceita somente biblioteca de cenário estático')
    binary = data[28 + length:]
    result = {'asset': original['asset'], 'scene': 0, 'scenes': [{'nodes': [0]}],
              'buffers': [{'byteLength': 0}]}
    keys = ('nodes', 'meshes', 'materials', 'textures', 'images', 'samplers', 'accessors', 'bufferViews')
    for key in keys:
        result[key] = []
    remaps = {key: {} for key in keys}
    payload = bytearray()

    def include(key, index):
        if index in remaps[key]:
            return remaps[key][index]
        new_index = len(result[key])
        remaps[key][index] = new_index
        obj = copy.deepcopy(original[key][index])
        result[key].append(obj)
        if key == 'nodes':
            if 'children' in obj:
                obj['children'] = [include('nodes', i) for i in obj['children']]
            if 'mesh' in obj:
                obj['mesh'] = include('meshes', obj['mesh'])
        elif key == 'meshes':
            for primitive in obj['primitives']:
                if primitive.get('targets'):
                    raise ValueError('Morph targets não suportados neste cenário estático')
                primitive['attributes'] = {k: include('accessors', v) for k, v in primitive['attributes'].items()}
                for field, target in [('indices', 'accessors'), ('material', 'materials')]:
                    if field in primitive:
                        primitive[field] = include(target, primitive[field])
        elif key == 'materials':
            def textures(value):
                if not isinstance(value, dict):
                    return
                for k, v in value.items():
                    if k.endswith('Texture') and isinstance(v, dict) and 'index' in v:
                        v['index'] = include('textures', v['index'])
                    else:
                        textures(v)
            textures(obj)
        elif key == 'textures':
            obj['source'] = include('images', obj['source'])
            if 'sampler' in obj:
                obj['sampler'] = include('samplers', obj['sampler'])
        elif key in ('images', 'accessors'):
            if obj.get('sparse'):
                raise ValueError('Accessor esparso não suportado')
            if 'bufferView' in obj:
                obj['bufferView'] = include('bufferViews', obj['bufferView'])
        elif key == 'bufferViews':
            if obj.get('buffer', 0) != 0:
                raise ValueError('Buffer externo não suportado')
            payload.extend(b'\0' * (-len(payload) % 4))
            offset = obj.get('byteOffset', 0)
            obj['byteOffset'] = len(payload)
            payload.extend(binary[offset:offset + obj['byteLength']])
        return new_index

    root = original['scenes'][original.get('scene', 0)]['nodes'][0]
    children = [i for i in original['nodes'][root]['children']
                if original['nodes'][i].get('extras', {}).get('sourceFile', original['nodes'][i].get('name', '')).lower() in names]
    result['nodes'].append({**original['nodes'][root], 'children': []})
    remaps['nodes'][root] = 0
    result['nodes'][0]['children'] = [include('nodes', i) for i in children]
    result['buffers'][0]['byteLength'] = len(payload)
    payload.extend(b'\0' * (-len(payload) % 4))
    encoded = json.dumps(result, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(payload))
                       + struct.pack('<I4s', len(encoded), b'JSON') + encoded
                       + struct.pack('<I4s', len(payload), b'BIN\0') + payload)
    return len(children)


def main():
    out = ASSETS / 'argent'
    out.mkdir(exist_ok=True)
    terrain = gzip.decompress((ASSETS / 'region.gmap.gz').read_bytes())
    magic, x, z, width, height = struct.unpack_from('<4s4I', terrain)
    if magic != b'GNR1' or not (x <= OX and z <= OZ and OX + SIZE <= x + width and OZ + SIZE <= z + height):
        raise ValueError('Recorte fora do terreno disponível')
    cropped = bytearray(struct.pack('<4s4I', magic, OX, OZ, SIZE, SIZE))
    for row in range(OZ - z, OZ - z + SIZE):
        offset = 20 + (row * width + OX - x) * 7
        cropped.extend(terrain[offset:offset + SIZE * 7])
    (out / 'region.gmap.gz').write_bytes(gzip.compress(cropped, compresslevel=9, mtime=0))
    objects = json.loads((ASSETS / 'objects.json').read_text())
    objects = [r for r in objects if OX <= r[0] < OX + SIZE and OZ <= r[1] < OZ + SIZE]
    (out / 'objects.json').write_text(json.dumps(objects, separators=(',', ':')) + '\n')
    catalog = json.loads((ASSETS / 'objects_catalog.json').read_text())
    names = {catalog[str(r[2])]['file'].lower() for r in objects if r[3] == 0 and str(r[2]) in catalog}
    count = compact_library(ASSETS / 'modelos_cenario.glb', out / 'modelos_cenario.glb', names)
    report = {'origin': [OX, OZ], 'size': [SIZE, SIZE], 'terrainBytes': len(cropped),
              'objects': len(objects), 'models': count,
              'sceneryBytes': (out / 'modelos_cenario.glb').stat().st_size}
    (out / 'meta.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
