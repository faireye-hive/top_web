#!/usr/bin/env python3
"""Divide o Garner original em setores GNR1 e gera uma visão geral leve."""
import gzip,json,struct
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def main():
    data=gzip.decompress((ROOT/'assets/region.gmap.gz').read_bytes())
    magic,ox,oz,w,h=struct.unpack_from('<4s4I',data)
    if magic!=b'GNR1' or len(data)!=20+w*h*7:raise ValueError('Terreno inválido')
    tiles=np.frombuffer(data,dtype=np.uint8,offset=20).reshape(h,w,7)
    out=ROOT/'assets/garner';out.mkdir(exist_ok=True);(out/'terrain').mkdir(exist_ok=True)
    size=256;total=0
    for z in range(0,h,size):
        for x in range(0,w,size):
            block=tiles[z:z+size,x:x+size]
            raw=struct.pack('<4s4I',magic,ox+x,oz+z,block.shape[1],block.shape[0])+block.tobytes()
            packed=gzip.compress(raw,compresslevel=9,mtime=0)
            (out/f'terrain/{x//size}-{z//size}.gmap.gz').write_bytes(packed);total+=len(packed)
    sample=tiles[::2,::2];region=sample[:,:,4].astype('uint16')+(sample[:,:,5].astype('uint16')<<8)
    rgb=np.empty((*sample.shape[:2],3),dtype=np.uint8);rgb[:]=[15,84,133]
    land=(region&9)!=0;rgb[land]=[76,124,78]
    rgb[land & np.isin(sample[:,:,0],[2,3,4,13,20,21,22,37,47,48,49])]=[190,179,144]
    rgb[land & np.isin(sample[:,:,0],[14,15,16,34,35,36,44,45,46])]=[208,187,123]
    rgb[land & np.isin(sample[:,:,0],[11,26,27,28,29,32,38,40,41])]=[178,203,209]
    rgb[(region&8)!=0]=[181,142,90]
    Image.fromarray(rgb).save(out/'overview.png',optimize=True)
    report={'version':1,'name':'Garner original','origin':[ox,oz],'size':[w,h],'sectorSize':size,
            'terrain':'assets/garner/terrain/{x}-{z}.gmap.gz','overview':'assets/garner/overview.png',
            'objects':'assets/objects.json','scenery':'assets/modelos_cenario.glb','compressedTerrainBytes':total}
    (out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
