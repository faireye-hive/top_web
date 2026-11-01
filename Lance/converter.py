#!/usr/bin/env python3
"""Tales of Pirates: .lgo + .lab -> glTF 2.0 .glb (skinning and animations).
Requer: pip install numpy pillow
Uso:
  python3 converter.py TOP_personagem_1_assets.zip --out modelo_original.glb
  python3 converter.py TOP_personagem_1_assets.zip --texturas texturas.zip --out modelo_original.glb
  python3 converter.py TOP_personagem_1_assets.zip --texturas /caminho/Client/texture/character
Baseado nos layouts ModelFile.cpp e ActorSkin.cpp do porte C++ do usuario.
"""
from __future__ import annotations
import argparse, io, json, math, struct, zipfile, re
from pathlib import Path
import numpy as np

COLORS = [(.94,.73,.58,1),(.88,.76,.62,1),(.36,.39,.58,1),(.52,.39,.23,1),(.39,.38,.46,1)]

def u32(data, offset):
    return struct.unpack_from('<I',data,offset)[0]

def parse_lgo(data: bytes, name: str, flip_v: bool = False):
    version=u32(data,0)
    assert version >= 0x1004 and version <=0x1005, f'Versao LGO nao suportada: {version:x}'
    base=4
    mtl_size, mesh_size, helper_size, anim_size=struct.unpack_from('<4I', data,base+100)
    assert base+116+mtl_size+mesh_size+helper_size+anim_size <= len(data)
    matpos=base+116
    mtl_count=u32(data,matpos) if mtl_size else 0
    mats=[]
    for i in range(mtl_count):
        rec=matpos+4+i*1004
        tex=data[rec+216:rec+280].split(b'\0',1)[0].decode('latin1').replace('\\','/').split('/')[-1]
        color=struct.unpack_from('<3f',data,rec+8)
        blend=u32(data,rec+4)
        mats.append((tex, color, blend))
    mp=matpos+mtl_size
    fvf,prim,vertices,index_count,subset_count,bone_count=struct.unpack_from('<6I',data,mp)
    assert prim==4 and 0<vertices<200_000 and 0<index_count<600_000
    element_count=u32(data,mp+28)
    ptr=mp+32+96+element_count*8
    def read_float(count):
        nonlocal ptr
        arr=np.frombuffer(data,dtype='<f4',count=count,offset=ptr).copy()
        ptr+=count*4
        return arr
    pos=read_float(vertices*3).reshape(vertices,3)
    normal=read_float(vertices*3).reshape(vertices,3) if fvf&0x10 else None
    tex_sets=1 if fvf&0x100 else (2 if fvf&0x200 else 0)
    uv=read_float(vertices*2).reshape(vertices,2) if tex_sets else None
    if tex_sets>1:ptr+=(tex_sets-1)*vertices*8
    if fvf&0x40:ptr+=vertices*4
    joints=np.zeros((vertices,4),dtype=np.uint8)
    weights=np.zeros((vertices,4),dtype=np.float32)
    pal=np.zeros(bone_count,dtype=np.int32)
    if bone_count:
        for i in range(vertices):
            joints[i]=np.frombuffer(data,dtype='u1',offset=ptr,count=4)
            ptr+=4
            weights[i]=read_float(4)
        pal=np.frombuffer(data,dtype='<u4',offset=ptr,count=bone_count).copy()
        ptr+=bone_count*4
        valid=joints<bone_count
        joints=np.where(valid,pal[np.clip(joints.astype(np.int32),0,bone_count-1)],0).astype('u1')
        weights=np.where(valid,weights,0).astype('f4')
        sums=weights.sum(axis=1,keepdims=True)
        weights=np.where(sums>1e-6,weights/np.maximum(sums,1e-6),0)
        empty=sums[:,0]<=1e-6
        if np.any(empty):weights[empty,0]=1
    else:weights[:,0]=1
    indices=np.frombuffer(data,dtype='<u4',count=index_count,offset=ptr).copy()
    ptr+=4*index_count
    subsets=[]
    for i in range(subset_count):
        faces,start,vmin,vnum=struct.unpack_from('<4I',data,ptr);ptr+=16
        subsets.append({'start':start,'count':faces*3,'tex': mats[i][0] if i<len(mats) else '',
                        'color':mats[i][1] if i<len(mats) else (1,1,1),
                        'blend':mats[i][2] if i<len(mats) else 0})
    assert ptr==mp+mesh_size, (name,ptr,mp+mesh_size)
    assert indices.max()<vertices,(name,'indices invalidos')
    if uv is not None and flip_v:
        uv[:,1]=1-uv[:,1]  # Correção opcional; DirectX e glTF usam V=0 no topo da imagem.
    if normal is None:normal=np.zeros_like(pos)
    return dict(name=name, position=pos, normal=normal, uv=uv, joints=joints,
                weights=weights, indices=indices, subsets=subsets,
                bonePalette=pal.tolist(),version=version)

