#!/usr/bin/env python3
"""Exporta ações LAB e camadas PAR/EFF com texturas originais para o mobile.
Modelos 3D de efeitos ainda são representados por camadas leves; reporte é explícito.
"""
import argparse,copy,io,json,struct,sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'Lance'),str(ROOT/'tool')]
from converter import GLBWriter,parse_lab,parse_lgo,clips_from_table
from criar_efeitos import decode_par,decode_eff,build_part,index_textures,resolve_texture,mask_black


def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('client',type=Path);args=p.parse_args();client=args.client.expanduser().resolve()
 base=ROOT/'assets/skills';catalog=json.loads((base/'catalog.json').read_text());gear=json.loads((ROOT/'assets/equipment/manifest.json').read_text())
 actors={'lance':0,'carsise':1,'phyllis':2,'ami':3}
 for actor,framework in actors.items():
  wanted=set()
  for job,preset in catalog['classes'].items():
   if actor not in gear['sets'][job]['models']:continue
   for skill in preset['skills']:
    wanted.update(a['id'] for a in skill['actions'].get(actor,[]))
    if skill['id']==216 and actor in ('ami','phyllis'):wanted.add(13)
  lab=parse_lab((client/f'animation/{framework:04d}.lab').read_bytes())
  clips=clips_from_table((client/'scripts/txt/CharacterAction.tx').read_text(encoding='latin1'),lab['frames'],section=framework+1,actions=sorted(wanted))
  raw=(ROOT/f'assets/characters/{actor}.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];model=json.loads(raw[20:20+length])
  w=GLBWriter();g=w.gltf;g['nodes']=copy.deepcopy(model['nodes'][:lab['bones']+1])
  for node in g['nodes']:
   if 'children'in node:node['children']=[i for i in node['children'] if i<=lab['bones']]
  for name,start,end in clips:
   frames=np.arange(start,end+1);times=w.arr(np.arange(len(frames),dtype='f4')/25,5126,'SCALAR',minmax=True)
   anim={'name':name,'samplers':[],'channels':[]}
   for bone in range(lab['bones']):
    for key,source,kind in [('translation','pos','VEC3'),('rotation','quat','VEC4')]:
     values=lab[source][bone,frames].copy()
     if key=='rotation':
      for i in range(1,len(values)):
       if np.dot(values[i-1],values[i])<0:values[i]*=-1
     index=w.arr(values.astype('<f4'),5126,kind)
     anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':bone+1,'path':key}})
     anim['samplers'].append({'input':times,'output':index,'interpolation':'LINEAR'})
   g['animations'].append(anim)
  (base/'animations'/f'{actor}.glb').write_bytes(w.binary())
  print(actor,len(clips),'ações',len(w.binary()),'bytes')
 index=index_textures(client);effect_index={p.name.lower():p for p in (client/'effect').rglob('*') if p.is_file()}
 textures=base/'textures';textures.mkdir(exist_ok=True);cache={};unsupported=set();failures=[];result={}
 def texture(name):
  source=resolve_texture(index,name)
  if not source:return None
  key=source.name.lower()
  if key not in cache:
   image=Image.open(source).convert('RGBA');image.thumbnail((256,256))
   filename=str(len(cache)).zfill(3)+'.png';image.save(textures/filename,optimize=True);cache[key]=filename
  return cache[key],mask_black(source)
 def eff(name):
  source=effect_index.get(name.lower())
  if not source:return []
  try:return decode_eff(source.read_bytes())['parts']
  except Exception as e:failures.append({'file':name,'error':str(e)});return []
 def layer(system,part=None):
  item=texture(part.get('texture','') if part else system['texture'])
  if not item:return None
  built=build_part(system,part,*item)
  if built and built['model'] not in ('Rect','RectPlane','Triangle',''):
   unsupported.add(built['model'])
  return built
 default={'type':6,'life':1,'sizes':[1.0],'colors':[[1,1,1,1]],'model':'RectPlane','texture':'','billboard':True,'src':2,'dst':2,'count':1,'range':[0,0,0],'dir':[0,0,0],'accel':[0,0,0],'vel':0,'step':0,'roadom':2}
 unique={s['id']:s for c in catalog['classes'].values() for s in c['skills']}
 for ident,skill in unique.items():
  layers=[]
  for name in skill['effects']:
   source=base/'legacy'/name
   try:
    if name.endswith('.eff'):
     for part in eff(name):
      built=layer(default,part)
      if built:layers.append(built)
    else:
     data=decode_par(source.read_bytes())
     for system in data['systems']:
      parts=eff(system['model']) if system['model'].lower().endswith('.eff') else [None]
      for part in parts:
       built=layer(system,part)
       if built:layers.append(built)
   except Exception as e:failures.append({'file':name,'error':str(e)})
  # Manter camadas de todas as fases, com limite explícito para celular.
  picked=[layers[round(i*(len(layers)-1)/7)] for i in range(8)] if len(layers)>8 else layers
  result[str(ident)]={'layers':picked,'originalLayerCount':len(layers)}
 used={layer['texture'] for record in result.values() for layer in record['layers']}
 for file in textures.glob('*.png'):
  if file.name not in used:file.unlink()
 # Pequenas malhas reais impedem aplicar atlas de armadura em um quadrado.
 meshes=GLBWriter();g=meshes.gltf;g['materials']=[{'name':'Material substituído pelo efeito','doubleSided':True}];converted=[]
 for name in sorted(unsupported):
  if not name.lower().endswith('.lgo'):continue
  source=client/'model/effect'/name
  try:part=parse_lgo(source.read_bytes(),name)
  except Exception:continue
  positions=part['position'][:,[0,2,1]].copy();positions[:,2]*=-1
  bounds=positions.max(0)-positions.min(0)
  positions[:,0]-=(positions[:,0].min()+positions[:,0].max())/2
  positions[:,2]-=(positions[:,2].min()+positions[:,2].max())/2
  positions[:,1]-=positions[:,1].min()
  positions/=max(float(bounds.max()),.001)
  attributes={'POSITION':meshes.arr(positions.astype('<f4'),5126,'VEC3',minmax=True)}
  if part['uv'] is not None:attributes['TEXCOORD_0']=meshes.arr(part['uv'].astype('<f4'),5126,'VEC2')
  primitive={'attributes':attributes,'indices':meshes.arr(part['indices'].astype('<u2'),5123,'SCALAR'),'material':0}
  g['nodes'].append({'name':name,'mesh':len(g['meshes'])});g['scenes'][0]['nodes'].append(len(g['nodes'])-1)
  g['meshes'].append({'name':name,'primitives':[primitive]});converted.append(name)
 (base/'models.glb').write_bytes(meshes.binary())
 report={'version':1,'source':'PAR/EFF originais; camadas/texturas e cores recuperadas','maxSprites':64,'skills':result,'convertedModels':converted,'approximateModels':sorted(unsupported-set(converted)),'failures':failures}
 (base/'visuals.json').write_text(json.dumps(report,separators=(',',':'),ensure_ascii=False)+'\n')
 print('VFX',len(cache),'texturas;',sum(bool(s['layers']) for s in result.values()),'skills;',len(failures),'falhas; modelos aproximados:',len(unsupported-set(converted)))

if __name__=='__main__':main()
