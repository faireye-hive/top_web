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

