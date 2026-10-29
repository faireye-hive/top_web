#!/usr/bin/env python3
"""Exportador do terreno MindPower (780627) e posicionamentos HF Object File.
Sem bibliotecas externas. As cores são as do arquivo original, as texturas
reais só ficam disponíveis se o usuário fornecer os arquivos do Client.

Exemplos:
 python3 converter_garner.py /caminho/garner.map --obj /caminho/garner.obj
 python3 converter_garner.py /caminho/garner.map --ox 1536 --oy 2048 --size 1024
"""
from __future__ import annotations
import argparse, gzip, json, mmap, struct
from pathlib import Path
from collections import Counter

TILE_FMT = '<BbHHB'  # id textura, altura em dm, cor 565, region, 4 quadrantes bloqueados
TILE_SIZE = struct.calcsize(TILE_FMT)
DEFAULT = struct.pack(TILE_FMT, 22, -20, 65535, 0, 0)

def export(map_path: Path, obj_path: Path | None, out: Path, ox: int, oy: int, width: int, height: int):
    with map_path.open('rb') as f:
        mm=mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        magic, mw, mh, sw, sh = struct.unpack_from('<5I', mm, 0)
        if magic != 780627 or sw != 8 or sh != 8: raise ValueError('Formato .map MindPower não reconhecido')
        if min(ox, oy) < 0 or ox+width>mw or oy+height>mh: raise ValueError('Região fora dos limites do mapa')
        secx=(mw+7)//8
        data_offset=20+secx*((mh+7)//8)*4
        payload=bytearray(DEFAULT*(width*height))
        textures=Counter(); populated=0
        for sy in range(oy//8, (oy+height+7)//8):
            for sx in range(ox//8, (ox+width+7)//8):
                offset=struct.unpack_from('<I',mm,20+(sy*secx+sx)*4)[0]
                if offset == 0: continue
                if offset<data_offset or offset+960>len(mm):raise ValueError('Offset de seção inválido')
                for iy in range(8):
                    world_y=sy*8+iy
                    if not oy<=world_y<oy+height:continue
                    for ix in range(8):
                        world_x=sx*8+ix
                        if not ox<=world_x<ox+width:continue
                        start=offset+(iy*8+ix)*15
                        tex=mm[start+4]
                        hei=struct.unpack_from('<b',mm,start+7)[0]
                        color=struct.unpack_from('<H',mm,start+5)[0]
                        region=struct.unpack_from('<H',mm,start+8)[0]
                        blocked=sum(((mm[start+11+k]>>7)&1)<<k for k in range(4))
                        addr=((world_y-oy)*width+(world_x-ox))*TILE_SIZE
                        struct.pack_into(TILE_FMT,payload,addr,tex,hei,color,region,blocked)
                        populated+=1; textures[tex]+=1
        mm.close()
    out.mkdir(parents=True,exist_ok=True)
    header=struct.pack('<4s4I',b'GNR1',ox,oy,width,height)
    outmap=out/'region.gmap.gz'
    with gzip.open(outmap,'wb',compresslevel=6) as gzipfile:
        gzipfile.write(header)
        gzipfile.write(payload)
    entries=[]; kind_counts=Counter(); id_counts=Counter()
    if obj_path is not None and obj_path.is_file():
        with obj_path.open('rb') as f:
            obj=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
            if obj[:15] != b'HF Object File!' or struct.unpack_from('<i',obj,16)[0] != 600:
                raise ValueError('Arquivo .obj não reconhecido (esperado HF Object File! versão 600)')
            cols,rows,section_w,section_h = struct.unpack_from('<4i',obj,24)
            if min(cols,rows,section_w,section_h)<=0:raise ValueError('Dimensões OBJ inválidas')
            for sy in range(max(0,oy//section_h), min(rows,((oy+height+section_h-1)//section_h))):
                for sx in range(max(0,ox//section_w), min(cols,((ox+width+section_w-1)//section_w))):
                    off,count=struct.unpack_from('<ii',obj,44+(sy*cols+sx)*8)
                    if off<=0 or count<=0:continue
                    count=min(count,25)
                    if off+count*20>len(obj): continue
                    for i in range(count):
                        pos=off+i*20
                        kind_id=struct.unpack_from('<H',obj,pos)[0]
                        kind, ident=kind_id>>14,kind_id&0x3fff
                        nx,ny=struct.unpack_from('<II',obj,pos+4)
                        px=(sx*section_w*100+nx)/100
                        py=(sy*section_h*100+ny)/100
                        if not (ox<=px<ox+width and oy<=py<oy+height):continue
                        dh,yaw=struct.unpack_from('<hh',obj,pos+12)
                        kind_counts[kind]+=1
                        id_counts[ident]+=1
                        # Tipo 0: CSceneObj::_UpdateYaw faz Angle2Radian(short), em graus.
                        # Tipo 1: EffectObj usa o mesmo short/100, em radianos.
                        yaw_out=int(yaw) if kind==0 else round(yaw/100,2)
                        entries.append([round(px,2),round(py,2),ident,kind,round(dh/100,2),yaw_out])
            obj.close()
    meta={'source_map':'garner.map','origin':[ox,oy],'size':[width,height],
          'tiles_present':populated,'obj_placements':len(entries),
          'object_types':dict(kind_counts),
          'top_texture_ids':textures.most_common(28),
          'notes':'Posicionamentos OBJ não incluem geometria LGO dos objetos. Cores de solo na Web são aproximações.'}
    (out/'objects.json').write_text(json.dumps(entries,separators=(',',':')),encoding='utf-8')
    (out/'meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Região',ox,oy,width,height,'tiles reais',populated,'objetos',len(entries))
    print('Arquivos:',outmap, f'{outmap.stat().st_size/1024/1024:.2f} MiB')
    return meta

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('map',type=Path)
    p.add_argument('--obj',type=Path)
    p.add_argument('--out',type=Path,default=Path(__file__).parent/'assets')
    p.add_argument('--ox',type=int,default=1728)
    p.add_argument('--oy',type=int,default=2240)
    p.add_argument('--size',type=int,default=1024)
    args=p.parse_args()
    export(args.map,args.obj,args.out,args.ox,args.oy,args.size,args.size)
