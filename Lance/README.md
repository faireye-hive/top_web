# TOP Studio — Editor Three.js para múltiplos personagens

Projeto experimental de ferramentas de visualização/edição 3D de assets do Tales of Pirates. O **Three.js é código JavaScript**: `editor.js` controla toda a cena, câmera, iluminação, animações, seleção e edição. Os GLBs são apenas os dados de malhas/texturas/esqueleto do jogo, convertidos para que o navegador consiga lê-los.

## 1. Abrir o editor

Na pasta descompactada:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000` no navegador. Necessário acesso à internet para carregar Three.js (CDN).

A versão já abre o Lance com 30 clipes de animação, incluindo sequências de ataque. O botão **+ Adicionar GLBs** aceita múltiplos arquivos de uma vez, e também se pode arrastar GLBs para a área central. Alterne personagens usando o menu **Modelo ativo**. Ao mudar, ajustes numéricos do personagem anterior são salvos no navegador por nome de arquivo (localStorage). Para guardar os ajustes fora do navegador, use **Salvar projeto** (JSON); para gerar modelo exportável, use **Exportar GLB**.

**Importante:** o navegador abre diretamente apenas GLB. Os arquivos LGO e LAB são formatos binários históricos; precisam ser convertidos antes. Você não precisa me enviar os 500 MB do cliente: rode a conversão no seu Linux.

## 2. Converter automaticamente Lance, Carsise, Phyllis e Ami (ou outros IDs)

Instale as dependências, uma vez:

```bash
python3 -m pip install numpy pillow
```

Se estiver em Debian/Ubuntu com Python gerenciado pelo sistema, use um ambiente virtual:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install numpy pillow
```

Rode na pasta deste projeto:

```bash
python3 criar_personagens.py ~/DEV/TOP2/TalesOfPirateDX9/Client --ids 1 2 3 4
```

O script usa `Client/scripts/table/characterinfo.txt`, `iteminfo.txt` e `CharacterAction.tx` para resolver o LAB, os cinco LGOs e a seção correta de ações para cada personagem. Busca as texturas referenciadas, incluindo arquivos no formato `*.bmp.png`. Cria `modelos/personagem_1.glb`, `modelos/personagem_2.glb` etc.

Abra o TOP Studio e use **+ Adicionar GLBs** para selecionar esses arquivos. Para converter outro personagem/monstro cujo ID exista na tabela, informe o ID correspondente:

```bash
python3 criar_personagens.py ~/DEV/TOP2/TalesOfPirateDX9/Client --ids 42
```

Nem todos os monstros/peças são suportados pela rotina de importação: ela lida com LGO 0x1004/0x1005 e LAB keytype 3, entre outras restrições. Para arquivos incompatíveis, o conversor informa o erro. Isso não é um conversor universal de todos os formatos do jogo.

### 2.1. Selecionar animações (incluindo ataques e skills)

O `CharacterAction.tx` possui muitos IDs, inclusive grupos distintos para armas. O padrão do gerador é `1-15,18,55-69` (30 clipes válidos no Lance enviado). Para selecionar outras sequências:

```bash
python3 criar_personagens.py ~/DEV/TOP2/TalesOfPirateDX9/Client --ids 1 --acoes 1-54,55-108
```

Para tentar exportar **todas** as ações válidas (arquivo pode crescer muito):

```bash
python3 criar_personagens.py ~/DEV/TOP2/TalesOfPirateDX9/Client --ids 1 --todas-acoes
```

O `CharacterAction.tx` define intervalos de frames dentro do LAB. As animações incluem movimentos de corpo, mas **efeitos de partículas e gráficos de skills** não estão embutidos no LAB e não surgirão automaticamente.

## 3. Converter um ZIP ou arquivos específicos manualmente

Se você já tem um ZIP reduzido com apenas um LAB, alguns LGOs e opcionalmente `CharacterAction.tx`, use:

```bash
python3 converter.py TOP_personagem_1_assets.zip --texturas Lance_BMPs.zip \
  --secao 1 --acoes 1-15,18,55-69 --out lance_custom.glb
```

Para selecionar quais peças converter em uma pasta com vários arquivos (sempre escolha o LAB compatível):

```bash
python3 converter.py /caminho/para/Client \
  --lab 0000.lab \
  --lgo 0000000000.lgo --lgo 0000000001.lgo \
  --secao 1 --acoes 1-15 --texturas /caminho/para/Client \
  --out meu_modelo.glb
```

**Atenção:** apontar diretamente para uma pasta Client grande faz o script listar os arquivos na pasta e subpastas. A opção automática `criar_personagens.py` é a recomendada para escolher somente os arquivos necessários.

## 4. O que é código e o que é modelo?

`index.html` e `editor.js` são o editor **feito em código Three.js**. `converter.py` transforma os arquivos binários originais (.lgo/.lab) em .glb. `criar_personagens.py` encontra e prepara modelos automaticamente a partir das tabelas do cliente. `.glb` é um formato binário que guarda geometria, texturas, esqueleto e, quando disponíveis, animações.

Você pode criar objetos totalmente por código com `new THREE.Mesh(new THREE.BoxGeometry(...), ...)`, mas reproduzir personagens originais complexos manualmente não é prático quando seus modelos existem no cliente.

## 5. Limitações / cuidados

- O editor **não lê diretamente .lgo/.lab** no navegador, não modela vértices individualmente nem edita keyframes, pesos de skinning ou partículas de skills.
- Adicionar outro GLB **troca o personagem ativo**, não monta automaticamente equipamentos de rigs diferentes.
- O exportador GLB pode não preservar perfeitamente todas as animações; reimporte o resultado para confirmar.
- Ajustes de posição/rotação aplicados em malhas com skinning podem não corrigir a causa original de uma peça invertida. Para uma migração fiel, valide a transformação/UV no conversor.
- O cliente C++/OpenGL não usa esses GLBs diretamente sem um importador; esta ferramenta é um **laboratório visual**.
- Testei extração e conversão no ambiente disponível para Lance; os outros personagens precisam ser testados com seus arquivos específicos.
- **Nunca** coloque a pasta `Client` completa de 500 MB na pasta servida pelo HTTP; faça a conversão no Linux e envie para o navegador apenas os GLBs selecionados.

## 6. Arquivos

- `index.html`, `editor.js`: editor HTML/JS Three.js.
- `lance_ataques.glb`: Lance texturizado com 30 animações.
- `lance_original.glb`: referência antiga com UV invertido globalmente.
- `lance_uv_sem_inversao.glb`: referência de teste com UV original.
- `selecionar_assets.py`: localizador dos arquivos LGO/LAB/texturas pelo ID de personagem.
- `converter.py`: conversor flexível de ZIP ou pasta (LGO/LAB → GLB).
- `criar_personagens.py`: automatiza extração e conversão para vários IDs.
