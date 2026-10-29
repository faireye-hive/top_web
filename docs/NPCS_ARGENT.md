# Argent City — GLBs reais convertidos (2026-10-29)

Recebemos `TOP_NPCs_Argent_assets.zip`, que contém todos os LGO/LAB e PNGs
necessários para os cinco tipos selecionados. **A conversão foi concluída
fora do GitHub, os binários ainda precisam ser enviados à branch.**

## Arquivos produzidos

| Character ID | Arquivo | Ossos | Texturas embutidas | Clipes |
|---|---|---:|---:|---|
| 11 | `npc_0011.glb` | 38 | 1 | Parado, Pose, Pose 2 |
| 13 | `npc_0013.glb` | 29 | 1 | Parado, Pose, Pose 2 |
| 17 | `npc_0017.glb` | 37 | 1 | Parado, Pose, Pose 2 |
| 18 | `npc_0018.glb` | 38 | 1 | Parado, Pose, Pose 2 |
| 20 | `npc_0020.glb` | 29 | 2 | Parado, Pose, Pose 2 |

`assets/npcs/manifest.json` contém 14 posições extraídas do `garnernpc.txt`
para esses IDs num raio de 140 unidades de Argent City (2230,2775).
Os nomes históricos incluem Goldie, Senna, Marriam, Jimberry e Chiroro.
Esses tipos podem representar vários NPCs com nomes distintos.

## Como colocar os GLBs no repositório

1. Baixe `TOP_Web_NPCs_Argent_5_GLBS.zip` entregue na conversa do ChatGPT.
2. Na raiz do `top_web`, verifique que está na branch
   `feat/argent-npcs-real-glb-manifest`.
3. Extraia **na raiz do repositório**:
   ```bash
   unzip -o TOP_Web_NPCs_Argent_5_GLBS.zip 'assets/npcs/*'
   git add assets/npcs/
   git commit -m "assets(npcs): add five original Argent GLBs"
   git push origin feat/argent-npcs-real-glb-manifest
   ```
4. Confirme que `assets/npcs/models/npc_0011.glb` até
   `assets/npcs/models/npc_0020.glb` aparecem na branch.
5. Rode `python3 -m http.server 8000` na raiz para testar.
6. Só faça o merge depois da chegada dos **cinco binários**.

O GLB guarda as texturas; nenhum arquivo BMP/PNG adicional é necessário.

## Detalhe corrigido no conversor

`Lance/converter.py` foi atualizado para suportar `keyType=1` e
`keyType=2` nos arquivos LAB. O suporte anterior era exclusivo do
`keyType=3`; Trader e Blacksmith usavam `keyType=1`.
Alguns ossos possuem transformações refletidas, representadas com escala
negativa no eixo Z, necessária para reproduzir sua matriz local no glTF.

**Observação:** os GLBs e seus canais foram verificados estruturalmente,
mas falta confirmar orientação, escala e posição visual em um navegador real.
O diálogo de NPCs ainda é um placeholder; missões virão depois.

---

# TOP Web — NPCs de Argent City (assets opcionais)

## O que já existe

O projeto tem os GLBs de **Lance, Carsise, Phyllis e Ami**, além dos cenários de
Garner. Os arquivos dos cinco NPCs abaixo **não estavam nos ZIPs recebidos**;
não foram criados modelos falsos. Já adicionamos um loader opcional
(`js/npc-manager.mjs`) e a pasta isolada `assets/npcs/` com manifesto vazio.

| ID em characterinfo | Nome de modelo | Arquivos originais necessários |
|---|---|---|
| 11 | Occult Merchant | `Client/animation/0011.lab`, `Client/model/character/0011000000.lgo` |
| 13 | Shopkeeper | `Client/animation/0086.lab`, `Client/model/character/0086000000.lgo` |
| 17 | Trader | `Client/animation/0090.lab`, `Client/model/character/0090000000.lgo` |
| 18 | Innkeeper | `Client/animation/0091.lab`, `Client/model/character/0091000000.lgo` e `0091000001.lgo` |
| 20 | Blacksmith | `Client/animation/0092.lab`, `Client/model/character/0092000000.lgo` e `0092000001.lgo` |

As texturas correspondentes normalmente estão em `Client/texture/character/`;
**os nomes exatos dependem das referências dentro de cada LGO**. Podem aparecer
como `.bmp`, `.bmp.png`, `.dds` ou `.tga.png`. Precisamos desses arquivos
ou da pasta Client original para gerar GLBs com as texturas embutidas.

As posições históricas dependem de:

```text
Client/scripts/offline/maps/garner/garnernpc.txt
```

Alternativa histórica: `Client/scripts/offline/garner/garnernpc.txt`.
Esse arquivo não estava presente nos pacotes anteriores.

## Gerar diretamente no Linux com o cliente completo

Os scripts **não alteram o cliente original**.

```bash
python3 -m pip install numpy pillow

python3 scripts/build_argent_npcs.py \
  ~/DEV/TOP2/TalesOfPirateDX9/Client
```

Isso usa o conversor existente `Lance/criar_personagens.py` com as animações
`1-3` (principalmente repouso/pose), escolhendo inicialmente **cinco modelos**
e seus registros em um raio de 140 m do centro de Argent (até 20 NPCs), e gravando:

```text
assets/npcs/
├── manifest.json             # Nome, posição e arquivo GLB
└── models/
    ├── npc_0011.glb
    ├── npc_0013.glb
    ├── npc_0017.glb
    ├── npc_0018.glb
    └── npc_0020.glb
```

Se `garnernpc.txt` não estiver disponível, os GLBs de IDs 11,13,17,18,20
serão gerados mas **nenhum personagem será posicionado no mapa**. Informe o
arquivo via `--npc-table /caminho/garnernpc.txt`.

Para converter **todos os tipos de NPC** existentes no raio, use a opção
`--all-city` junto do `garnernpc.txt`. O padrão limita a cinco tipos para
reduzir o tamanho do download no celular.
Modelos e texturas só são carregados no Three.js quando os NPCs estão
próximos; o limite atual é 20 entidades em um raio de 70 m.

## Se preferir enviar somente os arquivos que faltam

```bash
python3 scripts/pack_argent_npc_assets.py \
  ~/DEV/TOP2/TalesOfPirateDX9/Client \
  --out TOP_NPCs_Argent_assets.zip
```

**Envie somente esse ZIP**, não os 500 MB. Ele inclui as tabelas, arquivos LGO
e LAB, as texturas detectadas pelo seletor e `garnernpc.txt` se existir.
Leia `NPCs_SELECIONADOS.txt` dentro do ZIP para possíveis ausências.

## Integração e missões

O jogo pode funcionar sem NPCs (manifesto vazio). Quando os GLBs estiverem
presentes, são criados a partir do manifesto e carregados somente próximos do
jogador. A opção **Interagir** mostra o nome por enquanto; não concede missões,
itens nem falsifica recompensas. A futura UI de missões poderá consultar
`npc.serial`, `npc.characterId` e o identificador da conversa, sem depender
de GLBs ou de uma tabela Supabase para renderizar.