def parse_lab(data:bytes):
    version,bones,frames,dummy_count,keytype=struct.unpack_from('<5I',data,0)
    assert version>=0x1003 and keytype in (1,2,3) and 1<=bones<=256 and frames<=20000,(version,keytype)
    parents=[u32(data,20+i*72+68) for i in range(bones)]
    names=[]
    for i in range(bones):
        raw=data[20+i*72:20+i*72+64].split(b'\0',1)[0]
        names.append(raw.decode('latin1',errors='replace').strip() or f'osso_{i}')
    offset=20+bones*72
    inverse=np.frombuffer(data,dtype='<f4',count=bones*16,offset=offset).copy().reshape(bones,4,4)
    offset+=bones*64
    # Os dummies do LAB são pontos de encaixe, NÃO ossos extras.
    # Antes eram ignorados; preservar exatamente seus IDs, pais e matrizes.
    dummies=[]
    if offset+dummy_count*72>len(data):
        raise ValueError('Arquivo LAB truncado no catálogo de dummies')
    for i in range(dummy_count):
        at=offset+i*72
        ident,parent=struct.unpack_from('<II',data,at)
        matrix=np.frombuffer(data,dtype='<f4',count=16,offset=at+8).copy().reshape(4,4)
        if parent>=bones or not np.isfinite(matrix).all():
            raise ValueError(f'Dummy LAB {ident} tem pai ou matriz inválidos')
        dummies.append(dict(id=int(ident),parent=int(parent),matrix=matrix))
    offset+=dummy_count*72
    pos=np.empty((bones,frames,3),dtype='<f4')
    quat=np.empty((bones,frames,4),dtype='<f4')
    scales=np.ones((bones,3),dtype=np.float32)
    if keytype in (1,2):
        # Formatos antigos LAB: 4x3 (1) ou 4x4 (2), matrizes DirectX
        # com vetores linha. A decomposição usa a rotação transposta.
        width=12 if keytype==1 else 16
        matrix=np.frombuffer(data,dtype='<f4',count=bones*frames*width,offset=offset).reshape(bones,frames,width)
        offset+=bones*frames*width*4
        def mat_quat(m):
            r=np.array([[m[0],m[4] if width==16 else m[3],m[8] if width==16 else m[6]],
                        [m[1],m[5] if width==16 else m[4],m[9] if width==16 else m[7]],
                        [m[2],m[6] if width==16 else m[5],m[10] if width==16 else m[8]]],dtype=np.float64)
            if np.linalg.det(r)<0:
                r[:,2]*=-1  # refletir eixo de escala, preservando a pose histórica
            tr=r[0,0]+r[1,1]+r[2,2]
            if tr>0:
                S=np.sqrt(tr+1)*2
                q=[(r[2,1]-r[1,2])/S,(r[0,2]-r[2,0])/S,(r[1,0]-r[0,1])/S,S/4]
            else:
                idx=int(np.argmax(np.diag(r)))
                if idx==0:
                    S=np.sqrt(max(1e-9,1+r[0,0]-r[1,1]-r[2,2]))*2
                    q=[S/4,(r[0,1]+r[1,0])/S,(r[0,2]+r[2,0])/S,(r[2,1]-r[1,2])/S]
                elif idx==1:
                    S=np.sqrt(max(1e-9,1+r[1,1]-r[0,0]-r[2,2]))*2
                    q=[(r[0,1]+r[1,0])/S,S/4,(r[1,2]+r[2,1])/S,(r[0,2]-r[2,0])/S]
                else:
                    S=np.sqrt(max(1e-9,1+r[2,2]-r[0,0]-r[1,1]))*2
                    q=[(r[0,2]+r[2,0])/S,(r[1,2]+r[2,1])/S,S/4,(r[1,0]-r[0,1])/S]
            return np.array(q,dtype=np.float32)
        for bone in range(bones):
            for frame in range(frames):
                m=matrix[bone,frame]
                pos[bone,frame]=m[9:12] if keytype==1 else m[12:15]
                quat[bone,frame]=mat_quat(m)
                if frame==0:
                    rm=np.array([[m[0],m[4] if width==16 else m[3],m[8] if width==16 else m[6]],
                                 [m[1],m[5] if width==16 else m[4],m[9] if width==16 else m[7]],
                                 [m[2],m[6] if width==16 else m[5],m[10] if width==16 else m[8]]])
                    if np.linalg.det(rm)<0:scales[bone,2]=-1
    else:
        for i in range(bones):
            pos[i]=np.frombuffer(data,dtype='<f4',count=frames*3,offset=offset).reshape(frames,3)
            offset+=frames*3*4
            quat[i]=np.frombuffer(data,dtype='<f4',count=frames*4,offset=offset).reshape(frames,4)
            offset+=frames*4*4
    assert offset==len(data),('lab end',offset,len(data))
    qlength=np.linalg.norm(quat,axis=2,keepdims=True)
    quat=quat/np.maximum(qlength,1e-9)
    return dict(bones=bones,frames=frames,parents=parents,names=names,
                inv=inverse,dummies=dummies,pos=pos,quat=quat,scales=scales)


