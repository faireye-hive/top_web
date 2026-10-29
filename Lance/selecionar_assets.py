#!/usr/bin/env python3
"""Seleciona os assets de um personagem do cliente Tales of Pirates.
Uso: python3 selecionar_assets.py /caminho/para/Client --char-id 1
Opcional: --item-ids 123 456 789 (IDs de peças/equipamentos no iteminfo.txt).
Não altera os arquivos do jogo.
"""
import argparse
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


def find_child(directory: Path, name: str):
    if not directory.is_dir():
        return None
    exact = directory / name
    if exact.is_file():
        return exact
    lower = name.casefold()
    for p in directory.iterdir():
        if p.is_file() and p.name.casefold() == lower:
            return p
    return None


def find_path(root: Path, rel: str):
    path = root
    for part in rel.replace('\\', '/').split('/'):
        if not part:
            continue
        if not path.is_dir():
            return None
        exact = path / part
        if exact.exists():
            path = exact
            continue
        match = next((p for p in path.iterdir() if p.name.casefold() == part.casefold()), None)
        if match is None:
            return None
        path = match
    return path if path.is_file() else None


def parse_table(path: Path):
    data = path.read_bytes()
    text = data.decode('utf-8-sig', errors='replace')
    rows = {}
    for line in text.splitlines():
        if not line or line[0] == '/':
            continue
        cols = line.split('\t')
        try:
            key = int(cols[0].strip())
        except (ValueError, IndexError):
            continue
        if key > 0:
            rows[key] = cols
    return rows


def number(cols, index):
    try:
        return int(cols[index].strip())
    except (ValueError, IndexError):
        return 0


def model_name_from_item(items, item_id, framework):
    row = items.get(item_id)
    col = 4 + framework
    if row is None or col >= len(row):
        return None
    name = row[col].strip().strip('"')
    if not name or name == '0':
        return None
    return name if name.lower().endswith('.lgo') else name + '.lgo'


def texture_candidates(data: bytes):
    # Os registros de materiais .lgo guardam nomes de textura em formato ASCII.
    # Scanner conservador: candidatos são verificados por nome na pasta texture.
    rex = re.compile(rb'(?i)([a-z0-9_ .()\-]{1,85}\.(?:tga|dds|bmp|png|jpg|jpeg))')
    result = set()
    for match in rex.finditer(data):
        name = match.group(1).decode('ascii', errors='ignore').strip()
        # Um nome pode ser precedido por lixo ASCII; as texturas reais ficam
        # normalmente no trecho final e são buscadas pelo sufixo completo.
        for suffix in (name, name.split(' ')[-1]):
            if 3 < len(suffix) <= 90:
                result.add(suffix)
    return sorted(result)


