#!/usr/bin/env python3
"""Recria só os visuais de três monstros a partir de Client; mantém regras novas."""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = {103: 'forest-spirit', 206: 'mini-bee', 125: 'cuddly-lamb'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('client', type=Path)
    args = parser.parse_args()
    dest = ROOT / 'assets/monsters/models'
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='top-monsters-') as tmp:
        subprocess.run([sys.executable, str(ROOT / 'Lance/criar_personagens.py'),
                        str(args.client.expanduser().resolve()), '--ids', *map(str, MODELS),
                        '--acoes', '1,5,7,17', '--outdir', tmp], check=True)
        for char_id, name in MODELS.items():
            shutil.copy2(Path(tmp) / f'personagem_{char_id}.glb', dest / f'{name}.glb')


if __name__ == '__main__':
    main()
