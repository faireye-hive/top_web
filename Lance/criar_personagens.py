#!/usr/bin/env python3
"""Gera um GLB por personagem de um Client original (sem copiar o cliente inteiro).
Exemplos:
    python3 criar_personagens.py /caminho/Client --ids 1 2 3 4
    python3 criar_personagens.py /caminho/Client --ids 1 --acoes 1-15,18,55-69
"""
import argparse,sys,subprocess, tempfile
from pathlib import Path
from selecionar_assets import find_path,parse_table,number

HERE=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser(description='Extrai os LGO/LAB/texturas do cliente e converte vários personagens para GLB')
    parser.add_argument('client',type=Path,help='Pasta Client original')
    parser.add_argument('--ids',type=int,nargs='+',required=True,help='IDs em characterinfo.txt (ex.: 1 2 3 4)')
    parser.add_argument('--acoes',default='1-15,18,55-69',help='IDs de animação exportados. Padrão inclui ataques sem armas e de espada')
    parser.add_argument('--outdir',type=Path,default=Path('modelos'),help='Pasta para os GLBs produzidos')
    parser.add_argument('--todas-acoes',action='store_true',help='Exporta todos os movimentos existentes; pode ficar grande')
    args=parser.parse_args()
    client=args.client.expanduser().resolve()
    table_path=find_path(client,'scripts/table/characterinfo.txt')
    if table_path is None:parser.error('Client/scripts/table/characterinfo.txt não encontrado')
    chars=parse_table(table_path)
    outdir=args.outdir.expanduser().resolve();outdir.mkdir(parents=True,exist_ok=True)
    ok=0
    with tempfile.TemporaryDirectory(prefix='top-studio-') as tmp:
        for char_id in args.ids:
            row=chars.get(char_id)
            if row is None:
                print(f'ERRO: personagem {char_id} não existe em characterinfo.txt',file=sys.stderr);continue
            action_set=number(row,20) or char_id
            zipfile=Path(tmp)/f'personagem_{char_id}.zip'
            dest=outdir/f'personagem_{char_id}.glb'
            print(f'\n=== Personagem {char_id} · {row[1]} · animações seção {action_set} ===',flush=True)
            select_cmd=[sys.executable,str(HERE/'selecionar_assets.py'),str(client),'--char-id',str(char_id),'--saida',str(zipfile)]
            if subprocess.run(select_cmd,check=False).returncode:continue
            cmd=[sys.executable,str(HERE/'converter.py'),str(zipfile),'--texturas',str(client),'--secao',str(action_set),'--out',str(dest)]
            cmd+=['--todas-acoes'] if args.todas_acoes else ['--acoes',args.acoes]
            result=subprocess.run(cmd,check=False)
            if result.returncode:
                print(f'ERRO ao converter {char_id}',file=sys.stderr)
            else:ok+=1
    print(f'\nConcluído: {ok}/{len(args.ids)} arquivos GLB gerados em {outdir}')
    return 0 if ok==len(args.ids) else 1

if __name__=='__main__':sys.exit(main())
