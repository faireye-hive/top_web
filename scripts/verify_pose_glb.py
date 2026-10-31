#!/usr/bin/env python3
"""Confere se um GLB exportado inclui todos os clipes históricos com frames."""
from __future__ import annotations
import argparse
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_glb_animations(path: Path) -> list[str]:
    with path.open('rb') as file:
        header = file.read(20)
        if len(header) < 20:
            raise ValueError('GLB incompleto')
        magic, version, length, chunk_length, kind = struct.unpack('<4sII I4s', header)
        if magic != b'glTF' or version != 2 or kind != b'JSON':
            raise ValueError('Arquivo não é GLB 2.0')
        if chunk_length > length - 20 or length != path.stat().st_size:
            raise ValueError('Comprimento GLB inválido')
        gltf = json.loads(file.read(chunk_length))
    return [clip.get('name', '') for clip in gltf.get('animations', [])]


def historical_ids(actor: str, bank: int, compact: bool = False) -> set[int]:
    catalog = json.loads((ROOT / 'assets/poses/historical-catalog.json').read_text())
    frames = catalog['frames'][actor]
    armed = range(1, 55) if not compact else (1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
    common = range(1, 55) if not compact else (16, 18, 30, 31, 38)
    selected = {code + bank * 54 for code in armed} | set(common)
    return {code for code in selected if
            str(code) in frames and len(frames[str(code)]) >= 2 and
            frames[str(code)][0] >= 0 and frames[str(code)][1] > frames[str(code)][0]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    parser.add_argument('--actor', choices=['lance', 'carsise', 'phyllis', 'ami'], required=True)
    parser.add_argument('--job', choices=['crusader', 'champion', 'sharpshooter', 'hunter',
                                          'cleric', 'seal-master', 'voyager'], required=True)
    parser.add_argument('--compact', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'assets/equipment/manifest.json').read_text())
    entry = manifest['sets'][args.job]
    if args.actor not in entry['models']:
        parser.error(f'{args.actor} não está disponível para {args.job}')
    expected = historical_ids(args.actor, entry['pose'], args.compact)
    names = read_glb_animations(args.glb)
    observed = set()
    for name in names:
        m = re.match(r'^\s*(\d{3})\s*·', name)
        if m:
            observed.add(int(m.group(1)))
    missing = sorted(expected - observed)
    print(f'GLB: {args.glb} | {args.actor}/{args.job}')
    print(f'Clipes no GLB: {len(names)} | Esperados com frames: {len(expected)} | '
          f'Encontrados: {len(expected & observed)} | Ausentes: {len(missing)}')
    if missing:
        print('IDs ainda ausentes:', ', '.join(f'{x:03d}' for x in missing))
        return 1
    print('OK: todos os movimentos válidos dos bancos selecionados foram exportados.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
