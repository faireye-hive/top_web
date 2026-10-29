#!/usr/bin/env python3
"""TOP Web 0.4 - compila qualquer recorte do mapa e TODAS as malhas de cena
presentes nesse recorte em uma biblioteca GLB compartilhada.

Requer python3, g++ (para o parser C++), numpy, Pillow.
Exemplo:
 python3 montar_mundo.py --mapa garner.zip --modelos terraininfo.zip --texturas scene.zip
 python3 montar_mundo.py --mapa garner.zip --modelos terraininfo.zip --texturas scene.zip --completo
 python3 montar_mundo.py --mapa ~/Client/map/garner.map --obj ~/Client/map/garner.obj --modelos terraininfo.zip --texturas scene.zip --tamanho 1024 --ox 1728 --oz 2240

Obs.: os GLBs de cena armazenam geometria TEXTURIZADA uma vez por modelo;
      objetos.json mantém as instâncias (posições, altura e rotação).
"""
from __future__ import annotations
import argparse, gzip, io, json, math, os, re, shutil, struct, subprocess, sys, tempfile, zipfile
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np
from PIL import Image
from converter_garner import export as export_terrain

ROOT=Path(__file__).resolve().parent

class InputSource:
    def __init__(self, path:Path):
        self.path=path.expanduser().resolve()
        if not self.path.exists():raise FileNotFoundError(self.path)
        self.zip=zipfile.ZipFile(self.path) if self.path.is_file() and zipfile.is_zipfile(self.path) else None
        if self.zip:
            self.entries={Path(n).name.casefold():n for n in self.zip.namelist() if not n.endswith('/')}
        elif self.path.is_dir():
            self.entries={p.name.casefold():p for p in self.path.rglob('*') if p.is_file()}
        else:self.entries={self.path.name.casefold():self.path}
    def get(self,filename:str):
        item=self.entries.get(Path(filename).name.casefold())
        if item is None:return None
        return self.zip.read(item) if self.zip else item.read_bytes()
    def names(self,ext:str):
        return sorted(n for n in self.entries if n.endswith(ext))
    def close(self):
        if self.zip:self.zip.close()