def clips_from_table(text, frame_count, section=1, actions=None, all_actions=False):
    """Lê CharacterAction.tx para a seção (tipo de ação do personagem).

    IDs 1..54 são normalmente o grupo sem armas; IDs maiores incluem grupos
    de equipamentos. Exportar só clipes de interesse mantém GLB leve.
    """
    sections={};current=None
    for line in text.splitlines():
        if not line or line.startswith('//'):continue
        if not line[0].isspace():
            try:current=int(line.strip())
            except ValueError:current=None
        elif current is not None:
            cols=[c.strip() for c in re.split(r'[\t, ]+', line.strip()) if c.strip()]
            if len(cols)>=3:
                try:action,start,end=map(int,cols[:3])
                except ValueError:continue
                sections.setdefault(current,{})[action]=(start,end)
    table=sections.get(section)
    if not table:
        raise ValueError(f'Seção de animação {section} não encontrada em CharacterAction.tx; disponíveis: {list(sections)}')
    default=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,18]
    ids=sorted(table) if all_actions else (actions if actions is not None else default)
    # 54 descrições históricas de referencias/characterposeinfo.txt.
    titles={i+1:label for i,label in enumerate((
        "Parado", "Pose de estilo", "Pose engraçada", "Combate",
        "Correr", "Correr armado", "Ataque 1", "Ataque 2",
        "Ataque 3", "Ataque forte", "Skill 1", "Skill 2",
        "Skill 3", "Skill 4", "Skill 5", "Sentado no chão",
        "Morte", "Acenar", "Chorar", "Comemorar",
        "Raiva", "Provocar", "Autoadmiração", "Emote 7",
        "Emote 8", "Emote 9", "Emote 10", "Minerar",
        "Coletar", "Sentado no banco", "Encostado na parede", "Encostado na árvore",
        "Interação com personagem", "Interação cenário 7", "Interação cenário 8", "Interação cenário 9",
        "Interação cenário 10", "Sentado aguardando", "Morte (espera)", "Skill ação 6",
        "Skill ação 7", "Skill ação 8", "Skill ação 9", "Skill ação 10",
        "Skill ação 11", "Skill ação 12", "Skill ação 13", "Skill ação 14",
        "Skill ação 15", "Skill ação 16", "Skill ação 17", "Skill ação 18",
        "Skill ação 19", "Skill movimento 20",
    ))}
    result=[]
    for code in ids:
        span=table.get(code)
        if not span:continue
        start,end=span
        if start<0 or end<=start or start>=frame_count:continue
        end=min(end,frame_count-1)
        if end<=start:continue
        suffix=titles.get((code-1)%54+1, 'Movimento')
        result.append((f'{code:03d} · {suffix}',start,end))
    return result


