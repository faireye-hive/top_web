#!/usr/bin/env python3
"""Visuais do tier 55: roupas substituídas e armas presas aos dummies LAB.

Só utiliza IDs/modelos/poses. Atributos, nível mínimo e prática são novos no JS.
"""
import argparse
import json
import shutil
import stat
import struct
import sys
import tempfile
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED, is_zipfile
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Lance'))
from converter import convert, parse_lgo
from selecionar_assets import parse_table, model_name_from_item, find_path

# Tier 55 da tabela: Arcane/Malediction são os nomes próprios das classes mágicas.
# As botas/luvas Warrior of Evanescence são nível 50, portanto ficam de fora.
SETS={
 'crusader': {'characters':[1,3], 'items':{2:768,3:807,4:808,6:775,9:775}, 'pose':3},
 'champion': {'characters':[2], 'items':{2:765,9:772}, 'pose':2},
 'sharpshooter': {'characters':[1,3], 'items':{2:779,3:809,4:810,9:783}, 'pose':4},
 'hunter': {'characters':[1,3], 'items':{2:779,3:809,4:810,6:6090}, 'pose':5},
 'cleric': {'characters':[3,4], 'items':{2:791,3:812,4:814,9:787}, 'pose':1},
 'seal-master': {'characters':[3,4], 'items':{2:797,3:811,4:813,9:794}, 'pose':1},
 'voyager': {'characters':[1,3,4], 'items':{2:805,3:815,4:877,9:801}, 'pose':6}
}
NAMES={1:'lance',2:'carsise',3:'phyllis',4:'ami'}


def matrix(data,offset):
    return np.array(struct.unpack_from('<16f',data,offset)).reshape(4,4).T


def weapon_geometry(raw,lab,slot):
    _,bones,_,count,_=struct.unpack_from('<5I',lab)
    offset=20+bones*(72+64)
    dummy=None
    for index in range(count):
        at=offset+index*72
        ident,parent=struct.unpack_from('<II',lab,at)
        if ident==slot:dummy=(parent,matrix(lab,at+8));break
    if dummy is None:raise ValueError(f'Dummy da mão {slot} ausente')
    mtl,mesh,helper,_=struct.unpack_from('<4I',raw,104)
    helper_at=120+mtl+mesh
    grip=None
    if helper>=8:
        kind,records=struct.unpack_from('<II',raw,helper_at)
        if kind&1:
            for index in range(records):
                at=helper_at+8+index*140
                if struct.unpack_from('<I',raw,at)[0]==0:grip=matrix(raw,at+4);break
    if grip is None:raise ValueError('Dummy 0 de empunhadura ausente')
    parent,socket=dummy
    transform=socket@np.linalg.inv(grip)@matrix(raw,16)
    geom=parse_lgo(raw,'weapon')
    positions=geom['position']@transform[:3,:3].T+transform[:3,3]
    normals=geom['normal']@np.linalg.inv(transform[:3,:3])
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
    joints=np.zeros_like(geom['joints']);joints[:,0]=parent
    weights=np.zeros_like(geom['weights']);weights[:,0]=1
    return {'position':positions.astype('f4'),'normal':normals.astype('f4'),
            'joints':joints,'weights':weights}