class Writer:
    def __init__(self):
        self.data=bytearray()
        self.g={'asset':{'version':'2.0','generator':'TOP Web 0.4 - ModelFile.cpp'},
                'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Biblioteca original de cenarios','children':[]}],
                'meshes':[],'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[],
                'materials':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
    def add(self,raw:bytes,target=None):
        while len(self.data)%4:self.data.append(0)
        offset=len(self.data);self.data.extend(raw)
        v={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
        if target:v['target']=target
        self.g['bufferViews'].append(v)
        return len(self.g['bufferViews'])-1
    def arr(self,values,ctype,name,target=None,with_bounds=False):
        values=np.ascontiguousarray(values)
        view=self.add(values.tobytes(),target)
        a={'bufferView':view,'componentType':ctype,'count':len(values),'type':name}
        if with_bounds:
            a['min']=np.min(values,axis=0).astype(float).tolist()
            a['max']=np.max(values,axis=0).astype(float).tolist()
        self.g['accessors'].append(a)
        return len(self.g['accessors'])-1
    def save(self,out:Path):
        while len(self.data)%4:self.data.append(0)
        self.g['buffers'][0]['byteLength']=len(self.data)
        jb=json.dumps(self.g,separators=(',',':'),ensure_ascii=False).encode()
        while len(jb)%4:jb+=b' '
        total=12+8+len(jb)+8+len(self.data)
        out.write_bytes(b''.join([struct.pack('<4sII',b'glTF',2,total),struct.pack('<I4s',len(jb),b'JSON'),jb,
                     struct.pack('<I4s',len(self.data),b'BIN\0'),self.data]))


def dds_restore(data:bytes):
    if data[:4]==b'DDS ':return data
    if len(data)>=176 and data[-48:-44]==b'DDS ' and data[-4:]==b'mp.x':
        result=data[-48:-4]+data[44:-48]+data[:44]
        if result[:4]==b'DDS ':return result
    raise ValueError('Formato DDS legado não reconhecido (não aplicar correção arbitrária)')


def compile_reader():
    d=ROOT/'tools/cpp';exe=d/'lmo_dump'
    sources=[d/'lmo_dump.cpp',d/'ModelFile.cpp',d/'top/ModelFile.h']
    if not exe.exists() or exe.stat().st_mtime<max(x.stat().st_mtime for x in sources):
        print('Compilando leitor LMO do cliente C++ original...',flush=True)
        subprocess.run(['g++','-std=c++17','-O2','-I'+str(d),str(sources[0]),str(sources[1]),'-o',str(exe)],check=True)
    return exe


def build_library(objects,cat,model_source,tex_source,out:Path):
    required=Counter(cat[str(rec[2])]['file'] for rec in objects if rec[3]==0 and
                     str(rec[2]) in cat and cat[str(rec[2])].get('file'))
    library=Writer();g=library.g
    tx_cache={};mat_cache={};error_counts=Counter();read=compile_reader()
    unique_loaded=[];vertices=0
    def load_texture(name):
        base=Path(name).name.casefold()
        if base in tx_cache:return tx_cache[base]
        stem=Path(base).stem
        candidates=[base,base+'.png',stem+'.dds',stem+'.bmp.png',stem+'.png']
        raw=next((v for v in (tex_source.get(n) for n in candidates) if v),None)
        if raw is None:
            error_counts['textura ausente: '+base]+=1;tx_cache[base]=None;return None
        try:
            if raw[:4]==b'DDS ' or raw[-48:-44]==b'DDS ':raw=dds_restore(raw)
            img=Image.open(io.BytesIO(raw)).convert('RGBA')
            is_transparent=img.getchannel('A').getextrema()[0]<255
            buff=io.BytesIO();img.save(buff,'PNG',optimize=True)
            v=library.add(buff.getvalue())
            g['images'].append({'name':base,'mimeType':'image/png','bufferView':v})
            g['textures'].append({'sampler':0,'source':len(g['images'])-1})
            tx_cache[base]=(len(g['textures'])-1,is_transparent)
            return tx_cache[base]
        except Exception as exc:
            error_counts[f'textura inválida {base}: {exc}']+=1
            tx_cache[base]=None;return None
    def get_material(name,blend):
        key=(Path(name).name.casefold(),bool(blend))
        if key in mat_cache:return mat_cache[key]
        img=load_texture(name) if name else None
        m={'name':name or 'Material sem textura','doubleSided':True,
           'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1] if img else [1,.2,.85,1],
                                  'metallicFactor':0,'roughnessFactor':1}}
        if img:
            m['pbrMetallicRoughness']['baseColorTexture']={'index':img[0]}
            if blend:m['alphaMode']='BLEND'
            elif img[1]:m.update({'alphaMode':'MASK','alphaCutoff':.4})
        elif blend:m['alphaMode']='BLEND'
        g['materials'].append(m);mat_cache[key]=len(g['materials'])-1
        return mat_cache[key]
    with tempfile.TemporaryDirectory(prefix='top_lmo_') as tmp:
        tmp=Path(tmp)
        for seq,(name,quantity) in enumerate(sorted(required.items()),1):
            raw=model_source.get(name)
            if raw is None:
                error_counts['modelo ausente: '+name]+=1
                continue
            path=tmp/name;path.write_bytes(raw)
            proc=subprocess.run([str(read),str(path)],text=True,capture_output=True)
            path.unlink()
            if proc.returncode:
                error_counts['LMO falhou: '+name]+=1;continue
            try:payload=json.loads(re.sub(r'(?<![A-Za-z])-?nan\b','0',proc.stdout,flags=re.I))
            except Exception as exc:
                error_counts['LMO JSON falhou: '+name]+=1;continue
            model_id=len(g['nodes']);g['nodes'].append({'name':name,'extras':{'sourceFile':name},'children':[]});g['nodes'][0]['children'].append(model_id)
            geoms=payload['geoms'];mesh_count=0
            for geom_idx,geom in enumerate(geoms):
                if not geom['pos'] or not geom['indices'] or not geom['subsets']:continue
                # Transformações locais e parentais como no renderer do client.
                def local(i):return np.asarray(geoms[i]['matrix'],dtype=np.float64).reshape((4,4),order='F')
                transform=local(geom_idx);parent=geom['parent'];visited={geom_idx}
                while parent!=4294967295 and 0<=parent<len(geoms) and parent not in visited:
                    transform=local(parent)@transform;visited.add(parent);parent=geoms[parent]['parent']
                pos=np.asarray(geom['pos'],dtype=np.float64).reshape(-1,3)
                p=(np.column_stack((pos,np.ones(len(pos))))@transform.T)[:,:3]
                xyz=np.nan_to_num(p[:,[0,2,1]],nan=0,posinf=0,neginf=0).astype('<f4')
                if not len(xyz):continue
                att={'POSITION':library.arr(xyz,5126,'VEC3',34962,True)}
                if geom['uv'] and len(geom['uv'])==len(pos)*2:
                    att['TEXCOORD_0']=library.arr(np.asarray(geom['uv'],dtype='<f4').reshape(-1,2),5126,'VEC2',34962)
                if geom['normal'] and len(geom['normal'])==len(pos)*3:
                    try:
                        n=np.asarray(geom['normal'],dtype=np.float64).reshape(-1,3)@np.linalg.inv(transform[:3,:3]).T
                        n=n[:,[0,2,1]];length=np.linalg.norm(n,axis=1,keepdims=True)
                        n=(n/np.maximum(length,1e-9)).astype('<f4')
                        if np.isfinite(n).all():att['NORMAL']=library.arr(n,5126,'VEC3',34962)
                    except np.linalg.LinAlgError:pass
                idx=np.asarray(geom['indices'],dtype=np.int64)
                primitives=[]
                for sub in geom['subsets']:
                    s=int(sub['start']);count=int(sub['count']);part=idx[s:s+count]
                    if len(part)<3:continue
                    part=part[:len(part)//3*3].reshape(-1,3)[:,[0,2,1]].reshape(-1)
                    if part.min()<0 or part.max()>=len(pos):
                        error_counts['índices inválidos: '+name]+=1;continue
                    code=5123 if len(pos)<65536 else 5125
                    a=library.arr(part.astype('<u2' if code==5123 else '<u4'),code,'SCALAR',34963)
                    primitives.append({'attributes':att,'indices':a,'material':get_material(sub['texture'],sub['blend']),'mode':4})
                if not primitives:continue
                g['meshes'].append({'name':f'{name} / parte {geom_idx}','primitives':primitives})
                ni=len(g['nodes']);g['nodes'].append({'name':f'parte_{geom_idx}','mesh':len(g['meshes'])-1});g['nodes'][model_id]['children'].append(ni)
                mesh_count+=1;vertices+=len(pos)
            if mesh_count:unique_loaded.append(name)
            else:
                g['nodes'][0]['children'].remove(model_id)
                error_counts['modelo sem malha: '+name]+=1
            if seq%25==0 or seq==len(required):print(f'   LMO {seq}/{len(required)}, carregados={len(unique_loaded)}, texturas={len(g["images"])}',flush=True)
    library.save(out)
    return {'modelos_referenciados':len(required),'modelos_convertidos':len(unique_loaded),'texturas':len(g['images']),
            'vertices':vertices,'posicionamentos':sum(required.values()),'glb_mb':round(out.stat().st_size/(1024*1024),2),
            'problemas':dict(error_counts)}


def main():
    p=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument('--mapa',type=Path,required=True,help='garner.map ou garner.zip (mapa + .obj)')
    p.add_argument('--obj',type=Path,default=None,help='garner.obj separado, quando --mapa for um .map')
    p.add_argument('--modelos',type=Path,required=True,help='terraininfo.zip contendo os LMO, ou pasta Client/model/scene')
    p.add_argument('--texturas',type=Path,required=True,help='scene.zip contendo DDS/BMP, ou pasta Client/texture/scene')
    p.add_argument('--destino',type=Path,default=ROOT/'assets')
    p.add_argument('--ox',type=int,default=1728);p.add_argument('--oz',type=int,default=2240)
    p.add_argument('--tamanho',type=int,default=1024,help='Recorte quadrado (padrão 1024)')
    p.add_argument('--completo',action='store_true',help='Garner 4096x4096: ocupa mais memória na Web')
    args=p.parse_args()
    source=InputSource(args.mapa);models=InputSource(args.modelos);textures=InputSource(args.texturas)
    try:
        with tempfile.TemporaryDirectory(prefix='top_map_') as tmp:
            tmp=Path(tmp)
            maps=source.names('.map')
            if not maps:raise ValueError('Não encontrei .map em --mapa')
            map_name=next((n for n in maps if n.endswith('garner.map')),maps[0])
            content=source.get(map_name)
            map_path=tmp/Path(map_name).name;map_path.write_bytes(content)
            obj_content=args.obj.read_bytes() if args.obj else source.get(Path(map_name).stem+'.obj')
            if obj_content is None:raise ValueError('Falta o arquivo .obj com os posicionamentos (informe --obj ou ZIP com ambos)')
            obj_path=tmp/(Path(map_name).stem+'.obj');obj_path.write_bytes(obj_content)
            _,width,height=struct.unpack_from('<3I',content,0)
            if args.completo:
                ox=oz=0;size=min(width,height)
                if width!=height:raise ValueError('O modo --completo requer mapa quadrado; use --tamanho para outros mapas')
            else:ox,oz,size=args.ox,args.oz,args.tamanho
            out=args.destino.expanduser().resolve();out.mkdir(parents=True,exist_ok=True)
            print(f'Exportando terreno {map_name}: {size}x{size}, origem {ox},{oz}',flush=True)
            report=export_terrain(map_path,obj_path,out,ox,oz,size,size)
            objects=json.loads((out/'objects.json').read_text())
            # Ler a tabela inteira (não somente os 176 IDs que ocorriam no recorte da v0.3).
            table=ROOT/'referencias/sceneobjinfo.txt'
            if not table.exists():raise ValueError(f'Não achei tabela do catálogo: {table}')
            catalog={}
            for line in table.read_text(encoding='latin-1').splitlines():
                parts=line.split('\t')
                if len(parts)>=3 and parts[0].strip().isdigit() and parts[1].lower().endswith('.lmo'):
                    catalog[parts[0].strip()]={'file':Path(parts[1].strip()).name,'label':parts[2].strip()}
            if not catalog:raise ValueError('sceneobjinfo.txt vazio ou sem entradas legíveis')
            (out/'objects_catalog.json').write_text(json.dumps(catalog,separators=(',',':'),ensure_ascii=False))
            print(f'Catálogo completo: {len(catalog)} registros; montando biblioteca de modelos...',flush=True)
            report.update(build_library(objects,catalog,models,textures,out/'modelos_cenario.glb'))
            (out/'montagem_relatorio.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
            print('\nCONCLUÍDO:',json.dumps({k:report[k] for k in ['posicionamentos','modelos_convertidos','texturas','glb_mb']},ensure_ascii=False))
            print('Inicie: python3 -m http.server 8000  ->  http://localhost:8000')
            if report['problemas']:print('Verifique assets/montagem_relatorio.json para modelos/texturas ausentes.')
    finally:
        source.close();models.close();textures.close()

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('ERRO:',exc,file=sys.stderr)
        raise
