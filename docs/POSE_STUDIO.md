# TOP Web — Pose & Weapon Studio (MVP)

Abra `/tests/pose-editor.html` a partir da mesma origem HTTPS/localhost do
jogo, ou clique em **⚔ Editor de poses e armas** em Configurações.

## Problema corrigido nesta etapa

Os conjuntos Evanescence já foram convertidos por
`scripts/build_evanescence.py` como modelos GLB **com armas rigidamente
skinnadas ao osso da mão**. O jogo reproduzia somente essa geometria e
sempre usava `Parado` na exploração, então a arma continuava nas mãos na
cidade. A postura de guarda/corrida armada também não fazia parte de todos
os GLBs exportados.

Agora o jogo mantém o GLB original e, fora de combate:

1. Reconhece as partes `Parte N · weapon`, sem alterar roupas ou corpo.
2. Separa uma **cópia estática da geometria** transformada para o espaço
   local do osso de origem e centralizada para ajuste.
3. Prende a cópia a um osso editável (costas/coluna para espadas, arcos e
   cajados; quadril para pistola/espadão, conforme aproximação inicial).
4. Oculta apenas o mesh original da arma enquanto ela está guardada.
5. Durante ataque, skill ou Auto, restaura a arma animada na mão e esconde
   a cópia guardada. O AnimationMixer continua usando o GLB original.

As posições iniciais são **aproximações editáveis**, NÃO offsets históricos
comprovados dos dummies de guarda. A correspondência exata por tipo de
arma ainda necessita verificar os dummies originais e testar em browser.

## Ferramentas do editor

- Selecione **Lance, Carsise, Phyllis ou Ami**, classe e equipamento.
- Modos: **Cidade/descanso, Guarda, Corrida, Corrida armada, Ataque**.
- Selecione um clipe de animação que realmente esteja presente no GLB,
  reproduza/pare, navegue pela timeline, mude velocidade e visualize
  ossos/esqueleto. O editor avisa quando a animação histórica está ausente.
- **Catálogo histórico completo**: 54 ações por cada uma das 7 famílias
  (`referencias/characterposeinfo.txt`), somando **378 IDs**. Filtre
  por texto/ID, categoria, banco armado/compartilhado e disponibilidade real:
  ✓ no GLB, ⚠ frames existentes mas não exportados, — sem frames no personagem.
  Selecionar uma ação disponível a reproduz, e o botão
  **Usar ação no estado selecionado** permite atribuí-la ao estado configurável.
- Para **cada arma** separadamente, selecione osso, posição XYZ (em
  metros), rotação XYZ (graus) e escala. Presets Costas, Cintura, Padrão.
- **Guardar armas fora do combate** controla a visibilidade nos estados
  Cidade e Corrida; no modo Guarda/Ataque/Corrida armada a arma original
  permanece na mão.

### Salvar e publicar

1. Clique **Salvar no navegador**: grava `topweb_pose_profiles_v1` em
   `localStorage`, compartilhado com `index.html` **se estiverem na mesma
   origem**. Recarregue o jogo para testar; isso não publica no GitHub.
2. Clique **Exportar JSON**. O arquivo baixado deve se chamar
   `overrides.json`.
3. Substitua o arquivo versionado `assets/poses/overrides.json` no
   repositório e publique. Quem não tem configuração local receberá
   os ajustes do arquivo.
4. **Importar JSON** permite continuar uma edição anterior ou testar
   outro preset. Os clipes selecionados são nomes exatos dos GLBs:
   perfis de outra versão podem exigir remapeamento.

Estrutura do JSON:

```json
{
  "version": 1,
  "profiles": {
    "lance:crusader": {
      "clips": {
        "idle": "163 · Parado",
        "guard": "166 · Combate",
        "run": "167 · Correr",
        "armedRun": "168 · Correr armado",
        "attack": "169 · Ataque 1"
      },
      "stowOnIdle": true,
      "weapons": {
        "weapon-0": {
          "bone": "Osso 13 · Bip01 Spine1",
          "position": [0.1, 0, 0.1],
          "rotation": [0, 0, 40],
          "scale": 1
        }
      }
    }
  }
}
```

