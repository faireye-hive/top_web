# TOP Web — Pose & Weapon Studio (31/10/2026)

**Garner completo e Marina Studio:** o jogo usa agora o mapa original de
4096 × 4096, carregado por setores. O veleiro padrão tem aproximadamente
12 m, velas animadas, balanço e rastro de espuma. **Menu → Editor de mapa e
barco** abre as prévias para ajustar a embarcação, o mar e o terreno, com
salvamento local e exportação. [Guia dos editores](docs/MARINA_STUDIO.md).

**Navegação marítima mobile:** vá ao porto de Argent e toque em **Embarcar**.
O minimapa mostra os arredores; **⛶ Mapa** abre Garner com zoom e destinos.
[Controles e limites](docs/NAVEGACAO_MARITIMA.md).

**Câmera e desempenho:** embarcado, alterne **Atrás 3D → Proa 3D → Vista
alta**; **↑** volta a olhar para a frente. O painel **DEV** mostra FPS,
tempos de quadro, memória disponível e carga de renderização. Ative pelo
Menu ou por `?debug=1`; ele já inicia ligado em localhost.

**Novo editor:** [tests/pose-editor.html](tests/pose-editor.html). Reproduz
animações GLB de cidade, guarda, corrida, corrida armada e ataque; permite
ajustar os ossos e as posições das armas quando guardadas nas costas
ou na cintura. Os ajustes são aplicados pelo jogo no próximo carregamento
e podem ser exportados para `assets/poses/overrides.json`.

O Pose Studio agora inclui o catálogo dos **378 IDs históricos** da tabela
`referencias/characterposeinfo.txt` (54 por tipo de arma), com descrição
legível, categoria, frames do `CharacterAction.tx` e indicação se o clipe
foi exportado para o GLB atual. Para Lance Crusader, pesquise `016`,
`030`, `031` (compartilhadas) ou `166`, `168`, `169`–`171`,
`178`, `192`, `193` (duas espadas). É possível reproduzir apenas
ações realmente presentes no GLB.

O conversor `scripts/build_evanescence.py` agora prevê guarda e outros
movimentos históricos, mas os **GLBs equipados existentes precisam ser
regenerados com o Client original** para incluir os clipes ausentes.

Instruções e limitações: [docs/POSE_STUDIO.md](docs/POSE_STUDIO.md).

---

# TOP Web 0.14 — 28 skills selecionadas para mobile

As sete classes agora têm um catálogo de quatro skills, com ícones históricos
e ações adequadas a pistola, arco, espadas ou magia. Os recursos binários
originais estão no arquivo **TOP_Web_028_Skills_Originais_Assets.zip**,
entregue na conversa, e devem ser extraídos em `assets/skills/` antes do merge.

A UI e as animações estão sendo integradas, **mas efeitos, dano e cooldown de
skills ainda não foram implementados**. Veja
[docs/SKILLS_MOBILE_28.md](docs/SKILLS_MOBILE_28.md).

---

# TOP Web 0.13 — Evanescence, prática e botão contextual

- **Celular deitado:** ataque/interação no mesmo botão; Skills em arco ao redor.
- **Bolsa:** conjuntos visuais do tier 55 original, liberados no nível 1.
- **Seis classes:** atributos crescem automaticamente; ataque melhora com a prática
  de cada tipo de arma. Progresso salvo no navegador.
- Argent continua com recorte leve, três modelos de monstros e combate local.

Veja [regras, equipamentos, conversão e verificações](docs/ARGENT_MOBILE.md).
As seções abaixo registram o histórico das versões anteriores.

---

# TOP Web 0.12 — Argent mobile: monstros e combate local

Primeira base jogável com **visuais convertidos e regras novas**:

- Forest Spirit, Mini Bee e Cuddly Lamb em GLB (437 KiB no total), seis
  instâncias de treino perto do ponto inicial de Argent.
- HUD para **celular deitado**, com controles nas laterais e aviso em retrato.
- Botão **Auto**: alvo próximo, aproximação e ataques repetidos. Movimento e
  menus interrompem o combate. Há HP, dano, esquiva, XP e reaparecimento.
- **Herói → Status**: cinco atributos distribuíveis, stats derivados e seleção
  de Lance, Phyllis, Carsise ou Ami. Progresso limitado à sessão.
- Recorte exclusivo de Argent: terreno de 1,75 MiB descompactado e biblioteca
  de cenário de 12,4 MiB. O jogo não baixa mais Garner inteiro.

