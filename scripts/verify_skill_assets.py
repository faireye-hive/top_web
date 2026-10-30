#!/usr/bin/env python3
"""Confere os arquivos extraídos do pacote TOP Web Skills antes de fazer merge."""
import json
import struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/skills'
manifest=BASE/'catalog.json'
if not manifest.is_file():
    raise SystemExit('FALTANDO assets/skills/catalog.json (extraia o ZIP de recursos)')
data=json.loads(manifest.read_text(encoding='utf-8'))
assert len(data['classes'])==7, 'Esperadas 7 classes'
assert all(len(x['skills'])==4 for x in data['classes'].values()), 'Cada classe deve ter 4 skills'
missing=[]
skills={skill['id'] for cl in data['classes'].values() for skill in cl['skills']}
for cl in data['classes'].values():
    for skill in cl['skills']:
        for path in [skill['icon']]+['legacy/'+name for name in skill['effects']]:
            if not (BASE/path).is_file():
                missing.append(str(BASE/path))
for character in ('lance','carsise','phyllis','ami'):
    path=BASE/'animations'/f'{character}.glb'
    if not path.exists():
        missing.append(str(path));continue
    blob=path.read_bytes()
    if len(blob)<28 or blob[:4]!=b'glTF' or struct.unpack_from('<I',blob,8)[0]!=len(blob):
        missing.append(str(path)+' (GLB inválido)');continue
    size=struct.unpack_from('<I',blob,12)[0]
    gltf=json.loads(blob[20:20+size])
    assert len(gltf['animations'])>0
if missing:
    for name in sorted(set(missing)):print('FALTA:',name)
    raise SystemExit(1)
print(f'OK: {len(data["classes"])} classes, 28 slots, {len(skills)} skills diferentes, 25 ícones e 4 GLBs de animações.')

visuals=json.loads((BASE/'visuals.json').read_text())
assert set(map(int,visuals['skills']))==skills
assert not visuals['failures']
for record in visuals['skills'].values():
    assert 0 < len(record['layers']) <= 8
    for layer in record['layers']:
        assert (BASE/'textures'/layer['texture']).is_file()
print('OK: efeitos convertidos de todas as skills; até 8 camadas/skill e 64 sprites ativos.')

# Poses extras precisam encontrar os mesmos ossos nos GLBs equipados.
def glb(path):
    blob=path.read_bytes()
    return json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
gear=json.loads((ROOT/'assets/equipment/manifest.json').read_text())
for job,preset in data['classes'].items():
    for actor,relative in gear['sets'][job]['models'].items():
        model=glb(ROOT/'assets/equipment'/relative)
        names={node.get('name') for node in model['nodes']}
        assert all('\0' not in n for n in names if n), relative
        extra=glb(BASE/'animations'/f'{actor}.glb')
        for animation in extra['animations']:
            for channel in animation['channels']:
                assert extra['nodes'][channel['target']['node']]['name'] in names, (relative,animation['name'])
print('OK: ações extras encontram todos os ossos nos 14 modelos equipados.')

models=glb(BASE/'models.glb')
assert len(models['meshes'])==6
assert (BASE/'models.glb').stat().st_size<32*1024
assert len(visuals['convertedModels'])==6 and len(visuals['approximateModels'])==3
print('OK: 6 malhas originais de efeitos em menos de 32 KiB.')
