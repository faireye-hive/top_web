#!/usr/bin/env python3
"""Export the original Royal Major Hat (5488) for the refinement preview/game."""
import argparse
import json
from pathlib import Path
import struct
import sys
import tempfile
from zipfile import ZipFile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Lance'))
from converter import convert
from selecionar_assets import parse_table,model_name_from_item,find_path

def build(client):
    items=parse_table(client/'scripts/table/iteminfo.txt')
    characters=parse_table(client/'scripts/table/characterinfo.txt')
    out=ROOT/'assets/equipment/headgear';out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for ident,actor in enumerate(['lance','carsise','phyllis','ami'],1):
        character=characters[ident];framework=int(character[5])
        filename=model_name_from_item(items,5488,framework)
        model=find_path(client,'model/character/'+filename)
        if not model:raise FileNotFoundError(filename)
        target=out/(actor+'-royal-major.glb')
        with tempfile.TemporaryDirectory(prefix='refine-hat-') as folder:
            archive=Path(folder)/'head.zip'
            with ZipFile(archive,'w') as zipped:
                zipped.write(client/f'animation/{framework:04d}.lab',f'{framework:04d}.lab')
                zipped.write(client/'scripts/txt/CharacterAction.tx','CharacterAction.tx')
                zipped.write(model,filename)
            result=convert(archive,[client/'texture/character',client/'texture/item'],target,
                           action_section=int(character[20]),action_ids=[1])
            if result['missing']:raise ValueError(result['missing'])
        data=target.read_bytes();size=struct.unpack_from('<I',data,12)[0]
        gltf=json.loads(data[20:20+size]);binary=data[28+size:]
        for node in gltf['nodes']:
            if 'mesh' in node:node['extras']={'topRole':'hat','equipmentSlot':1,'sourceItemId':5488}
        # Bind this asset to the active character skeleton at runtime.
        gltf.pop('animations',None)
        raw=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode();raw+=b' '*((-len(raw))%4)
        total=28+len(raw)+len(binary)
        target.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(raw),b'JSON')+raw+
                           struct.pack('<I4s',len(binary),b'BIN\0')+binary)
        rows.append({'actor':actor,'model':target.name,'source':filename,'bytes':target.stat().st_size})
    (out/'manifest.json').write_text(json.dumps({'version':1,'itemId':5488,'name':items[5488][1],'models':rows},indent=2)+'\n')
    print(json.dumps(rows,indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('client',type=Path);build(parser.parse_args().client)