Veja [regras, limites, conversão e verificações](docs/ARGENT_MOBILE.md).
Pets, equipamentos e habilidades com dano continuam para etapas posteriores.
As seções abaixo são o histórico das versões anteriores.

---

# TOP Web 0.11 — NPCs originais de Argent City

Os dados históricos de 14 NPCs (cinco modelos originais: IDs 11, 13, 17,
18 e 20) já estão em `assets/npcs/manifest.json`. O conversor em
`Lance/converter.py` agora entende LAB `keyType=1/2/3`.

**Atenção:** a entrega dos GLBs é feita no ZIP
`TOP_Web_NPCs_Argent_5_GLBS.zip`, disponibilizado na conversa.
**Antes do merge, copie os cinco arquivos `.glb` desse ZIP** para
`assets/npcs/models/` e execute
`python3 scripts/verify_npc_assets.py`. Sem os binários, os NPCs do
manifesto não conseguem aparecer no navegador.

Veja [instruções de instalação e validação](docs/NPCS_ARGENT.md).

---

# TOP Web 0.10 — Velocidade unificada e preparação dos NPCs de Argent City

**Movimento por clique = mesma velocidade dos controles**: o clique utiliza
caminhada de 4,8 unidades/s, ou 7,2 em modo corrida. O joystick continua com
intensidade analógica. Há testes de regressão em
`tests/movement-speed.test.mjs`.

**NPCs históricos:** adicionados loader opcional, manifesto em
`assets/npcs/manifest.json`, scripts de conversão e pasta separada para GLBs.
A pasta ainda está sem modelos reais porque os LGOs/LABs dos NPCs não
estavam nos arquivos recebidos. Consulte [a lista exata dos arquivos e como
gerar os NPCs](docs/NPCS_ARGENT.md).

---

# TOP Web 0.9 — HUD fantasia mobile em código

A versão 0.9 substitui visualmente os controles antigos do celular por
um HUD inspirado no RPG da imagem de referência: dourado/azul, mini mapa
circular, joystick, botões grandes de combate e quatro skills. O jogo
continua usando as mesmas animações e controles. Leia
[HUD mobile 0.9](docs/HUD_FANTASIA_MOBILE_09.md).

---

# TOP Web 0.8 — HUD compacto para exploração mobile

A versão 0.8 adiciona o menu único **Herói** (Status, Bolsa e Skills), três
atalhos circulares com animações históricas e controles de teclado 1/2/3,
sem alterar modelos ou mapas. As telas de atributos e inventário **ainda não
possuem gameplay real**: exibem valores indisponíveis e espaços vazios.
Os atalhos disparam clipes GLB existentes, sem dano ou efeitos novos.

Veja [a documentação da interface](docs/UI_MOBILE_RPG.md). Teste a lógica com
`node --test tests/*.test.mjs` e inicie o servidor local com
`python3 -m http.server 8000`.

---

# TOP Web 0.7 — Garner + controles móveis + câmera inteligente

A página principal é `index.html`, e **o JavaScript efetivamente carregado é
`js/main.js`**. O `main.js` da raiz é um arquivo histórico e não deve ser
usado como ponto de entrada para novos recursos.

## Melhorias recentes

- Câmera de acompanhamento automática; ao girar com Q/E ou arrasto, o
  acompanhamento fica suspenso temporariamente.
- Zoom próximo com ângulo reduzido, para uma visão 3D de terceira pessoa.
- Modo **Clássico (cores vivas)** como padrão, com alternativa cinematográfica.
- Bancos: senta no centro do marcador, guarda a posição de aproximação e
  procura um local seguro ao levantar. Caso a orientação do marcador varie,
  existe uma opção no painel para inverter o sentido do personagem.
- Interface com tema náutico, mantendo desktop e controles touch da versão 0.6.
- Testes de câmera e pose: `node --test tests/*.test.mjs`.
- Plano de código e multiplayer: `docs/ARQUITETURA_MULTIPLAYER.md`.

No momento **não existe conexão ativa com Supabase**. O jogo continua local;
a documentação descreve a separação necessária para uma implementação segura.

---

# TOP Web 0.4 — Garner, personagens e cenário compartilhado

## O que mudou em relação à versão 0.3