def main():
    parser = argparse.ArgumentParser(description='Cria ZIP pequeno de personagem .lab/.lgo/texturas para converter a Three.js')
    parser.add_argument('client', type=Path, help='Caminho da pasta Client original')
    parser.add_argument('--char-id', type=int, default=1, help='ID em characterinfo.txt (Lance=1, Carsise=2, Phyllis=3, Ami=4)')
    parser.add_argument('--item-ids', type=int, nargs='*', default=[], help='IDs adicionais de roupas/equipamentos do iteminfo.txt')
    parser.add_argument('--saida', type=Path, default=None, help='Nome do ZIP de saída')
    args = parser.parse_args()

    root = args.client.expanduser().resolve()
    char_path = find_path(root, 'scripts/table/characterinfo.txt')
    item_path = find_path(root, 'scripts/table/iteminfo.txt')
    if char_path is None:
        print('ERRO: não encontrei Client/scripts/table/characterinfo.txt', file=sys.stderr)
        print('Você pode me enviar characterinfo.txt e iteminfo.txt separadamente para identificar os nomes.', file=sys.stderr)
        return 2
    chars = parse_table(char_path)
    items = parse_table(item_path) if item_path else {}
    row = chars.get(args.char_id)
    if row is None:
        print(f'ERRO: ID {args.char_id} não aparece em characterinfo.txt', file=sys.stderr)
        return 2
    modal, framework, suit = number(row,3), number(row,5), number(row,6)
    skins = [number(row, 8 + i) for i in range(5)]
    print(f'Personagem ID: {args.char_id}  | framework: {framework}  | modal: {modal}  | suit: {suit}')
    print(f'Skins padrão: {skins}')
    labname = f'{framework:04d}.lab'
    pose = number(row,20) or args.char_id
    print('LAB esperado:', labname)
    print('Seção CharacterAction (coluna 20):', pose)

    requested = []
    for slot, skin in enumerate(skins):
        if not skin:
            continue
        if modal == 1:
            name = model_name_from_item(items, skin, framework)
            if not name:
                print(f'AVISO: Skin {skin} slot {slot} não resolvida; confira iteminfo.txt')
                continue
        else:
            name = f'{framework*1000000 + suit*10000 + slot:010d}.lgo'
        requested.append((slot, name))
    for item_id in args.item_ids:
        name = model_name_from_item(items, item_id, framework)
        if name:
            requested.append((f'item-{item_id}', name))
        else:
            print(f'AVISO: item {item_id} não encontrado para o framework {framework}')
    print('LGO(s) esperados:')
    for slot, name in requested:
        print(f'  {slot}: {name}')
    if not requested:
        print('Nenhum LGO resolvido. Envie characterinfo.txt e iteminfo.txt.', file=sys.stderr)

    files = {}
    missing = []
    def include(path):
        if path:
            try:
                arc = path.relative_to(root).as_posix()
                files[arc] = path
            except ValueError:
                pass
    include(char_path)
    include(item_path)
    action_path = find_path(root, 'scripts/txt/CharacterAction.tx')
    include(action_path)

    lab = find_path(root, 'animation/' + labname)
    if lab:
        include(lab)
    else:
        missing.append('animation/' + labname)
    for slot, name in requested:
        # Principal é model/character, alguns equipamentos podem estar em model/item.
        mesh = find_path(root, 'model/character/' + name) or find_path(root,'model/item/' + name)
        if not mesh:
            missing.append('model/character ou model/item: ' + name)
            continue
        include(mesh)
        found_texture = set()
        for candidate in texture_candidates(mesh.read_bytes()):
            base = candidate.rsplit('.', 1)[0]
            candidates=(candidate, candidate + '.png', base+'.png', base+'.dds', candidate+'.jpg')
            for candidate_name in candidates:
                texture = (find_path(root, 'texture/character/' + candidate_name) or
                           find_path(root, 'texture/item/' + candidate_name))
                if texture and texture not in found_texture:
                    include(texture)
                    found_texture.add(texture)
                    print('  textura:', texture.name)

    output = args.saida or (Path.cwd() / f'TOP_personagem_{args.char_id}_assets.zip')
    output = output.expanduser().resolve()
    with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=6) as z:
        for arc, path in sorted(files.items()):
            z.write(path, 'Client/' + arc)
        manifest = '\n'.join([
            f'Personagem ID: {args.char_id}', f'Framework: {framework}',
            f'Modal: {modal}', f'Suit: {suit}', f'Skins padrao: {skins}',
            f'LAB: {labname}', f'CharacterAction secao: {pose}', 'LGO:',
            *(f'{slot}: {name}' for slot, name in requested),
            '', 'Arquivos ausentes:', *(missing or ['nenhum']),
            '', 'OBS: texturas são localizadas por scanner de nomes;'
            ' algumas texturas de mods podem precisar ser enviadas depois.'
        ])
        z.writestr('manifesto.txt', manifest + '\n')
    print('\nZIP gerado:', output)
    print('Arquivos:', len(files), '| Tamanho:', f'{output.stat().st_size/1024/1024:.2f} MB')
    if missing:
        print('\nATENÇÃO — arquivos não encontrados:')
        for name in missing: print('  -', name)
    return 0

if __name__ == '__main__':
    sys.exit(main())
