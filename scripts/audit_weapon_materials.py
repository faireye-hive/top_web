#!/usr/bin/env python3
"""Audit published weapon materials and embedded texture coverage (GLB JSON only)."""
import json
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'assets/equipment/models'

def read_gltf(path):
    with path.open('rb') as f:
        head=f.read(20)
        if len(head)!=20 or head[:4]!=b'glTF':
            raise ValueError(f'{path}: invalid GLB')
        total=struct.unpack_from('<I',head,8)[0]
        if total!=path.stat().st_size:
            raise ValueError(f'{path}: length mismatch')
        n=struct.unpack_from('<I',head,12)[0]
        return json.loads(f.read(n))

def audit(path):
    g=read_gltf(path)
    materials=g.get('materials',[])
    tex=g.get('textures',[])
    images=g.get('images',[])
    findings=[]
    for node in g.get('nodes',[]):
        if 'mesh' not in node or not (node.get('extras',{}).get('topRole')=='weapon'
                                  or ('Parte 5' in node.get('name','') and path.name.endswith('-crusader.glb'))
                                  or ('Parte 6' in node.get('name','') and path.name.endswith('-crusader.glb'))):
            continue
        items=[]
        for i,prim in enumerate(g['meshes'][node['mesh']]['primitives']):
            mat=materials[prim['material']]
            pbr=mat.get('pbrMetallicRoughness',{})
            ref=pbr.get('baseColorTexture')
            img=None
            if ref is not None:
                img=images[tex[ref['index']]['source']].get('name')
            items.append({'primitive':i,'material':mat.get('name'),
                          'texture':img,
                          'fallback_color':pbr.get('baseColorFactor') if img is None else None,
                          'uv': 'TEXCOORD_0' in prim.get('attributes',{})})
        findings.append({'node':node.get('name'),'slot':node.get('extras',{}).get('equipmentSlot'),
                         'materials':items})
    return {'model':path.name,'images_total':len(images),'weapons':findings}

if __name__=='__main__':
    for path in (MODELS/'lance-crusader.glb',MODELS/'phyllis-crusader.glb'):
        print(json.dumps(audit(path),ensure_ascii=False,indent=2))
