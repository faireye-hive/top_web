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
for character in ('lance','carsise','phyllis'):
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
print(f'OK: {len(data["classes"])} classes, 28 slots, {len(skills)} skills diferentes, 25 ícones e 3 GLBs de animações.')