**Atenção:** os nomes e ossos nesse exemplo são ilustrativos; escolha
nomes disponíveis nos seus arquivos convertidos. Se um clipe não estiver
presente, o jogo usará o fallback existente. O editor **não reconstrói
keyframes binários**, nem publica arquivos automaticamente no GitHub.


## Descobrir exatamente quais animações faltam

No Pose Studio, **Animações faltantes** aparece imediatamente abaixo da
seleção do clipe. A lista contém os **nomes completos e IDs históricos** da
arma/classe e personagem escolhidos, incluindo as ações compartilhadas se
o banco `Com arma + ações compartilhadas` estiver selecionado. Por exemplo,
`166 · Postura de guarda — Duas espadas` e
`192 · Sentado no banco — Duas espadas`.

Cada item mostra o intervalo real de frames de `CharacterAction.tx`. A
lista é gerada **comparando os IDs com as animações realmente carregadas do
GLB**: somente um registro com frames históricos válidos e clipe ausente
recebe o estado **⚠ Faltando**. IDs sem frames disponíveis não entram
nessa contagem. Clicar numa ação faltante mostra seus detalhes e não
reproduz uma animação substituta.

- **Mostrar só faltantes no catálogo** filtra a lista histórica.
- **Copiar nomes + IDs** copia a relação inteira para procurar no Client
  original; se a área de transferência não estiver disponível, baixa TXT.
- **Lista .txt** baixa a relação com ator, classe, GLB examinado, ID,
  descrição, banco, frames, nome original e fontes necessárias.

**As poses não são arquivos individuais.** Os keyframes estão dentro de
`Client/animation/0000.lab` (Lance), `0001.lab` (Carsise),
`0002.lab` (Phyllis), `0003.lab` (Ami). A descrição e a numeração vêm
de `referencias/characterposeinfo.txt`; os quadros de
`Client/scripts/txt/CharacterAction.tx`. Após identificar o que falta,
reconverta os GLBs com `scripts/build_evanescence.py`; isso não é feito
automaticamente ao selecionar uma linha no editor.

## Fidelidade histórica e animações ausentes

`characterposeinfo.txt` tem colunas para Punhos, Espada, Espadão, Duas
Espadas, Pistola, Arco e Adaga, e separa Normal Wait, Guard Waiting,
Normal Run, Guarded Run e três ataques básicos. O conversor anterior
exportava apenas ações 1, 5 e 7 (além de skills e uma pose social) em
cada banco de arma.

O script `scripts/build_evanescence.py` agora seleciona **todas as
54 ações do banco de arma**, além das ações compartilhadas 016, 018, 030,
031 e 038, **para a próxima regeneração**. A opção `--compact` conserva
um subconjunto leve caso o GLB completo fique pesado no celular.

No Lance Crusader, o arquivo de referência diferencia os IDs **016, 030 e
031** (banco sem arma/compartilhado) de **178, 192 e 193** (banco com duas
espadas). Com o modelo equipado, um clipe compartilhado pode mostrar
equipamento; o nome original da tabela continua sendo de ação base.

O `assets/poses/historical-catalog.json` identifica todos esses IDs,
a descrição original, a tradução e os intervalos de frames presentes nas
seções 1–4 de `referencias/CharacterAction.tx`. Os estados já existentes
no jogo continuam sendo os cinco estados principais; listar as 54 ações
não significa que todas tenham um comando de gameplay implementado.

Para reconstruir os GLBs com o catálogo completo:

```bash
python3 scripts/build_evanescence.py /caminho/Client
node --test tests/pose-studio.test.mjs
```

