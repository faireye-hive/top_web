#!/usr/bin/env python3
"""Verifica referências GLB, limites do recorte e orçamento dos monstros."""
import gzip
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify_glb(path):
    raw = path.read_bytes()
    magic, version, size, length, kind = struct.unpack_from('<4s4I', raw)
    assert magic == b'glTF' and version == 2 and size == len(raw) and kind == 0x4e4f534a, path
    gltf = json.loads(raw[20:20 + length])
    binary_size, binary_kind = struct.unpack_from('<II', raw, 20 + length)
    assert binary_kind == 0x004e4942 and binary_size == len(raw) - 28 - length, path
    for view in gltf['bufferViews']:
        assert view.get('byteOffset', 0) + view['byteLength'] <= binary_size, path
    for node in gltf['nodes']:
        assert all(0 <= i < len(gltf['nodes']) for i in node.get('children', [])), path
        if 'mesh' in node:
            assert 0 <= node['mesh'] < len(gltf['meshes']), path
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            for accessor in [*primitive['attributes'].values(), primitive['indices']]:
                assert 0 <= accessor < len(gltf['accessors']), path
            assert 0 <= primitive['material'] < len(gltf['materials']), path
    for accessor in gltf['accessors']:
        assert 0 <= accessor['bufferView'] < len(gltf['bufferViews']), path
    for texture in gltf.get('textures', []):
        assert 0 <= texture['source'] < len(gltf['images']), path
    for image in gltf.get('images', []):
        assert 'uri' not in image and 0 <= image['bufferView'] < len(gltf['bufferViews']), path
    return gltf


def main():
    terrain = gzip.decompress((ROOT / 'assets/argent/region.gmap.gz').read_bytes())
    magic, ox, oz, width, height = struct.unpack_from('<4s4I', terrain)
    assert magic == b'GNR1' and width == height == 512
    assert len(terrain) == 20 + width * height * 7
    manifest = json.loads((ROOT / 'assets/monsters/manifest.json').read_text())
    assert manifest['streaming'] is True and len(manifest['regions']) == 160
    assert len(manifest['spawns']) == 10435 and len(manifest['species']) == 129
    for record in manifest['spawns']:
        assert record['species'] in manifest['species']
        assert 0 <= record['x'] < 4096 and 0 <= record['z'] < 4096
    total = 0
    for species in manifest['species'].values():
        path = ROOT / 'assets/monsters' / species['model']
        gltf = verify_glb(path)
        assert gltf['skins'] and gltf['animations'] and gltf['images'], path
        assert species['attack'] == 0 or any('Ataque 1' in a['name'] for a in gltf['animations']), path
        total += path.stat().st_size
        assert path.stat().st_size < 1024 * 1024, 'Modelo individual ultrapassou 1 MiB'
    gltf = verify_glb(ROOT / 'assets/argent/modelos_cenario.glb')
    for path in (ROOT / 'assets/characters').glob('*.glb'):
        verify_glb(path)
    equipment=json.loads((ROOT / 'assets/equipment/manifest.json').read_text())
    assert equipment['minimumLevel']==1 and equipment['originalTier']==55
    count=0
    for job,record in equipment['sets'].items():
        assert all(i['originalLevel']==55 and i['minimumLevel']==1 for i in record['items'])
        for relative in record['models'].values():
            asset=verify_glb(ROOT/'assets/equipment'/relative)
            assert asset['skins'] and asset['images']
            codes={int(a['name'].split(' · ')[0]) for a in asset['animations']}
            assert {1+record['pose']*54,5+record['pose']*54,7+record['pose']*54} <= codes
            count+=1
    assert count==14
    print(f'OK: 7 classes; {count} visuais Evanescence; poses de arma e nível mínimo 1.')
    print(f'OK: Argent {width}×{height}; {len(terrain):,} bytes de terreno; '
          f'{len(gltf["nodes"][0]["children"])} modelos de cenário; '
          f'{len(manifest["species"])} monstros / {total:,} bytes sob demanda; 4 personagens.')


if __name__ == '__main__':
    main()
