#!/usr/bin/env python3
"""Preserva canais e controladores visuais originais; não importa regras de jogo."""
import hashlib,json,math,struct,sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'Lance'),str(ROOT/'tool')]
from converter import GLBWriter,parse_lgo,parse_lab
from criar_efeitos import decode_eff,decode_par,index_textures,resolve_texture
from selecionar_assets import parse_table,model_name_from_item,find_path

def clean(x):
 if isinstance(x,float):return round(x,6) if math.isfinite(x) else 0
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
 if isinstance(x,(tuple,list)):return [clean(v) for v in x]
 return x

def build(client):
 base=ROOT/'assets/skills';catalog=json.loads((base/'catalog.json').read_text());gear=json.loads((ROOT/'assets/equipment/manifest.json').read_text())
 tables={name:parse_table(client/f'scripts/table/{name}.txt') for name in ['skillinfo','sceneffectinfo','magicsingleinfo','magicgroupinfo','iteminfo']}
 index=index_textures(client);effect_index={p.name.lower():p for p in (client/'effect').rglob('*') if p.is_file()}
 textures=base/'textures';textures.mkdir(exist_ok=True);texture_names={};failures=[];resources={};meshes_needed=set();types={}
 def texture(name):
  if not name or name=='0':return None
  source=resolve_texture(index,name)
  if not source:return None
  key=source.name.lower()
  if key not in texture_names:
   filename=hashlib.sha1(key.encode()).hexdigest()[:12]+'.png';texture_names[key]=filename
   image=Image.open(source).convert('RGBA');image.thumbnail((256,256));image.save(textures/filename,optimize=True)
  return texture_names[key]
 def part(x):
  x=dict(x);x['texture']=texture(x['texture']);x['frames']=[texture(f) for f in x['frames']]
  meshes_needed.add(x['model']);return x
 def resource(name):
  name=name.lower()
  if not name.endswith(('.par','.eff')):name+='.par'
  if name in resources:return name
  source=effect_index.get(name)
  if not source:failures.append({'file':name,'error':'ausente'});return None
  resources[name]={}
  try:
   if name.endswith('.eff'):
    d=decode_eff(source.read_bytes());d['parts']=[part(p) for p in d['parts']];resources[name]={'kind':'eff',**d}
   else:
    d=decode_par(source.read_bytes())
    for system in d['systems']:
     types[system['type']]=types.get(system['type'],0)+1
     system['texture']=texture(system['texture'])
     if system['model'].lower().endswith('.eff'):system['effect']=resource(system['model'])
     else:meshes_needed.add(system['model'])
     if system.get('hitEffect'):system['hitEffect']=resource(system['hitEffect'])
    for strip in d['strips']:strip['texture']=texture(strip['texture'])
    resources[name]={'kind':'par',**d}
  except Exception as e:failures.append({'file':name,'error':str(e)})
  return name
 def visual(ident):
  if ident>=2000:
   row=tables['magicgroupinfo'].get(ident-2000)
   if not row:return []
   return [{'kind':'magic','models':visual(1000+int(i)),'count':int(count),'groupMode':int(row[5])} for i,count in zip(row[3].split(','),row[4].split(','))]
  if ident>=1000:
   row=tables['magicsingleinfo'].get(ident-1000)
   if not row:return []
   files=[resource(x) for col in [3,6] for x in row[col].split(',') if x not in ('','0')]
   return [{'kind':'flight','files':[f for f in files if f],'mode':int(row[8]),'speed':float(row[4]),'result':resource(row[10]) if row[10]!='0' else None}]
  row=tables['sceneffectinfo'].get(ident)
  return [{'kind':'scene','files':[resource(row[1])]}] if row else []
 skills={}
 for ident in sorted({s['id'] for c in catalog['classes'].values() for s in c['skills']}):
  row=tables['skillinfo'][ident];channels=[]
  def add(kind,effect,key,dummy=-1,itemDummy=-1):
   if effect>0:channels.append({'kind':kind,'effect':effect,'key':key,'dummy':dummy,'itemDummy':itemDummy,'visual':visual(effect)})
  ids=list(map(int,row[51].split(',')));dummies=list(map(int,row[50].split(',')))
  for i,effect in enumerate(ids[:2]):
   if effect<=0:break
   add('actor',effect,int(row[48]),dummies[i] if i<len(dummies) else 0)
  for col,kind in [(54,'item'),(55,'itemExtra')]:
   pair=list(map(int,row[col].split(',')));add(kind,pair[0],pair[1] if len(pair)>1 else 0,int(row[53]))
  add('flight',int(row[59]),int(row[56]),int(row[57]),int(row[58]))
  for col,kind in [(63,'target'),(65,'ground'),(66,'water')]:add(kind,int(row[col]),int(row[64]),int(row[62]) if kind=='target' else -1)
  skills[str(ident)]={'channels':channels,'speed':float(row[60])/100}
 # Mesma unidade do personagem. Não normalizar/recentralizar as malhas.
 w=GLBWriter();g=w.gltf;g['materials']=[{'name':'Textura definida pelo EFF','doubleSided':True}];converted=[];unsupported=[]
 for name in sorted(meshes_needed):
  if not name.lower().endswith('.lgo'):continue
  try:
   raw=(client/'model/effect'/name).read_bytes();geom=parse_lgo(raw,name)
   transform=np.array(struct.unpack_from('<16f',raw,16)).reshape(4,4).T
   positions=geom['position']@transform[:3,:3].T+transform[:3,3]
   attrs={'POSITION':w.arr(positions.astype('<f4'),5126,'VEC3',minmax=True)}
   if geom['uv'] is not None:attrs['TEXCOORD_0']=w.arr(geom['uv'].astype('<f4'),5126,'VEC2')
   primitive={'attributes':attrs,'indices':w.arr(geom['indices'].astype('<u2'),5123,'SCALAR'),'material':0}
   g['nodes'].append({'name':name,'mesh':len(g['meshes'])});g['scenes'][0]['nodes'].append(len(g['nodes'])-1);g['meshes'].append({'name':name,'primitives':[primitive]});converted.append(name)
  except Exception as e:unsupported.append({'file':name,'error':str(e)})
 (base/'models.glb').write_bytes(w.binary())
 # Dummies autênticos acompanham ossos animados, inclusive a boca da pistola.
 attachments={};actions={}
 for actor,framework in {'lance':0,'carsise':1,'phyllis':2,'ami':3}.items():
  raw=(client/f'animation/{framework:04d}.lab').read_bytes();lab=parse_lab(raw);offset=20+lab['bones']*(72+64);count=struct.unpack_from('<I',raw,12)[0]
  node_names=[f'Osso {i:02d} · {name}' for i,name in enumerate(lab['names'])];dummies={}
  for i in range(count):
   at=offset+i*72;ident,parent=struct.unpack_from('<II',raw,at)
   if parent<lab['bones']:dummies[str(ident)]={'bone':node_names[parent],'matrix':list(struct.unpack_from('<16f',raw,at+8))}
  items={}
  for job,record in gear['sets'].items():
   if actor not in record['models']:continue
   slot=9 if any(i['slot']==9 for i in record['items']) else 6
   item=next((i for i in record['items'] if i['slot']==slot),None)
   if not item or str(slot) not in dummies:continue
   file=model_name_from_item(tables['iteminfo'],item['id'],framework);path=find_path(client,'model/item/'+file) or find_path(client,'model/character/'+file)
   data=path.read_bytes();mtl,mesh,helper=struct.unpack_from('<3I',data,104);at=120+mtl+mesh;defs={}
   if helper>=8 and struct.unpack_from('<I',data,at)[0]&1:
    n=struct.unpack_from('<I',data,at+4)[0]
    for i in range(n):
     h=at+8+i*140;key=struct.unpack_from('<I',data,h)[0];defs[key]=np.array(struct.unpack_from('<16f',data,h+4)).reshape(4,4).T
   if 0 in defs:
    hand=np.array(dummies[str(slot)]['matrix']).reshape(4,4).T;grip=np.linalg.inv(defs[0])
    items[job]={str(key):{'bone':dummies[str(slot)]['bone'],'matrix':(hand@grip@mat).T.reshape(-1).tolist()} for key,mat in defs.items()}
  attachments[actor]={'actor':dummies,'items':items}
 # Posição do callback original na pose, em vez de um windup genérico.
 section=None
 for line in (client/'scripts/txt/CharacterAction.tx').read_text('latin1').splitlines():
  if not line or line.startswith('//'):continue
  values=line.replace(',',' ').split()
  try:nums=list(map(int,values))
  except ValueError:continue
  if not line[0].isspace():section=str(nums[0]);actions[section]={}
  elif section and len(nums)>=3 and nums[2]>nums[1]:actions[section][str(nums[0])]={'duration':(nums[2]-nums[1])/25,'callbacks':[(x-nums[1])/25 for x in nums[3:] if nums[1]<=x<=nums[2]]}
 used=set(texture_names.values())
 for file in textures.glob('*.png'):
  if file.name not in used:file.unlink()
 report={'version':2,'source':'canais skillinfo, controladores PAR/EFF e dummies LAB originais','skills':skills,'resources':resources,'attachments':attachments,'actions':actions,'convertedModels':converted,'unsupportedModels':unsupported,'failures':failures,'particleTypes':types}
 (base/'visuals.json').write_text(json.dumps(clean(report),ensure_ascii=False,separators=(',',':'))+'\n')
 print('Controladores:',len(resources),'recursos;',len(texture_names),'texturas;',len(converted),'malhas;',len(failures),'falhas;',types)

if __name__=='__main__':build(Path(sys.argv[1]))
