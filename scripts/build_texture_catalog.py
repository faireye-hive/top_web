#!/usr/bin/env python3
"""Index published images and GLB images; recover lossless terrain from Client."""
import argparse, io, json, re, struct
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def legacy_image(raw):
    if len(raw)>=92 and raw[-4:]==b'mp.x' and (raw[-48:-44]==b'DDS ' or raw[-48:-46]==b'BM'):
        raw=raw[-48:-4]+raw[44:-48]+raw[:44]
    return Image.open(io.BytesIO(raw))

def category(path):
    for prefix,label in [('assets/equipment/','Equipamentos'),('assets/characters/','Personagens'),('assets/npcs/','NPCs'),('assets/monsters/','Monstros'),('assets/boats/','Barcos'),('assets/pets/','Pets'),('assets/skills/','Skills'),('assets/effects/','Efeitos')]:
        if path.startswith(prefix):return label
    return 'Cenário'

def build(client=None):
    output=ROOT/'assets/textures';output.mkdir(exist_ok=True)
    terrain=[];atlas=Image.new('RGB',(2048,2048))
    if client:
        folder=client/'texture/terrain';files={p.name.lower():p for p in folder.iterdir() if p.is_file()}
        for line in (ROOT/'referencias/terraininfo.txt').read_text(encoding='latin1').splitlines():
            match=re.match(r'\s*(\d+)\s+texture/terrain/(\S+)',line)
            if not match:continue
            ident=int(match[1]);name=match[2];source=files.get(name.lower()+'.png') or files.get(name.lower())
            if not source:raise FileNotFoundError(name)
            original=legacy_image(source.read_bytes());image=original.convert('RGBA')
            target=output/'terrain'/f'{ident}-{Path(name).stem}.png';target.parent.mkdir(exist_ok=True)
            image.save(target,optimize=True)
            x,y=ident%8*256,ident//8*256;tile=image.convert('RGB').resize((252,252),Image.Resampling.LANCZOS)
            atlas.paste(tile,(x+2,y+2));atlas.paste(tile.crop((0,0,1,252)).resize((2,252)),(x,y+2));atlas.paste(tile.crop((251,0,252,252)).resize((2,252)),(x+254,y+2))
            atlas.paste(atlas.crop((x,y+2,x+256,y+3)).resize((256,2)),(x,y));atlas.paste(atlas.crop((x,y+253,x+256,y+254)).resize((256,2)),(x,y+254))
            terrain.append({'id':f'terrain:{ident}','tile':ident,'name':name,'category':'Terreno','asset':target.relative_to(ROOT).as_posix(),
                'width':image.width,'height':image.height,'mime':'image/png','bytes':target.stat().st_size,'sourceFormat':original.format})
        # Slot zero is a valid fallback, not an unrelated neighboring texture.
        atlas.paste(atlas.crop((256,0,512,256)),(0,0))
        atlas.save(output/'terrain-atlas.webp',lossless=True,method=6)
    elif (output/'catalog.json').exists():
        terrain=json.loads((output/'catalog.json').read_text())['terrain']
    entries=[]
    for path in sorted((ROOT/'assets').rglob('*')):
        if not path.is_file() or output in path.parents:continue
        asset=path.relative_to(ROOT).as_posix()
        if path.suffix.lower() in ['.png','.jpg','.jpeg','.webp']:
            if '/textures/' not in asset:continue # UI icons/overviews are not world-material textures.
            with Image.open(path) as image:
                entries.append({'id':'image:'+asset,'asset':asset,'name':path.name,'category':category(asset),'width':image.width,'height':image.height,'mime':Image.MIME[image.format],'bytes':path.stat().st_size})
        elif path.suffix.lower()=='.glb':
            data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
            for index,image in enumerate(gltf.get('images',[])):
                if 'bufferView' not in image:continue
                view=gltf['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0);raw=binary[offset:offset+view['byteLength']]
                with Image.open(io.BytesIO(raw)) as picture:
                    entries.append({'id':f'glb:{asset}#{index}','asset':asset,'image':index,'name':image.get('name') or f'Imagem {index+1}','category':category(asset),
                        'width':picture.width,'height':picture.height,'mime':image.get('mimeType',Image.MIME[picture.format]),'bytes':len(raw)})
    result={'version':1,'atlas':{'original':'assets/textures/terrain-atlas.webp','legacy':'assets/terrain_atlas.jpg','cell':256,'padding':2,'columns':8,'repeatMeters':4},'terrain':terrain,'textures':entries}
    (output/'catalog.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    overrides=output/'overrides.json'
    if not overrides.exists():overrides.write_text('{"version":1,"entries":[],"quality":{}}\n')
    print(f'{len(terrain)} terrenos, {len(entries)} texturas; atlas sem perdas: {(output/"terrain-atlas.webp").stat().st_size:,} bytes')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--client',type=Path);build(parser.parse_args().client)
