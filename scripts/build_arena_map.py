#!/usr/bin/env python3
"""Exporta teampk original: terreno 96×96, cenário, colisões e minimapa."""
import argparse
import gzip
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tool'))
from converter_garner import export
import montar_mundo

def build(client,sources):
    out=ROOT/'assets/arena';out.mkdir(parents=True,exist_ok=True)
    map_path=client/'map/teampk.map'
    _,width,height,_,_=struct.unpack('<5I',map_path.read_bytes()[:20])
    report=export(map_path,client/'map/teampk.obj',out,0,0,width,height)
    report['source_map']='teampk.map'
    (out/'meta.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    objects=json.loads((out/'objects.json').read_text())
    catalog=json.loads((ROOT/'assets/objects_catalog.json').read_text())
    with tempfile.TemporaryDirectory(prefix='.arena-build-',dir=ROOT) as tmp:
        executable=Path(tmp)/'lmo_dump'
        subprocess.run(['g++','-std=c++17','-O2','-I'+str(sources/'Engine/include'),
                        str(ROOT/'tools/lmo_dump.cpp'),str(sources/'Engine/src/top/ModelFile.cpp'),'-o',str(executable)],check=True)
        executable.chmod(0o755)
        montar_mundo.compile_reader=lambda:executable
        models=montar_mundo.InputSource(client/'model/scene')
        textures=montar_mundo.InputSource(client/'texture/scene')
        try:report['scenery']=montar_mundo.build_library(objects,catalog,models,textures,out/'scenery.glb')
        finally:models.close();textures.close()
    errors=report['scenery']['problemas']
    if errors:raise RuntimeError(f'Recursos da Arena incompletos: {errors}')
    raw=gzip.decompress((out/'region.gmap.gz').read_bytes())
    tiles=np.frombuffer(raw,dtype=np.uint8,offset=20).reshape(height,width,7)
    region=tiles[:,:,4].astype('uint16')+(tiles[:,:,5].astype('uint16')<<8)
    rgb=np.zeros((height,width,3),dtype=np.uint8);rgb[:]=[17,52,68]
    rgb[(region&9)!=0]=[135,143,121];rgb[np.isin(tiles[:,:,0],[9,43])]=[168,158,132]
    rgb[tiles[:,:,0]==21]=[73,115,64]
    Image.fromarray(rgb).resize((384,384)).save(out/'overview.png',optimize=True)
    manifest={'version':1,'name':'Arena · Torre da Provação','source':'Client/map/teampk.map + teampk.obj',
              'origin':[0,0],'size':[width,height],'spawn':{'x':44.5,'z':35.5},
              'terrain':'assets/arena/region.gmap.gz','overview':'assets/arena/overview.png',
              'objects':'assets/arena/objects.json','scenery':'assets/arena/scenery.glb'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('client',type=Path);parser.add_argument('--sources',type=Path)
    args=parser.parse_args();client=args.client.expanduser().resolve();build(client,args.sources or client.parent/'sources')
