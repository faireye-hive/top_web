#!/usr/bin/env python3
"""Audit all published tier-55 weapon GLBs, including second/effect passes.

A secondary 1.BMP is a *candidate* additive pass. Its original LGO blend flag
cannot be inferred from glTF alone, because legacy GLBs discarded that flag.
"""
import json
import re
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MODEL_DIR=ROOT/'assets/equipment/models'
MANIFEST=ROOT/'assets/equipment/manifest.json'

def read_gltf(path):
    with path.open('rb') as f:
        header=f.read(20)
        if len(header)!=20 or header[:4]!=b'glTF':
            raise ValueError(f'{path}: invalid GLB')
        total=struct.unpack_from('<I',header,8)[0]
        if total!=path.stat().st_size:
            raise ValueError(f'{path}: length mismatch')
        count=struct.unpack_from('<I',header,12)[0]
        if header[16:20]!=b'JSON':
            raise ValueError(f'{path}: missing JSON chunk')
        return json.loads(f.read(count))

def audit(path,expected_slots=None):
    g=read_gltf(path)
    materials=g.get('materials',[])
    textures=g.get('textures',[])
    images=g.get('images',[])
    nodes=g.get('nodes',[])
    parts=[]
    for node in nodes:
        if 'mesh' not in node:continue
        match=re.match(r'^Parte\s+(\d+)\s*[·]',node.get('name',''))
        if not match and node.get('extras',{}).get('topRole')!='weapon':continue
        number=int(match[1]) if match else -1
        if number<5 and node.get('extras',{}).get('topRole')!='weapon':continue
        parts.append((number,node))
    parts.sort(key=lambda item:item[0])
    weapon_slots=sorted(expected_slots or ())
    if weapon_slots and len(parts)!=len(weapon_slots):
        raise ValueError(f'{path}: {len(parts)} weapon nodes vs {len(weapon_slots)} expected slots')
    findings=[]
    for index,(_,node) in enumerate(parts):
        item=[]
        for i,prim in enumerate(g['meshes'][node['mesh']]['primitives']):
            material=materials[prim['material']]
            pbr=material.get('pbrMetallicRoughness',{})
            tex=pbr.get('baseColorTexture')
            image=(images[textures[tex['index']]['source']].get('name')
                   if tex is not None else None)
            candidate=i>0 and bool(re.fullmatch(r'1\.bmp',image or '',flags=re.I))
            item.append({'primitive':i,'material':material.get('name'),
                         'texture':image,'uv':'TEXCOORD_0' in prim.get('attributes',{}),
                         'original_blend':material.get('extras',{}).get('topOriginalBlend'),
                         'additive_candidate':candidate})
        findings.append({'node':node.get('name'),
                         'slot':node.get('extras',{}).get('equipmentSlot') or
                            (weapon_slots[index] if len(weapon_slots)==len(parts) else None),
                         'materials':item})
    return {'model':path.name,'weapons':findings,'images_total':len(images)}

def audit_all():
    manifest=json.loads(MANIFEST.read_text())
    results=[]
    for job,entry in sorted(manifest['sets'].items()):
        expected=[item['slot'] for item in entry['items'] if item['slot'] in (6,9)]
        for actor,model in sorted(entry['models'].items()):
            path=MODEL_DIR/Path(model).name
            report=audit(path,expected)
            report.update(job=job,actor=actor)
            results.append(report)
    return results

if __name__=='__main__':
    results=audit_all()
    candidates=0
    for item in results:
        print(f"\n{item['actor']} / {item['job']} ({item['model']})")
        for weapon in item['weapons']:
            print(f"  slot {weapon['slot']}: {weapon['node']}")
            for part in weapon['materials']:
                if part['additive_candidate']: candidates+=1
                kind='POSSIVEL CAMADA' if part['additive_candidate'] else 'material'
                print(f"    {part['primitive']}: {part['texture']} "
                      f"({kind}, original_blend={part['original_blend']}, UV={part['uv']})")
    print(f"\nRESUMO: {len(results)} modelos, "
          f"{sum(len(r['weapons']) for r in results)} armas, "
          f"{candidates} submalhas com textura secundaria 1.BMP")
