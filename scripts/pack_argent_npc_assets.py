#!/usr/bin/env python3
"""Seleciona somente os assets dos NPCs de Argent em um ZIP compacto.
Exemplo:
 python3 scripts/pack_argent_npc_assets.py ~/DEV/TOP2/TalesOfPirateDX9/Client
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
IDS = (11, 13, 17, 18, 20)

def main():
    p = argparse.ArgumentParser(description="Reunir LGO/LAB/texturas de NPCs de Argent")
    p.add_argument("client", type=Path, help="Pasta Client original")
    p.add_argument("--ids", type=int, nargs="+", default=list(IDS))
    p.add_argument("--out", type=Path, default=Path("TOP_NPCs_Argent_assets.zip"))
    args = p.parse_args()
    cli = args.client.expanduser().resolve()
    selector = ROOT / "Lance/selecionar_assets.py"
    if not selector.is_file():
        p.error(f"Seletor existente não encontrado: {selector}")
    if not (cli / "scripts/table/characterinfo.txt").is_file():
        p.error("Client/scripts/table/characterinfo.txt ausente")
    entries = {}
    missing = []
    with tempfile.TemporaryDirectory(prefix="top-npc-select-") as tmp:
        for npc_id in sorted(set(args.ids)):
            subset = Path(tmp) / f"npc_{npc_id}.zip"
            run = subprocess.run([
                sys.executable, str(selector), str(cli),
                "--char-id", str(npc_id), "--saida", str(subset),
            ], check=False)
            if run.returncode or not subset.is_file():
                missing.append(f"Falha selecionando NPC ID {npc_id}")
                continue
            with ZipFile(subset) as z:
                for name in z.namelist():
                    if name == "manifesto.txt":
                        report = z.read(name).decode("utf-8", errors="replace")
                        if "Arquivos ausentes:\nnenhum" not in report:
                            missing.append(f"NPC {npc_id}: {report.split('Arquivos ausentes:')[-1].split('OBS:')[0].strip()}")
                        continue
                    if name.startswith("Client/"):
                        entries.setdefault(name, z.read(name))
        # Se houver arquivo de posições original, leva junto.
        for rel in ("scripts/offline/maps/garner/garnernpc.txt", "scripts/offline/garner/garnernpc.txt"):
            src = cli / rel
            if src.is_file():
                entries["Client/" + rel] = src.read_bytes()
                break
        result = args.out.expanduser().resolve()
        with ZipFile(result, "w", ZIP_DEFLATED, compresslevel=6) as z:
            for name, data in sorted(entries.items()):
                z.writestr(name, data)
            z.writestr("NPCs_SELECIONADOS.txt",
                       "NPC IDs: " + ", ".join(map(str, sorted(set(args.ids)))) +
                       "\nArquivos: " + str(len(entries)) +
                       "\nAvisos:\n" + "\n".join(missing or ["nenhum"]) + "\n")
    print(f"Criado: {result} | {len(entries)} arquivos | {result.stat().st_size / 1024 / 1024:.1f} MiB")
    for message in missing:
        print("AVISO:", message)
    return 0 if entries else 1

if __name__ == "__main__":
    raise SystemExit(main())
