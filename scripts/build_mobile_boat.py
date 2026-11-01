#!/usr/bin/env python3
"""Exporta cascos originais para mobile; --all gera Guppy e Phantom Galley."""
import argparse
import io
import json
import sys
import struct
import subprocess
import numpy as np
sys.dont_write_bytecode=True
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Lance'))
from converter import GLBWriter, parse_lgo, find_texture


def table(path):
    return {int(r[0]):r for line in path.read_text('latin1').splitlines()
            if (r:=line.split('\t'))[0].isdigit()}


def parse_hull(data,name):
    if struct.unpack_from('<I',data)[0]!=0:return parse_lgo(data,name)
    mtl_size,mesh_size=struct.unpack_from('<2I',data,104)
    mat_version,count=struct.unpack_from('<2I',data,120)
    record,texture_offset={0:(1028,212),1:(1164,248),2:(1004,216)}[mat_version]
    textures=[data[128+i*record+texture_offset:128+i*record+texture_offset+64].split(b'\0')[0].decode('latin1') for i in range(count)]
    start=120+mtl_size
    version,fvf,primitive,vertices,index_count,subsets,bones=struct.unpack_from('<7I',data,start)
    if version not in (0,1) or bones or primitive!=4:raise ValueError('Casco antigo não estático')
    ptr=start+4+24+(128 if version==0 else 96)
    groups=[]
    for i in range(subsets):
        faces,offset,_,_=struct.unpack_from('<4I',data,ptr);ptr+=16
        groups.append({'start':offset,'count':faces*3,'tex':textures[i]})
    def read(n):
        nonlocal ptr
        result=np.frombuffer(data,dtype='<f4',count=n,offset=ptr).copy();ptr+=n*4;return result
    position=read(vertices*3).reshape(-1,3)
    normal=read(vertices*3).reshape(-1,3) if fvf&16 else np.zeros_like(position)
    sets=(fvf>>8)&15
    uv=read(vertices*2).reshape(-1,2) if sets else None
    ptr+=max(0,sets-1)*vertices*8
    if fvf&64:ptr+=vertices*4
    indices=np.frombuffer(data,dtype='<u4',count=index_count,offset=ptr).copy();ptr+=index_count*4
    if ptr!=start+mesh_size or indices.max()>=vertices:raise ValueError('Casco antigo truncado')
    return {'position':position,'normal':normal,'uv':uv,'indices':indices,'subsets':groups}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client',type=Path)
    parser.add_argument('--all',action='store_true')
    parser.add_argument('--ship',type=int,default=1)
    parser.add_argument('--slug',default='guppy')
    args=parser.parse_args()
    client=args.client.resolve()
    if args.all:
        for ship_id,slug in [(1,'guppy'),(11,'phantom-galley')]:
            subprocess.run([sys.executable,__file__,str(client),'--ship',str(ship_id),'--slug',slug],check=True)
        dest=ROOT/'assets/boats'
        boats=[json.loads((dest/(slug+'.json')).read_text()) for slug in ['guppy','phantom-galley']]
        manifest={**boats[0],'version':2,'defaultBoat':'phantom-galley','boats':boats}
        (dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        return
    ships=table(client/'scripts/table/shipinfo.txt')
    parts=table(client/'scripts/table/shipiteminfo.txt')
    characters=table(client/'scripts/table/characterinfo.txt')
    ship=ships[args.ship]
    hull=parts[int(ship[5])]
    filename=f'{int(hull[2]):010d}.lgo'
    geom=parse_hull((client/'model/character'/filename).read_bytes(),filename)
    writer=GLBWriter()
    g=writer.gltf
    del g['skins'],g['animations']
    g['nodes']=[{'name':ship[1]+' · casco original','rotation':[-2**-.5,0,0,2**-.5],'mesh':0,
                 'extras':{'sourceFile':filename,'shipId':args.ship}}]
    attrs={'POSITION':writer.arr(geom['position'].astype('<f4'),5126,'VEC3',34962,minmax=True),
           'NORMAL':writer.arr(geom['normal'].astype('<f4'),5126,'VEC3',34962),
           'TEXCOORD_0':writer.arr(geom['uv'].astype('<f4'),5126,'VEC2',34962)}
    g['images']=[]
    g['textures']=[]
    primitives=[]
    for sub in geom['subsets']:
        raw=find_texture(sub['tex'],[client/'texture/character'])
        if not raw:raise ValueError(f'Textura original ausente: {sub["tex"]}')
        output=io.BytesIO()
        Image.open(io.BytesIO(raw)).convert('RGBA').save(output,format='PNG')
        g['images'].append({'name':sub['tex'],'mimeType':'image/png','bufferView':writer.append(output.getvalue())})
        g['textures'].append({'source':len(g['images'])-1})
        g['materials'].append({'name':sub['tex'],'doubleSided':True,'pbrMetallicRoughness':{
            'baseColorTexture':{'index':len(g['textures'])-1},'metallicFactor':0,'roughnessFactor':.9}})
        indices=geom['indices'][sub['start']:sub['start']+sub['count']].astype('<u2')
        primitives.append({'attributes':attrs,'indices':writer.arr(indices,5123,'SCALAR',34963),'material':len(g['materials'])-1})
    g['meshes']=[{'name':filename,'primitives':primitives}]
    speed=int(ship[25])
    selected=[int(ship[i].split(',')[0]) for i in (5,7,6,8,9)]
    engine=parts[selected[2]]
    selected.extend(int(engine[i]) for i in range(3,7) if int(engine[i])>0)
    speed+=sum(int(parts[i][21]) for i in selected if i>0)
    character=characters[int(ship[3])]
    dest=ROOT/'assets/boats'
    dest.mkdir(exist_ok=True)
    (dest/(args.slug+'.glb')).write_bytes(writer.binary())
    bounds=geom['position'].max(0)-geom['position'].min(0)
    radius=float(np.linalg.norm(geom['position'][:,:2],axis=1).max())+.2
    manifest={'version':1,'id':args.ship,'name':ship[1],'model':'assets/boats/'+args.slug+'.glb',
              'slug':args.slug,'radius':round(radius,3),'length':round(float(bounds[1]),3),
              'speed':speed/100,'seaLevel':int(character[27])/100,
              'sourceHull':filename,'sourceTables':['shipinfo.txt','shipiteminfo.txt','characterinfo.txt']}
    (dest/(args.slug+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest))


if __name__=='__main__':main()
