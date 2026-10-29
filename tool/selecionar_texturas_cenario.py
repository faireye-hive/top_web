#!/usr/bin/env python3
"""Encontra as texturas originais referenciadas pelos .lmo e cria PNGs recuperados.

  python3 selecionar_texturas_cenario.py scene.zip --raio 40
  python3 selecionar_texturas_cenario.py /caminho/Client --raio 40

Requer Pillow: python3 -m pip install pillow
Reconhece .bmp -> .dds, DDS com cabecalho deslocado, .bmp.png e .png.
Nao altera os arquivos de origem.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from collections import defaultdict
from zipfile import ZipFile, ZIP_DEFLATED
from io import BytesIO
import json
try:
 from PIL import Image
except ImportError:
 raise SystemExit('Instale Pillow: python3 -m pip install pillow')

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('origem',type=Path,help='ZIP de texturas (ex.: scene.zip), ou pasta Client')
p.add_argument('--raio',type=int,choices=[40,60,90],default=40)
p.add_argument('--saida',type=Path,default=None)
a=p.parse_args()
base=Path(__file__).resolve().parent
required=[s.strip() for s in (base/'referencias'/f'texturas_cenario_raio_{a.raio}m.txt').read_text().splitlines() if s.strip()]
files={}
source_zip=None
if a.origem.is_file() and a.origem.suffix.lower()=='.zip':
 source_zip=ZipFile(a.origem)
 for entry in source_zip.namelist():
  if entry.endswith('/'):continue
  key=Path(entry).name.casefold()
  # Mantem o caminho dentro do ZIP, sem descompactar todo o arquivo.
  if key not in files:files[key]=entry
elif a.origem.is_dir():
 # Arquivos grandes sao lidos apenas quando uma textura e solicitada.
 roots=[a.origem/'texture'/'scene',a.origem/'texture',a.origem]
 seen=set()
 for root in roots:
  if not root.is_dir():continue
  for fp in root.rglob('*'):
   if not fp.is_file() or fp in seen:continue
   seen.add(fp)
   key=fp.name.casefold()
   if key not in files and fp.suffix.lower() in ('.bmp','.dds','.png','.tga'):
    files[key]=fp
else:raise SystemExit('Origem deve ser uma pasta ou um ZIP existente')

def get_bytes(value):
 return source_zip.read(value) if source_zip is not None else value.read_bytes()

def correct_dds(raw:bytes)->bytes:
 if raw[:4]==b'DDS ':return raw
 # Conversao antiga TOP: 44 bytes finais do payload no inicio, primeiros
 # 44 bytes do cabecalho no fim, com marca extra "mp.x".
 if raw[-48:-44]==b'DDS ' and raw[-4:]==b'mp.x':
  result=raw[-48:-4]+raw[44:-48]+raw[:44]
  if result.startswith(b'DDS ') and len(result)+4==len(raw):return result
 raise ValueError('Formato DDS inesperado')

archive=a.saida or Path(f'TOP_texturas_cenario_{a.raio}m_CORRIGIDAS.zip')
found=[];missing=[];errors=[]
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for name in required:
  n=Path(name).name;stem=Path(n).stem
  variants=[n,n+'.png',stem+'.dds',stem+'.png',stem+'.tga.png']
  source=next((files[x.casefold()] for x in variants if x.casefold() in files),None)
  raw=get_bytes(source) if source is not None else None
  if raw is None:missing.append(n);continue
  try:
   if raw.startswith(b'DDS ') or raw[-48:-44]==b'DDS ':raw=correct_dds(raw)
   im=Image.open(BytesIO(raw)).convert('RGBA');im.load()
   buf=BytesIO();im.save(buf,format='PNG')
   z.writestr('texture/scene/'+n+'.png',buf.getvalue())
   found.append(n)
  except Exception as exc:errors.append(f'{n}: {exc}')
 z.writestr('RELATORIO.json',json.dumps({'encontrados':found,'ausentes':missing,'erros':errors},indent=2))
if source_zip is not None:source_zip.close()
print('ZIP criado:',archive)
print('Texturas convertidas:',len(found),'· ausentes:',len(missing),'· com erro:',len(errors))
if missing:print('Ausentes:',', '.join(missing))
if errors:print('Erros:',errors[:8])
