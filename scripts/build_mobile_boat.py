#!/usr/bin/env python3
"""Exporta o casco Guppy original e seus parâmetros para o cliente mobile."""
import argparse
import io
import json
import sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Lance'))
from converter import GLBWriter, parse_lgo, find_texture


def table(path):
    return {int(r[0]):r for line in path.read_text('latin1').splitlines()
            if (r:=line.split('\t'))[0].isdigit()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client',type=Path)
    args=parser.parse_args()
    client=args.client.resolve()
    ships=table(client/'scripts/table/shipinfo.txt')
    parts=table(client/'scripts/table/shipiteminfo.txt')
    characters=table(client/'scripts/table/characterinfo.txt')
    ship=ships[1]
    hull=parts[int(ship[5])]
    filename=f'{int(hull[2]):010d}.lgo'
    geom=parse_lgo((client/'model/character'/filename).read_bytes(),filename)
    writer=GLBWriter()
    g=writer.gltf
    del g['skins'],g['animations']
    g['nodes']=[{'name':'Guppy · casco original','rotation':[-2**-.5,0,0,2**-.5],'mesh':0,
                 'extras':{'sourceFile':filename,'shipId':1}}]
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
    (dest/'guppy.glb').write_bytes(writer.binary())
    manifest={'version':1,'id':1,'name':ship[1],'model':'assets/boats/guppy.glb',
              'speed':speed/100,'seaLevel':int(character[27])/100,
              'sourceHull':filename,'sourceTables':['shipinfo.txt','shipiteminfo.txt','characterinfo.txt']}
    (dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest))


if __name__=='__main__':main()