Este comando exige os arquivos originais `Client/` contendo LAB, LGO,
texturas e tabelas. **Os modelos binários atuais no GitHub NÃO foram
automaticamente regenerados.** Por isso, muitas das 54 ações armadas
ainda serão listadas como `⚠ Histórica não exportada`; o editor não tenta
fingir reproduzir essas ações. A reconversão pode aumentar bastante o tamanho
dos GLBs; verifique carregamento e FPS no celular após gerar os arquivos.

## Limitações e próximos testes

- Ajustar posições de todas as armas/classes, especialmente espadas duplas.
- Conferir que o mesh convertido seja rígido em um único osso. Se uma arma
  futura usar vários ossos, o estúdio não cria cópia estática: mantém o mesh
  original, evitando deformar a geometria.
- Validar estados Cidade, Corrida, Guarda, Ataque e Skills em todos os
  personagens, e associar dummies de costa/cintura históricos.
- A seleção de clipes afeta Parado, Correr e Ataque 1 no jogo atual; a
  implementação de estados adicionais (p. ex. pular, nadar) não foi criada.
- O navegador não tem acesso de escrita ao repositório; a exportação JSON
  precisa ser enviada/commitada via GitHub.


## Reconstrução por ZIP do Lance Crusader (bancos completos)

O exportador agora aceita diretamente o ZIP criado pelo
`Lance/selecionar_assets.py`, sem extrair o Client inteiro.
Para reconstruir apenas Lance, sem exigir arquivos da Phyllis:

```bash
python3 -m pip install numpy pillow
python3 scripts/build_evanescence.py lance-crusader-assets.zip --classes crusader --characters lance
python3 scripts/verify_pose_glb.py assets/equipment/models/lance-crusader.glb --actor lance --job crusader
python3 -m unittest discover -s tests -p 'test_pose_export.py'
```

Sem `--compact`, o exportador seleciona os 54 IDs do banco da arma **e**
os 54 IDs base/compartilhados. O conversor ignora automaticamente as ações
sem intervalos de frames válidos. Na tabela do Lance, **72 ações distintas**
são válidas para os bancos base + duas espadas (35 + 37), incluindo as
60 ausentes identificadas no GLB anterior. Isso não significa que cada ação
tenha 72 arquivos separados: os quadros pertencem ao `0000.lab`.

`--compact` continua disponível para preservar apenas o subconjunto leve.
O novo `--characters` preserva as referências a modelos não reconstruídos
no manifesto. O arquivo GLB deve ser testado no Pose Studio e no jogo antes de
ser publicado; este comando grava o modelo em
`assets/equipment/models/lance-crusader.glb`. Os arquivos binários antigos
**não são atualizados apenas ao modificar o script de conversão**.

## Diagnóstico OpenGL (último_sources29): caminhada na cidade e espadas guardadas

A investigação do cliente OpenGL anterior identificou duas camadas distintas:

1. **Ação do corpo:** `ActorSkin::setPlayerWeaponsDrawn` escolhe ações
   `1/5` (descanso/corrida, cidade) ou `4/6` (guarda/corrida armada),
   no banco da arma escolhido por `weaponPoseMode`. Para Crusader com
   duas espadas (banco 3), são os IDs `163/167` e `166/168`.
   O GLB contém vários clipes com o mesmo nome em bancos diferentes;
   o jogo/editor agora escolhem pelo ID, mantendo configurações manuais
   do Pose Studio prioritárias.
2. **Posicionamento da arma:** `WeaponPose.h` e `ActorSkin.cpp`
   usam os dummies dos slots 6/9 nas mãos e os dummies de guarda
   **22 (esquerda) / 21 (direita)** para armas de tipo 1 (espadas).
   O `Client/animation/0000.lab` do Lance possui os dummies 21, 22 e 23,
   porém os GLBs antigos não armazenam esses pontos de encaixe.
   Os offsets de `WeaponHolster` continuam **aproximados**.