A versão 0.3 tinha somente **506 instâncias** de cenário, num raio fixo de 40 metros em Argent City. Agora, `assets/modelos_cenario.glb` é uma **biblioteca compartilhada** de modelos `.lmo` convertidos e texturizados. Os posicionamentos históricos continuam em `assets/objects.json`; o navegador usa `THREE.InstancedMesh` para distribuir e exibir os modelos até uma distância configurável do jogador. Assim não criamos um arquivo 3D gigante para cada casa repetida.

Na versão inicial leve, a área de **1024×1024 tiles** (origem 1728,2240) foi pré-convertida com os arquivos fornecidos: **7.560 instâncias estáticas**, **169 modelos**, **200 texturas recuperadas**, **523 registros não estáticos mantidos no JSON** e um GLB de biblioteca de aproximadamente 15 MB. A interface usa um controle **Distância de objetos (40–350 m)**. Se o mundo ficar pesado, diminua essa distância.

A câmera é a clássica do cliente: alta, entre cerca de 53° e 67°, distância de 4,5 m a 22 m. O botão direito (ou o arrasto no toque), **Q**/**E** e as setas giram e inclinam; a roda aproxima. **W** anda para onde a câmera olha e **D** anda para a direita da tela. O Lance usa a frente medida do GLB (a cara histórica +Y, já convertida para −Z) e vira o corpo para o passo, sem a barra de compensação de 180°.

## Rodar imediatamente

Dentro desta pasta:

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000. A página utiliza Three.js do CDN e precisa de internet para carregar a biblioteca; o conteúdo 3D fica todo local.

## Gerar a área completa de Garner com seus arquivos originais

Instale os requisitos em seu Python (de preferência em ambiente virtual):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install numpy pillow
```

É necessário `g++` (normalmente instalado junto com `build-essential` no Ubuntu). Não precisa do cliente C++ inteiro: os arquivos `tools/cpp` do parser estão incluídos.

Com os ZIPs originais de cada etapa (`garner.zip`, `terraininfo.zip`, `scene.zip`), execute:

```bash
python3 montar_mundo.py \
  --mapa /caminho/garner.zip \
  --modelos /caminho/terraininfo.zip \
  --texturas /caminho/scene.zip \
  --completo
```

O comando sobrescreve `assets/region.gmap.gz`, `assets/objects.json`, `assets/objects_catalog.json` e `assets/modelos_cenario.glb` com os dados de **Garner inteiro: 4096 × 4096**. Também gera `assets/montagem_relatorio.json` com a lista de ausências. O navegador precisa descompactar cerca de **117 MiB de dados do terreno** ao usar Garner completo. Para computadores mais lentos e celulares, prefira um recorte menor.

Para refazer só Argent City com todas as instâncias estáticas do recorte (modo incluído no pacote):

```bash
python3 montar_mundo.py \
  --mapa /caminho/garner.zip \
  --modelos /caminho/terraininfo.zip \
  --texturas /caminho/scene.zip \
  --ox 1728 --oz 2240 --tamanho 1024
```

Você também pode usar diretamente um `.map` + `.obj` separados, uma pasta com os `.lmo` no argumento `--modelos` e uma pasta de texturas no argumento `--texturas`. A tabela de modelos é extraída de `referencias/sceneobjinfo.txt`. Para outros mapas, será necessário o par `.map` e `.obj`, os modelos correspondentes e a tabela de referência apropriada; o atlas de terreno também poderá precisar de outras texturas.

## O que ainda NÃO está 100% migrado

- Efeitos e entidades de `garner.obj` com tipo diferente de 0 (inclusive algumas animações e objetos especiais).
- Animações próprias dos modelos `.lmo` (por enquanto são malhas estáticas).
- Texturas secundárias, transições alpha e luzes históricas do terreno.
- Alguns recursos do mapa fora das tabelas de objetos, além de NPCs, monstros, teleporte e skills.
- Colisão detalhada de cada construção (o protótipo usa o mapa de bloqueio original).
- Este pacote INTEIRO já contém o mapa 4096×4096. O pacote LEVE usa um recorte de 1024×1024 tiles.

**Este pacote INTEIRO já traz os 4096×4096 tiles e 46.980 instâncias estáticas, com 305 malhas e 393 texturas (GLB de 30,56 MB).**

O arquivo `assets/montagem_relatorio.json` mostra os modelos/texturas ausentes ou com problemas; não confunda o número de registros `.obj` com modelos 3D realmente reproduzidos. Esta versão foi validada estruturalmente, mas a aparência final de todos os objetos e o FPS devem ser confirmados no seu navegador.
