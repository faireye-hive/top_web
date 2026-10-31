#!/usr/bin/env python3
"""Print a small, source-of-truth report from the published Lance GLB."""
import json
import struct
from pathlib import Path

MODEL=Path(__file__).resolve().parents[1]/'assets/equipment/models/lance-crusader.glb'

def inspect(path=MODEL):
    with path.open('rb') as f:
        header=f.read(20)
        if len(header)<20 or header[:4]!=b'glTF':
            raise ValueError('GLB header inválido')
        size=struct.unpack_from('<I',header,12)[0]
        asset=json.loads(f.read(size))
    nodes=asset['nodes']
    print(f'GLB: {path.name}, nodes={len(nodes)}, meshes={len(asset.get("meshes",[]))}, clips={len(asset.get("animations",[]))}')
    for i,node in enumerate(nodes):
        if 'mesh' not in node and 'topDummy' not in node.get('extras',{}):
            continue
        mesh=asset['meshes'][node['mesh']] if 'mesh' in node else None
        print(json.dumps({
            'node':i,'name':node.get('name'),
            'skin':node.get('skin'),
            'primitives':len(mesh.get('primitives',[])) if mesh else None,
            'extras':node.get('extras',{}),
        },ensure_ascii=False))
    equipped=[n for n in nodes if n.get('extras',{}).get('topRole')=='weapon']
    assert len(equipped)==2, f'Esperadas duas armas marcadas; {len(equipped)}'
    assert {x.get('extras',{}).get('equipmentSlot') for x in equipped}=={6,9}
    assert all('skin' in x and 'mesh' in x for x in equipped)
    print('OK: metadados de ambas as espadas estão no arquivo.')
    return asset

if __name__=='__main__':
    inspect()