### Falha adicional encontrada nos GLBs antigos

O conversor original escreve nomes como `Parte 5 · 01010021.lgo` para
as armas, enquanto o runtime antigo só procurava `Parte N · weapon`.
Por isso, as espadas podiam nem entrar no sistema de armas guardadas.
O runtime agora detecta os últimos slots `.lgo` dos GLBs equipados já
publicados; novas conversões anotam `extras.topRole='weapon'` e
`equipmentSlot=6/9` explicitamente.

A tabela Lance de `CharacterAction.tx` aponta **005 e 167 para os
mesmos frames, 1921–1937**. Ela não contém uma ação distinta de
"caminhada lenta" para a exploração; as ações de movimento disponíveis
são "Normal Run" e "Guarded Run". Portanto, ajustar a pose da cidade
não cria uma animação de caminhada nova.

**Próxima etapa de fidelidade:** exportar as matrizes dos dummies 21/22/23
do LAB e aplicar aos meshes das armas, incluindo o inverso do dummy
de empunhadura do LGO, como no cliente OpenGL. Validar visualmente
no Lance antes de generalizar as demais classes.

## Correção: cidade com espadas nas costas (Lance Crusader)

Não existe um clipe separado chamado "espadas guardadas na cidade":
a animação do corpo é `163 · Parado / descanso`, e o estado `run`
usa `167 · Corrida normal`. A diferença visual das espadas é **onde
elas são anexadas**, não os keyframes do corpo. Ação `005` pertence à
corrida base; não deve ser atribuída ao botão Cidade/descanso.

O histórico `Client/animation/0000.lab` contém as matrizes reais
dos dummies de mão `6/9` e de guarda `22/21`. O módulo
`js/historical-weapon-dummies.mjs` contém essas matrizes, somente
para **Lance Crusader**, extraídas sem editar seus valores.

O `WeaponHolster` remove da geometria da espada a transformação de
mão usada na conversão original, anexa a cópia aos dummies animados das
costas via *inverse bind matrix* e só exibe a arma original na mão quando
há combate ou skill. Isso funciona com o GLB atual, sem reconvertê-lo.
Ajustes manuais em XYZ agora são deslocamentos **relativos ao dummy**;
edits antigos baseados em offsets aproximados são restaurados para o
encaixe histórico na primeira carga (somente nessa classe). Outros
personagens mantêm os ajustes aproximados até termos seus LABs.

No Pose Studio, o botão `Guardar espadas na cidade` aparece à esquerda,
logo depois dos estados de animação, para não ficar escondido em telas
estreitas. Para comparar com uma imagem do Lance sem o conjunto vermelho,
desmarque `Usar equipamento Evanescence`. Entretanto o GLB base não
carrega essas espadas: isso muda o visual, **não cria novo equipamento**.

A orientação exata deve ainda ser conferida em jogo e no navegador real,
porque testes de código não substituem comparação visual lado a lado.

## Modelo Lance Crusader reconstruído com sockets LAB (31/10/2026)

A versão original do `Lance/converter.py` descartava os registros
`dummy_count * 72` do LAB. A conversão agora mantém **todos os dummies**:
cada registro contém ID, índice do osso pai e matriz DirectX 4×4.
A saída GLB recebe nós `TOP Dummy N`, filhos dos ossos correspondentes,
com `extras.topDummy`, `extras.topParentBone` e `extras.source="LAB"`.
A matriz local é calculada em convenção DirectX como
`dummyMatrix @ inverseBind[parent]`, serializada em ordem column-major
glTF. Assim, o nó acompanha a animação com o movimento skin original,
sem transformação duplicada.

O `WeaponHolster` reconhece esses nós no GLB e usa diretamente
`TOP Dummy 22` (espada esquerda, slot 6) e `TOP Dummy 21`
(espada direita, slot 9). A cópia da arma remove a matriz do dummy da mão;
durante combate a arma skinned original reaparece. O fallback dos
GLBs antigos continua disponível quando não há nós `TOP Dummy`.