def parse_action_ids(argument):
    """Ex: '1-15,18,55-69'."""
    if not argument:return None
    ids=set()
    for term in argument.split(','):
        term=term.strip()
        if not term:continue
        if '-' in term:
            a,b=map(int,term.split('-',1))
            if b<a or b-a>500:raise ValueError('Faixa de ações inválida')
            ids.update(range(a,b+1))
        else:ids.add(int(term))
    return sorted(ids)


def discover_from_archive(archive, extension, name=None):
    entries=[p for p in archive.namelist() if p.lower().endswith(extension) and not p.endswith('/')]
    if name:
        entries=[p for p in entries if Path(p).name.casefold()==name.casefold()]
    return entries


def texture_name_variants(name: str):
    """Arquivos LGO referem BMP; cliente pode armazenar conversao x.bmp.png."""
    filename = Path(name.replace('\\','/')).name
    candidates = [filename]
    if filename.casefold().endswith('.bmp'):
        candidates += [filename + '.png', filename[:-4] + '.png']
    elif filename.casefold().endswith('.tga'):
        candidates += [filename + '.png', filename[:-4] + '.png']
    return {x.casefold() for x in candidates}

def find_texture(name, optional_sources):
    variants=texture_name_variants(name)
    for source in optional_sources:
        if isinstance(source,zipfile.ZipFile):
            match=next((p for p in source.namelist()
                        if Path(p).name.casefold() in variants),None)
            if match:return source.read(match)
        elif source.is_dir():
            for folder in [source,source/'texture'/'character',
                           source/'Client'/'texture'/'character']:
                if folder.is_dir():
                    path=next((p for p in folder.iterdir()
                               if p.is_file() and p.name.casefold() in variants),None)
                    if path:return path.read_bytes()
    return None

