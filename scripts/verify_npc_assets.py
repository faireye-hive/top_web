#!/usr/bin/env python3
"""Verifica o manifesto e cada GLB original de NPC antes de publicar no mobile."""
import json
import struct
import sys
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
directory=BASE/"assets/npcs"
manifest=json.loads((directory/"manifest.json").read_text(encoding="utf-8"))
errors=[]
ids={str(x) for x in manifest["models"]}
for npc in manifest["npcs"]:
    if str(npc["characterId"]) not in ids:
        errors.append(f'NPC sem modelo no manifesto: {npc["name"]}')
for char_id,relative in sorted(manifest["models"].items()):
    path=directory/relative
    if not path.is_file():
        errors.append(f"GLB ausente: {path.relative_to(BASE)}")
        continue
    data=path.read_bytes()
    if len(data)<20 or data[:4]!=b'glTF':
        errors.append(f"GLB inválido: {relative}")
        continue
    _,version,total=struct.unpack_from("<4sII",data)
    size,chunk_type=struct.unpack_from("<II",data,12)
    if version!=2 or total!=len(data) or chunk_type!=0x4e4f534a:
        errors.append(f"GLB com cabeçalho incorreto: {relative}")
        continue
    try:gl=json.loads(data[20:20+size])
    except (ValueError,UnicodeDecodeError):
        errors.append(f"GLB com JSON inválido: {relative}");continue
    if not all(gl.get(k) for k in ("meshes","skins","animations","images","textures")):
        errors.append(f"GLB sem malha, esqueleto, animação ou texturas: {relative}")
    else:
        print(f"{char_id}: {relative} ({len(data)//1024} KiB, "
              f"{len(gl['animations'])} clipes, {len(gl['images'])} imagens)")
if errors:
    for msg in errors:print("ERRO:",msg,file=sys.stderr)
    raise SystemExit(1)
print(f"OK: {len(manifest['models'])} GLBs; {len(manifest['npcs'])} NPCs posicionados.")