O arquivo versionado `assets/equipment/models/lance-crusader.glb`
foi regenerado na branch com o script
`scripts/rebuild_lance_glb_sockets.py`, partindo do GLB que já continha
todas as 72 animações e das matrizes históricas do `0000.lab`
extraídas do ZIP original. Essa reconstrução **preserva o BIN original**
(malhas, texturas, clipes) e acrescenta os nós e metadados de slots.
Ela não é uma reconversão completa de texturas e malhas `.lgo`.
A reconversão completa de um Client original agora também exporta
esses sockets por meio de `scripts/build_evanescence.py`.

Validação:
```sh
python3 scripts/rebuild_lance_glb_sockets.py --verify-only
python3 scripts/verify_pose_glb.py assets/equipment/models/lance-crusader.glb --actor lance --job crusader
python3 -m unittest discover -s tests -p 'test_lance_socket_rebuilder.py'
node --test tests/pose-studio.test.mjs tests/pose-action-catalog.test.mjs tests/pose-missing-report.test.mjs
```

O Pose Studio agora mostra quantos sockets GLB foram efetivamente detectados.
Para `lance:crusader` equipado, espera-se **2 sockets** usados pelas
espadas. Limpe ou redefina eventuais perfis locais antigos caso tenha
salvado uma corrida no estado de descanso; a mudança de GLB não altera
automaticamente uma escolha manual de clipe.

## Diagnóstico manual de armas (independente das poses)

No painel esquerdo, abaixo de **Cidade/Guarda/Correr**, agora há quatro
opções de **Armas nesta pose**, aplicáveis às duas armas do personagem:

- **Auto**: mantém a regra original — guardadas durante cidade/corrida
  normal, nas mãos durante combate/ataque.
- **Sem armas**: esconde as malhas das espadas, mesmo quando a animação
  do corpo é uma pose do banco armado. Não remove roupa nem altera o GLB.
- **Nas mãos**: mostra as malhas originais ligadas ao esqueleto.
- **Nas costas**: mostra somente as cópias anexadas aos encaixes do GLB.
  Caso algum encaixe não funcione, oculta a malha da mão e avisa no
  diagnóstico, em vez de deixar uma espada na posição errada.

Esses ajustes são **separados por estado** (Cidade, Guarda, Correr,
Corrida armada, Ataque), e **por espada**. Para controlar uma arma de
cada vez, use **Peça da arma** e **Onde mostrar somente esta arma?**
no painel direito. O campo **Diagnóstico das armas** mostra nome da
malha, slot 6/9, `TOP Dummy 22/21` encontrado ou não, situação da
cópia e possíveis erros de skin. A seleção de osso também lista nós
`TOP Dummy`; XYZ e rotação continuam editáveis para corrigir visualmente
a posição das cópias nas costas.

As alterações são visualizadas imediatamente. **Salvar no navegador**
grava os ajustes em `topweb_pose_profiles_v1`, compartilhados com o jogo
na mesma origem, e **Exportar JSON** permite publicar o perfil como
`assets/poses/overrides.json`. O formato continua `version:1`, com campo
opcional novo `placements`:

```json
{
  "version": 1,
  "profiles": {
    "lance:crusader": {
      "clips": {},
      "stowOnIdle": true,
      "weapons": {},
      "placements": {
        "idle": {"weapon-0": "back", "weapon-1": "hidden"},
        "guard": {"weapon-0": "hand", "weapon-1": "hand"}
      }
    }
  }
}
```

Dica: para descobrir por que uma pose "sem arma" aparece armada, use
**Sem armas** sem trocar o clipe. Se as armas desaparecem, a animação
está correta e o problema é somente o modo de exibição/equipamento.
Para avaliar os encaixes, use **Nas costas** e verifique o diagnóstico.