class GLBWriter:
    def __init__(self):
        self.buffer=bytearray();self.gltf={'asset':{'version':'2.0','generator':'TOP LGO/LAB -> glTF (Python)'},'scene':0,'scenes':[{'nodes':[0]}],
           'nodes':[],'meshes':[],'buffers':[{'byteLength':0}], 'bufferViews':[], 'accessors':[],
           'materials':[],'skins':[],'animations':[]}
    def append(self,raw,target=None):
        while len(self.buffer)%4:self.buffer.append(0)
        offset=len(self.buffer);self.buffer.extend(raw)
        v={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
        if target:v['target']=target
        index=len(self.gltf['bufferViews']);self.gltf['bufferViews'].append(v)
        return index
    def arr(self,arr,component=5126,type_='SCALAR',target=None,normalize=False,minmax=False):
        arr=np.ascontiguousarray(arr)
        n=len(arr)
        view=self.append(arr.tobytes(),target)
        acc={'bufferView':view,'componentType':component,'count':n,'type':type_}
        if normalize:acc['normalized']=True
        if minmax:
            acc['min']=np.min(arr,axis=0).tolist() if arr.ndim>1 else [float(arr.min())]
            acc['max']=np.max(arr,axis=0).tolist() if arr.ndim>1 else [float(arr.max())]
        self.gltf['accessors'].append(acc)
        return len(self.gltf['accessors'])-1
    def binary(self):
        while len(self.buffer)%4:self.buffer.append(0)
        self.gltf['buffers'][0]['byteLength']=len(self.buffer)
        jsonbuf=json.dumps(self.gltf,separators=(',',':'),ensure_ascii=False).encode('utf8')
        while len(jsonbuf)%4:jsonbuf+=b' '
        total=12+8+len(jsonbuf)+8+len(self.buffer)
        return b''.join([struct.pack('<4sII',b'glTF',2,total),struct.pack('<I4s',len(jsonbuf),b'JSON'),jsonbuf,
                         struct.pack('<I4s',len(self.buffer),b'BIN\0'),bytes(self.buffer)])

def convert(assets:Path, extras:list[Path], output:Path, flip_v: bool=False,
            lab_name: str|None=None, lgo_names: list[str]|None=None,
            action_section: int=1, action_ids: list[int]|None=None, all_actions: bool=False,
            geometry_overrides: dict|None=None):
    import contextlib
    with contextlib.ExitStack() as stack:
        # input ZIP com os arquivos selecionados (opção principal), ou pasta
        if assets.is_dir():
            names=[str(p.relative_to(assets)) for p in assets.rglob('*') if p.is_file()]
            def read_entry(entry):return (assets/entry).read_bytes()
        else:
            z=stack.enter_context(zipfile.ZipFile(assets))
            names=z.namelist()
            def read_entry(entry):return z.read(entry)
        labs=sorted(p for p in names if p.lower().endswith('.lab'))
        lgolist=sorted(p for p in names if p.lower().endswith('.lgo'))
        def choose(candidates, wanted):
            return [p for p in candidates if Path(p).name.casefold()==wanted.casefold()]
        if lab_name:
            labs=choose(labs,lab_name)
        if len(labs)!=1:
            raise ValueError(f'Escolha um único LAB com --lab NNNN.lab. Encontrados: {[Path(p).name for p in labs[:30]]}')
        if lgo_names:
            desired={name.casefold() for name in lgo_names}
            lgolist=[p for p in lgolist if Path(p).name.casefold() in desired]
            missing=desired-{Path(p).name.casefold() for p in lgolist}
            if missing:raise ValueError(f'LGOs não encontrados: {sorted(missing)}')
        if not lgolist:raise ValueError('Nenhum arquivo .lgo encontrado.')
        lab=parse_lab(read_entry(labs[0]))
        geoms=[]
        for path in lgolist:
            geom=parse_lgo(read_entry(path),Path(path).name, flip_v=flip_v)
            geom.update((geometry_overrides or {}).get(path, {}))
            # These meshes contain weapons from slots 6/9. Save explicit
            # role metadata: the original filename is not "weapon".
            if path in (geometry_overrides or {}):
                match=re.search(r'(?:^|/)slot-(6|9)/',path)
                if match:
                    geom['equipment_slot']=int(match.group(1))
            geoms.append(geom)
        for geom in geoms:
            bad=geom['joints'][geom['weights']>0]>=(lab['bones'])
            if np.any(bad):
                raise ValueError(f'{geom["name"]}: ossos fora do LAB escolhido ({lab["bones"]} ossos). Não misture personagens!')
        actions=[p for p in names if Path(p).name.casefold()=='characteraction.tx']
        if actions:
            txt=read_entry(actions[0]).decode('latin1')
            clipdefs=clips_from_table(txt,lab['frames'],section=action_section,actions=action_ids,all_actions=all_actions)
        else:
            clipdefs=[]
            print('Aviso: CharacterAction.tx ausente; GLB terá esqueleto mas não terá clipes.')
        sources=[z if assets.is_file() else assets]
        for path in extras:
            sources.append(stack.enter_context(zipfile.ZipFile(path)) if path.is_file() else path)
        writer=GLBWriter();g=writer.gltf
        g['nodes'].append({'name':'TOP · Personagem (Z-up → Y-up)','rotation':[-.7071067811865475,0,0,.7071067811865476], 'children':[]})
        for i in range(lab['bones']):
            node={'name':f'Osso {i:02d} · {lab["names"][i]}',
                  'translation':lab['pos'][i,0].astype(float).tolist(),
                  'rotation':lab['quat'][i,0].astype(float).tolist()}
            if not np.allclose(lab['scales'][i],1):
                node['scale']=lab['scales'][i].astype(float).tolist()
            g['nodes'].append(node)
        for i,parent in enumerate(lab['parents']):
            if parent!=0xffffffff and parent<lab['bones']:
                g['nodes'][1+parent].setdefault('children',[]).append(1+i)
            else:g['nodes'][0]['children'].append(1+i)
        # O runtime Three.js precisa de sockets animados pelo osso pai.
        # LAB/DirectX utiliza matrizes de vetores-linha; glTF usa coluna:
        # flatten(D_directx @ inverseBind_directx) produz a matriz glTF
        # local correta: boneWorld * inverseBind * dummyBind.
        for dummy in lab['dummies']:
            parent=dummy['parent']
            local=(dummy['matrix'] @ lab['inv'][parent]).astype('<f4')
            socket={
                'name':f'TOP Dummy {dummy["id"]}',
                'matrix':local.reshape(-1).astype(float).tolist(),
                'extras':{'topDummy':dummy['id'],'topParentBone':parent,'source':'LAB'}
            }
            socket_idx=len(g['nodes'])
            g['nodes'].append(socket)
            g['nodes'][1+parent].setdefault('children',[]).append(socket_idx)
        inv=writer.arr(lab['inv'].reshape(-1,16).astype('<f4'),5126,'MAT4')
        g['skins'].append({'name':f'Esqueleto original · {Path(labs[0]).name}','inverseBindMatrices':inv,
                           'joints':[1+i for i in range(lab['bones'])], 'skeleton':1})
        if 'images' not in g:g['images']=[]
        g['textures']=[];g['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
        loaded={}
        missing=set()
        for part_index,part in enumerate(geoms):
            position=writer.arr(part['position'].astype('<f4'),5126,'VEC3',34962,minmax=True)
            # Normais do arquivo original; no three com os materials podem ser alteradas.
            normal=writer.arr(part['normal'].astype('<f4'),5126,'VEC3',34962)
            joints=writer.arr(part['joints'],5121,'VEC4',34962)
            weights=writer.arr(part['weights'].astype('<f4'),5126,'VEC4',34962)
            attrib={'POSITION':position,'NORMAL':normal,'JOINTS_0':joints,'WEIGHTS_0':weights}
            if part['uv'] is not None:
                attrib['TEXCOORD_0']=writer.arr(part['uv'].astype('<f4'),5126,'VEC2',34962)
            # Espelhamento de winding nao é necessario: glTF preserva CCW original.
            # O mesh e gravado como array de indices unico, cada subset referencia uma fatia.
            primitives=[]
            for sub in part['subsets']:
                s=sub['start'];e=s+sub['count']
                assert e<=len(part['indices'])
                material={'name':f'{part["name"]} · {sub["tex"] or "sem textura"}',
                      'pbrMetallicRoughness':{'baseColorFactor':list(COLORS[part_index%len(COLORS)]),
                                          'metallicFactor':0,'roughnessFactor':.92},
                      'doubleSided':True}
                # O LGO marca camadas complementares com blend 1.
                # ActorSkin.cpp (cliente OpenGL antigo) usa modo 4
                # (SRC_ALPHA, ONE), não material opaco. glTF puro não
                # representa soma aditiva: preservar a origem em extras
                # para Three.js habilitar esse modo apenas quando apropriado.
                if sub['blend']==1:
                    material['alphaMode']='BLEND'
                    material['extras']={'topOriginalBlend':1,
                                        'topLayer':'additive-overlay',
                                        'topSourceTexture':sub['tex']}
                if sub['tex']:
                    raw=find_texture(sub['tex'],sources)
                    if raw:
                        if sub['tex'].casefold() not in loaded:
                            try:
                                from PIL import Image
                                im=Image.open(io.BytesIO(raw)).convert('RGBA');output_image=io.BytesIO()
                                im.save(output_image,format='PNG');view=writer.append(output_image.getvalue())
                                g['images'].append({'name':sub['tex'],'mimeType':'image/png','bufferView':view})
                                g['textures'].append({'source':len(g['images'])-1,'sampler':0})
                                loaded[sub['tex'].casefold()]=len(g['textures'])-1
                            except Exception as exc:print('Aviso: erro na textura',sub['tex'],exc)
                        if sub['tex'].casefold() in loaded:
                            material['pbrMetallicRoughness']['baseColorTexture']={'index':loaded[sub['tex'].casefold()]}
                            material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
                    else:missing.add(sub['tex'])
                g['materials'].append(material)
                prim={'attributes':attrib,
                      'indices':writer.arr(part['indices'][s:e].astype('<u2' if len(part['position'])<65536 else '<u4'),
                                           5123 if len(part['position'])<65536 else 5125,'SCALAR',34963),
                      'material':len(g['materials'])-1,'mode':4}
                primitives.append(prim)
            g['meshes'].append({'name':part['name'],'primitives':primitives})
            node={'name':f'Parte {part_index} · {part["name"]}',
                  'mesh':len(g['meshes'])-1,'skin':0}
            if part.get('equipment_slot') in (6,9):
                node['extras']={'topRole':'weapon','equipmentSlot':part['equipment_slot']}
            node_id=len(g['nodes']);g['nodes'].append(node)
            g['nodes'][0]['children'].append(node_id)
        for title,start,end in clipdefs:
            # Arquivo CharacterAction: end e fim inclusivo (a animacao exporta ate ele).
            frame_list=np.arange(start,end+1,dtype=np.int32)
            times=(np.arange(len(frame_list),dtype=np.float32)/25).astype('<f4')
            time_acc=writer.arr(times,5126,'SCALAR',minmax=True)
            animation={'name':title,'samplers':[],'channels':[]}
            for bone in range(lab['bones']):
                for path,dimension in [('translation',3),('rotation',4)]:
                    values=(lab['pos'] if path=='translation' else lab['quat'])[bone,frame_list].astype('<f4')
                    # Unir o hemisferio dos quaternions para evitar interpolacao via 360 graus.
                    if path=='rotation':
                        for i in range(1,len(values)):
                            if np.dot(values[i-1],values[i])<0:values[i]*=-1
                    a=writer.arr(values,5126,'VEC3' if dimension==3 else 'VEC4')
                    animation['samplers'].append({'input':time_acc,'output':a,'interpolation':'LINEAR'})
                    animation['channels'].append({'sampler':len(animation['samplers'])-1,
                                                  'target':{'node':bone+1,'path':path}})
            g['animations'].append(animation)
        output.write_bytes(writer.binary())
        print(f'Malhas: {len(geoms)} · ossos: {lab["bones"]} · quadros LAB: {lab["frames"]}')
        print('Clipes:', [(name,end-start+1) for name,start,end in clipdefs])
        print('Texturas BMP usadas:',list(loaded))
        print('Texturas ausentes:', sorted(missing))
        print(f'GLB gerado: {output} ({output.stat().st_size/1024:.1f} KiB)')
        return dict(missing=sorted(missing), clips=[x[0] for x in clipdefs], parts=len(geoms),bones=lab['bones'], dummies=len(lab['dummies']))

if __name__=='__main__':
    p=argparse.ArgumentParser(description='Converte modelos originais LGO/LAB Tales of Pirates em GLB para o TOP Studio')
    p.add_argument('origem',type=Path,help='ZIP selecionado ou pasta com LGOs, LAB e CharacterAction.tx')
    p.add_argument('--texturas',type=Path,nargs='*',default=[],help='ZIP/pasta de texturas; aceita *.bmp.png')
    p.add_argument('--out',type=Path,default=Path('personagem.glb'))
    p.add_argument('--lab',help='Nome do LAB (obrigatório se houver vários no ZIP/pasta)')
    p.add_argument('--lgo',action='append',default=[],help='Filtra LGO por nome (repita para cada peça)')
    p.add_argument('--secao',type=int,default=1,help='Seção CharacterAction.tx (ex.: 1=Lance)')
    p.add_argument('--acoes',default=None,help='IDs/ranges de ações: 1-15,18,55-69')
    p.add_argument('--todas-acoes',action='store_true',help='Exporta todos os clipes válidos; pode gerar GLB muito grande')
    p.add_argument('--inverter-v',action='store_true',help='Inverte V (somente teste de diagnóstico)')
    args=p.parse_args()
    try:
        result=convert(args.origem,args.texturas,args.out,flip_v=args.inverter_v,
                       lab_name=args.lab,lgo_names=args.lgo,action_section=args.secao,
                       action_ids=parse_action_ids(args.acoes),all_actions=args.todas_acoes)
        print('Resultado:',result)
    except (ValueError,AssertionError,KeyError,FileNotFoundError,zipfile.BadZipFile) as ex:
        p.exit(2, f'ERRO: {ex}\n')
