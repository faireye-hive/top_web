#!/usr/bin/env python3
"""Converte NPCs de Argent com o conversor já presente em Lance/.
Nenhum modelo é inventado. Exemplo:
 python3 scripts/build_argent_npcs.py ~/DEV/TOP2/TalesOfPirateDX9/Client
"""
import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IDS = (11, 13, 17, 18, 20)
CITY_CENTER = (2230.0, 2775.0)

def parse_npc_table(path, radius):
    records = []
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        cols = line.split("\t")
        if len(cols) < 9 or line.startswith("//"):
            continue
        try:
            serial, character_id = int(cols[0]), int(cols[3])
            xcm, zcm = map(float, cols[5].split(",", 1))
            yaw = float(cols[7])
        except (ValueError, IndexError):
            continue
        x, z = xcm / 100.0, zcm / 100.0
        if math.hypot(x - CITY_CENTER[0], z - CITY_CENTER[1]) > radius:
            continue
        if character_id <= 0 or not cols[1].strip():
            continue
        records.append({
            "serial": serial, "name": cols[1].strip(),
            "characterId": character_id,
            "x": round(x, 2), "z": round(z, 2),
            "yaw": yaw, "region": cols[8].strip()
        })
    return records

def find_npc_table(client):
    for rel in ("scripts/offline/maps/garner/garnernpc.txt",
                "scripts/offline/garner/garnernpc.txt"):
        path = client / rel
        if path.is_file():
            return path
    return None

def main():
    parser = argparse.ArgumentParser(description="Gerar assets/npcs/models/*.glb e manifest.json")
    parser.add_argument("client", type=Path, help="Pasta Client histórica")
    parser.add_argument("--ids", type=int, nargs="+", default=list(DEFAULT_IDS), help="IDs selecionados (padrão: 11 13 17 18 20)")
    parser.add_argument("--npc-table", type=Path, help="Caminho explícito de garnernpc.txt")
    parser.add_argument("--radius", type=float, default=140.0, help="Raio em metros do centro de Argent (padrão: 140)")
    parser.add_argument("--all-city", action="store_true", help="Converter todos os tipos de NPCs encontrados no raio, não apenas os 5 iniciais")
    parser.add_argument("--out", type=Path, default=ROOT / "assets/npcs", help="Pasta de saída")
    parser.add_argument("--acoes", default="1-3", help="Animações leves para NPCs (1-3 por padrão)")
    args = parser.parse_args()
    client = args.client.expanduser().resolve()
    if not (client / "scripts/table/characterinfo.txt").is_file():
        parser.error("characterinfo.txt ausente em Client/scripts/table/")
    source = ROOT / "Lance/criar_personagens.py"
    if not source.is_file():
        parser.error(f"Conversor já existente não foi encontrado: {source}")
    out = args.out.expanduser().resolve()
    models = out / "models"
    models.mkdir(parents=True, exist_ok=True)
    npc_table = args.npc_table.expanduser().resolve() if args.npc_table else find_npc_table(client)
    entries = parse_npc_table(npc_table, args.radius) if npc_table and npc_table.is_file() else []
    ids = sorted(set((record["characterId"] for record in entries) if args.all_city and entries else args.ids))
    if not ids:
        parser.error("Nenhum NPC encontrado com esses filtros")
    print(f"NPCs para converter: {ids}; posicionamentos: {len(entries)}")
    print("Fonte de posições:", npc_table or "ausente (GLBs gerados sem posicionar NPCs)")
    built = {}
    with tempfile.TemporaryDirectory(prefix="top-npc-") as tmp:
        temp_out = Path(tmp)
        # Converter aceita várias IDs e produz modelos independentes.
        for npc_id in ids:
            command = [
                sys.executable, str(source), str(client),
                "--ids", str(npc_id), "--acoes", args.acoes,
                "--outdir", str(temp_out),
            ]
            result = subprocess.run(command, check=False)
            generated = temp_out / f"personagem_{npc_id}.glb"
            if result.returncode != 0 or not generated.is_file():
                print(f"AVISO: NPC {npc_id} não convertido. Confira arquivos .lgo/.lab e texturas.", file=sys.stderr)
                continue
            name = f"npc_{npc_id:04d}.glb"
            shutil.copy2(generated, models / name)
            built[str(npc_id)] = f"models/{name}"
    manifest = {
        "version": 1, "map": "garner", "models": built,
        "npcs": [
            {**entry, "model": built[str(entry["characterId"])]}
            for entry in entries if str(entry["characterId"]) in built
        ][:20],
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"GLBs: {len(built)} | NPCs posicionados: {len(manifest['npcs'])}")
    if not entries:
        print("Para colocar NPCs nas posições históricas, inclua Client/scripts/offline/maps/garner/garnernpc.txt")
    return 0 if built else 1

if __name__ == "__main__":
    raise SystemExit(main())
