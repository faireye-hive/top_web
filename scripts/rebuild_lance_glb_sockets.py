#!/usr/bin/env python3
"""Rebuild the published Lance GLB with authentic LAB weapon sockets.

The source GLB already contains all 72 converted animation clips and all
mesh/texture data. This rebuild preserves the BIN chunk byte-for-byte and
adds skeletal socket nodes from the original 0000.lab matrices (maintained in
js/historical-weapon-dummies.mjs), plus explicit weapon slot metadata.
Can be run without NumPy or access to the proprietary Client ZIP.
For full source conversion, use scripts/build_evanescence.py on the Client ZIP.
"""
import argparse
import json
import math
import re
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'assets/equipment/models/lance-crusader.glb'
DUMMIES=ROOT/'js/historical-weapon-dummies.mjs'
NEEDED={6,9,21,22}


def parse_dummies(path=DUMMIES):
    text=path.read_text('utf8')
    match=re.search(r'export const LANCE_LAB_DUMMIES=(\{.*?\});',text,re.S)
    if not match:raise ValueError('LANCE_LAB_DUMMIES não encontrado')
    values={int(k):v for k,v in json.loads(match.group(1)).items()}
    if not NEEDED.issubset(values):raise ValueError('Faltam dummies de mão/costas')
    for ident,row in values.items():
        if len(row['matrix'])!=16 or not all(map(math.isfinite,row['matrix'])):
            raise ValueError(f'Dummy {ident} inválido')
    return values


def matmul(a,b):
    # LAB e inverseBind foram serializados em ordem de vetores-linha
    # DirectX; o flat resultante é a matriz column-major glTF.
    return [sum(a[r*4+k]*b[k*4+c] for k in range(4))
            for r in range(4) for c in range(4)]


def load_glb(path):
    raw=path.read_bytes()
    if len(raw)<28 or raw[:4]!=b'glTF':
        raise ValueError('Arquivo não é GLB')
    version,length=struct.unpack_from('<II',raw,4)
    if version!=2 or length!=len(raw):raise ValueError('Cabeçalho inválido')
    n,kind=struct.unpack_from('<I4s',raw,12)
    if kind!=b'JSON' or 20+n>len(raw):raise ValueError('JSON chunk inválido')
    gltf=json.loads(raw[20:20+n])
    pos=20+n
    bn,btype=struct.unpack_from('<I4s',raw,pos)
    if btype!=b'BIN\\0' or pos+8+bn!=len(raw):
        raise ValueError('BIN chunk inválido')
    return gltf,raw[pos+8:]


def save_glb(path,gltf,binary):
    data=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode()
    data+=b' ' *((-len(data))%4)
    length=12+8+len(data)+8+len(binary)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,length)+
        struct.pack('<I4s',len(data),b'JSON')+data+
        struct.pack('<I4s',len(binary),b'BIN\\0')+binary)


def inverse_bind(gltf,binary,bone):
    skin=gltf['skins'][0]
    joint=skin['joints'][bone]
    acc=gltf['accessors'][skin['inverseBindMatrices']]
    if acc['type']!='MAT4' or acc['componentType']!=5126:
        raise ValueError('Formato de inverseBind não suportado')
    view=gltf['bufferViews'][acc['bufferView']]
    offset=view.get('byteOffset',0)+acc.get('byteOffset',0)+bone*view.get('byteStride',64)
    if offset+64>len(binary):raise ValueError('inverseBind fora do BIN')
    return joint,struct.unpack_from('<16f',binary,offset)


def add_socket_nodes(gltf,binary,dummies):
    names={node.get('name') for node in gltf['nodes']}
    for ident,row in sorted(dummies.items()):
        name=f'TOP Dummy {ident}'
        if name in names:continue
        parent=row['parent']
        bone_node,inv=inverse_bind(gltf,binary,parent)
        matrix=matmul(row['matrix'],inv)
        if not all(map(math.isfinite,matrix)):
            raise ValueError(f'Matriz não-finita no socket {ident}')
        index=len(gltf['nodes'])
        gltf['nodes'].append({
            'name':name,'matrix':matrix,
            'extras':{'topDummy':ident,'topParentBone':parent,'source':'LAB'}
        })
        gltf['nodes'][bone_node].setdefault('children',[]).append(index)
    present={n.get('extras',{}).get('topDummy') for n in gltf['nodes']}
    if not NEEDED.issubset(present):
        raise ValueError('GLB ainda não contém todos os sockets essenciais')


def mark_weapon_parts(gltf):
    # A conversão Evanescence escreve 5 partes corporais, depois dois
    # skinned meshes das espadas. Não tratar peças de roupa como armas.
    meshes=[]
    for n in gltf['nodes']:
        m=re.fullmatch(r'Parte (\d+) · (.+\\.lgo)',n.get('name',''))
        if m and 'mesh' in n and 'skin' in n and int(m[1])>=5:
            meshes.append((int(m[1]),n))
    meshes.sort(key=lambda item:item[0])
    if len(meshes)!=2:raise ValueError(f'Esperadas 2 espadas LGO; obtidas {len(meshes)}')
    for (_,node),slot in zip(meshes,(6,9)):
        node.setdefault('extras',{}).update({
            'topRole':'weapon','equipmentSlot':slot,'handDummy':slot,
            'backDummy':22 if slot==6 else 21
        })


def check_clips(gltf):
    clips=[c.get('name','') for c in gltf.get('animations',[])]
    ids={int(m[1]) for name in clips if (m:=re.match(r'^(\d{1,3})\s*·',name))}
    needed={163,166,167,168,169}
    if not needed.issubset(ids):
        raise ValueError(f'Clipes básicos faltando: {sorted(needed-ids)}')
    return len(clips)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--file',type=Path,default=MODEL)
    p.add_argument('--verify-only',action='store_true')
    args=p.parse_args()
    gltf,bin_chunk=load_glb(args.file)
    clips=check_clips(gltf)
    dummies=parse_dummies()
    if not args.verify_only:
        add_socket_nodes(gltf,bin_chunk,dummies)
        mark_weapon_parts(gltf)
        save_glb(args.file,gltf,bin_chunk)
    else:
        found={n.get('extras',{}).get('topDummy') for n in gltf['nodes']}
        if not NEEDED.issubset(found):raise ValueError('Sockets ausentes')
        slots={n.get('extras',{}).get('equipmentSlot') for n in gltf['nodes']
               if n.get('extras',{}).get('topRole')=='weapon'}
        if slots!={6,9}:raise ValueError('Slots de armas não identificados')
    print(f'OK: {args.file}, {clips} clips, {len(bin_chunk)} bytes BIN, '
          f'{len(gltf["nodes"])} nodes; sockets originais {sorted(dummies)}')


if __name__=='__main__':
    main()