def prepare_client_source(source: Path, workspace: Path) -> Path:
    """Aceita uma pasta Client, sua pasta-pai ou um ZIP do selecionar_assets.py."""
    if source.is_dir():
        nested = source / 'Client'
        return nested if (nested / 'scripts/table/characterinfo.txt').is_file() else source
    if not source.is_file() or not is_zipfile(source):
        raise ValueError(f'Origem não é pasta Client nem ZIP válido: {source}')

    total_bytes = 0
    with ZipFile(source) as archive:
        for entry in archive.infolist():
            name = PurePosixPath(entry.filename)
            if name.is_absolute() or '..' in name.parts:
                raise ValueError(f'Caminho inseguro no ZIP: {entry.filename}')
            if entry.is_dir() or not name.parts or name.parts[0] != 'Client':
                continue
            if stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError(f'Link simbólico não permitido no ZIP: {entry.filename}')
            total_bytes += entry.file_size
            if total_bytes > 256 * 1024 * 1024:
                raise ValueError('ZIP contém mais de 256 MiB descompactados')
            destination = workspace.joinpath(*name.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source_file, destination.open('wb') as target:
                shutil.copyfileobj(source_file, target)
    client = workspace / 'Client'
    if not (client / 'scripts/table/characterinfo.txt').is_file():
        raise ValueError('ZIP sem Client/scripts/table/characterinfo.txt')
    return client


def selected_action_ids(pose: int, compact: bool = False) -> list[int]:
    """Banco da arma + banco comum, preservando os IDs históricos originais."""
    armed = range(1, 55) if not compact else (1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
    common = range(1, 55) if not compact else (16, 18, 30, 31, 38)
    return sorted({action + pose * 54 for action in armed} | set(common))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client',type=Path,
      help='Pasta Client original ou ZIP gerado por Lance/selecionar_assets.py')
    parser.add_argument('--classes',nargs='+',choices=list(SETS))
    parser.add_argument('--characters',nargs='+',choices=sorted(NAMES.values()),
      help='Limita a conversão aos personagens selecionados (ex.: lance)')
    parser.add_argument('--compact',action='store_true',
      help='Exportar subconjunto leve; padrão exporta 54 IDs da arma e 54 IDs compartilhados')
    args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='top-client-') as workdir:
        client=prepare_client_source(args.client.expanduser().resolve(),Path(workdir))
        build(args,client)


def build(args,client):
    items=parse_table(client/'scripts/table/iteminfo.txt')
    characters=parse_table(client/'scripts/table/characterinfo.txt')
    out=ROOT/'assets/equipment';(out/'models').mkdir(parents=True,exist_ok=True)
    manifest={'version':1,'minimumLevel':1,'originalTier':55,'sets':{}}
    if (args.classes or args.characters) and (out/'manifest.json').exists():
        manifest=json.loads((out/'manifest.json').read_text())
    with tempfile.TemporaryDirectory(prefix='top-gear-') as tmp:
        for job,spec in SETS.items():
            if args.classes and job not in args.classes:continue
            character_ids=[cid for cid in spec['characters']
                           if not args.characters or NAMES[cid] in args.characters]
            if not character_ids:continue
            entries=[]
            for slot,item in spec['items'].items():
                row=items[item]
                if int(row[24])!=55:raise ValueError(f'{item}: item não é do tier 55')
                entries.append({'slot':slot,'id':item,'name':row[1],'originalLevel':55,'minimumLevel':1})
            old_models=manifest['sets'].get(job,{}).get('models',{})
            manifest['sets'][job]={'items':entries,'pose':spec['pose'],
                                   'models':dict(old_models) if args.characters else {}}
            for char_id in character_ids:
                row=characters[char_id];framework=int(row[5]);lab=(client/f'animation/{framework:04d}.lab').read_bytes()
                parts={slot:int(row[8+slot]) for slot in range(5)}
                parts.update(spec['items']);overrides={}
                archive=Path(tmp)/'gear.zip'
                with ZipFile(archive,'w',ZIP_DEFLATED) as zipfile:
                    zipfile.writestr(f'{framework:04d}.lab',lab)
                    zipfile.write(client/'scripts/txt/CharacterAction.tx','CharacterAction.tx')
                    for slot,item in parts.items():
                        filename=model_name_from_item(items,item,framework)
                        source=find_path(client,'model/character/'+filename) or find_path(client,'model/item/'+filename)
                        if not source:raise FileNotFoundError(filename)
                        raw=source.read_bytes();relative=f'slot-{slot}/{filename}'
                        zipfile.writestr(relative,raw)
                        if slot in (6,9):overrides[relative]=weapon_geometry(raw,lab,slot)
                # Exportação completa: 54 IDs do banco armado e 54 do banco
                # compartilhado. convert() ignora os IDs sem frames válidos.
                # --compact mantém o modo leve da versão anterior.
                actions=selected_action_ids(spec['pose'],args.compact)
                filename=f'{NAMES[char_id]}-{job}.glb'
                result=convert(archive,[client/'texture/character',client/'texture/item'],out/'models'/filename,
                               action_section=int(row[20]),action_ids=sorted(set(actions)),geometry_overrides=overrides)
                if result['missing']:raise ValueError(result['missing'])
                manifest['sets'][job]['models'][NAMES[char_id]]='models/'+filename
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Equipamentos:',sum(p.stat().st_size for p in (out/'models').glob('*.glb')),'bytes')


if __name__=='__main__':main()
