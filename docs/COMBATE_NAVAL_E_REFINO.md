# Combate naval, evolução do barco e refino

## Jogar no mar

Embarque no porto ou use **Menu → Ir aos monstros marinhos · embarcar**.
O atalho leva à população original próxima de **2337, 2909**, sem criar inimigos
artificiais. Use **Alvo** (ou T no desktop), depois **Canhão** (ou Espaço).
Tocar/clicar numa criatura também a seleciona. O modo manual ataca até derrotar
um alvo; **Auto** continua buscando criaturas. Movimento manual e menus
interrompem o ataque. A aproximação respeita a área navegável do casco.

O canhão alcança 24 m, e a seleção busca até 50 m. Tiros verificam novamente
alcance e linha livre de água no impacto. Terra bloqueia os ataques. Criaturas
marinhas patrulham, perseguem o barco e revidam; criaturas agressivas também
iniciam combate. Monstros terrestres não atingem barcos e monstros marinhos não
atingem o herói em terra. O reaparecimento conserva o tempo original de cada
nascimento. **Desembarcar** continua disponível perto de uma margem livre,
num botão separado dos controles da câmera e no Menu.

## Nível e HP próprios

Cada casco possui progresso independente, salvo por tipo de barco neste
navegador. Nível, XP e HP do barco não usam nem alteram os valores do herói.

| Regra web | Valor |
| --- | --- |
| Nível inicial / máximo | 1 / 100 |
| XP para o próximo nível L | 100 + 40 × L |
| HP máximo | 1800 + 140 × (L − 1) |
| Ataque do canhão | 135 + 14 × (L − 1) |
| Defesa do casco | 40 + 3 × (L − 1) |
| Velocidade de movimento | velocidade base do editor × [1 + 0,01 × (L − 1)] |
| Cadência | 0,8 tiros/s |
| XP por criatura | 10 + 3 × nível original do monstro |

Subir de nível recalcula os atributos e recupera HP. Fora de combate, sem tiros
ou dano por **6 segundos** e sem inimigos engajados, o casco recupera
**4% do HP máximo por segundo**, inclusive parado ou atracado. Menus pausam os
tempos. Ao afundar, um resgate de cinco segundos devolve ao porto com HP
restaurado, sem perder XP ou nível. Fechar/reabrir o jogo preserva o HP salvo.

O painel do barco substitui o retrato enquanto navega e mostra nível, HP, XP e
estado de combate/reparo no mobile e no desktop. Toque no nome do barco ou use
**Menu → Atributos do barco** (também em terra) para ver HP, XP, ataque, defesa,
velocidade, precisão, esquiva e cadência. A janela pausa o combate e mostra os
ganhos do próximo nível. A velocidade cresce 1% da base por nível, até +99% no
nível 100, preservando a velocidade base escolhida no editor de barcos. **GM → +1/+10 barco** permite
testar níveis sem modificar o herói.

## Refino vermelho/dourado

Proficiência e refino são estados separados. **GM → +1 refino / Refino +13 /
Sem refino** altera o refino da categoria de arma equipada, entre +0 e +13.
As duas espadas do Crusader recebem o mesmo nível. A configuração persiste ao
trocar classe, guardar a arma ou recarregar; saves antigos recebem refino zero.
Para teste do balanceamento, cada nível concede **+2 ataque**. Os controles
ficam bloqueados na Torre, no mar e durante trocas/animações de skill.
Essa etapa oferece o ajuste GM; receitas, gemas e custos de forja não fazem
parte deste fluxo de teste.

O visual foi recriado em vermelho/dourado a partir da imagem fornecida pelo
jogador: brilho contínuo desde +1, faíscas desde +3 e filamentos móveis desde
+5. A largura, intensidade e quantidade de partículas crescem até +13.
O efeito acompanha a geometria animada de cada arma na mão ou nas costas e
desaparece quando a arma é ocultada, removida ou o personagem embarca. Os
materiais/texturas originais e a camada secundária 1.BMP não são substituídos.

A consulta às tabelas originais encontrou a Dance of Evanescence (775) em
`itemrefineinfo.txt` com a série ofensiva 3; `itemrefineeffectinfo.txt` relaciona
essa série ao efeito 304. Esses arquivos também distinguem séries de gemas e
efeitos por personagem. O visual web desta etapa é uma recriação baseada na
referência, sem afirmar equivalência exata a todos os `.par/.eff` históricos.

No mobile são no máximo 24 faíscas por arma; no desktop, 48. As duas armas
compartilham buffers, materiais e um conjunto fixo de geometrias. Não há
alocação de partículas nem carregamento de imagens a cada quadro.

## Estúdio de Refino

Abra **Menu → Editor de efeitos de refino** ou `tests/refinement-editor.html`.
A prévia carrega os equipamentos reais de Lance, Phyllis, Carsise e Ami; escolha
classe, refino +0 a +13, animação e posição nas mãos/costas. Arraste para girar
e use pinça/roda para aproximar. O botão Pausar congela a animação e o efeito.

Ajuste cores de aura e núcleo; largura, comprimento, intensidade, aura externa,
pulsação, velocidade e quantidade/tamanho de faíscas. Os controles da lâmina
moldam a energia visual do refino, mantendo o encaixe no cabo:

- **Comprimento na lâmina:** de 0,35× a 2× do comprimento do efeito original.
- **Espessura da ponta:** 0% pontiaguda, 100% reta e 200% mais grossa.
- **Trecho de afunilamento:** os últimos 10% a 60% do efeito transitam até a
  espessura da ponta escolhida. Também permite alargar a ponta.

Em **Filamentos de energia**, ajuste quantidade, raio de órbita, largura
(0,25× a 5×) e força da aura. Escolha fio sem aura, aura suave, chama ou energia
elétrica. As chamas ondulam e a eletricidade muda o contorno em pequenos saltos.
Escolha **Uma cor**, **Degradê de duas cores**, **Alternar cores por filamento**
ou **Arco-íris em movimento**. As duas cores têm seletores independentes; no
modo de uma cor ou arco-íris, os seletores que não se aplicam ficam desativados.
A força da aura fica desativada enquanto o tipo escolhido é Sem aura.

Os filamentos usam faixas de triângulos com espessura real, visível também em
celular, e uma camada opcional de aura. São no máximo duas armas,
quatro filamentos por arma e 32 segmentos por filamento, com buffers
fixos reutilizados durante a animação. Arquivos e estilos antigos recebem
comprimento 1×, ponta reta, fio de uma cor e sem aura adicional, preservando as
cores e ajustes já salvos.

Há quatro
estilos iniciais: Rubi e ouro, Chama carmesim, Aura glacial e Energia violeta.
O editor e o jogo usam o mesmo renderizador. Os limites de 24 faíscas por arma
no mobile e 48 no desktop permanecem ativos mesmo no máximo dos controles.

**Salvar no jogo** guarda os estilos por personagem/classe na chave
`topweb_refinement_effects_v1` deste navegador e origem. O jogo já aberto recebe
a alteração pelo evento de armazenamento; ao retornar à aba, também relê os
perfis. Isso altera apenas a aparência. O nível de prévia não muda o herói, e
a progressão do efeito continua obedecendo ao refino real da arma equipada.

**Exportar** baixa `refinement-effects.json`. **Importar** valida o JSON e abre
na prévia; salve para aplicar. Para distribuir o estilo a outros dispositivos,
publique o arquivo em `assets/weapons/refinement-effects.json`. Preferências
locais prevalecem sobre o arquivo publicado. O botão Restaurar padrão deste
perfil restaura o vermelho/dourado apenas no perfil selecionado; salve depois.

## Superfície da arma, aura dos equipamentos e chapéu

Em **Superfície da arma**, habilite **A textura acompanha o refino**. Cor e
emissão animadas são aplicadas na superfície texturizada, preservando seus
detalhes. Ajuste intensidade da cor e brilho; escolha movimento contínuo,
pulsação ou ondas de energia. Na arma, a intensidade cresce com o refino real;
+0 desativa essa camada. Materiais personalizados continuam servindo de base.

Em **Brilho dos equipamentos**, cada peça tem dois controles independentes:
brilho na textura e **aura externa**. Armadura, luvas, botas e chapéu podem ser
ajustados separadamente; 0 desliga o respectivo efeito. Ajuste também a largura
da aura dos equipamentos. As peças podem acompanhar as cores da aura da arma
ou usar uma cor própria. Esses ajustes são visuais e não concedem atributos
nem dependem de a arma estar refinada. Retirar o equipamento desativa o visual.

A aura externa acompanha a forma e a animação da peça, usando sua própria
geometria. Cajados de Cleric e Seal Master, armas de Voyager, arcos de Hunter
e rifles de Sharpshooter usam esse contorno e um halo suave ancorado nas
arestas animadas da arma, inclusive nas costas. Assim a aura não vira uma
faixa diagonal fora da arma. O halo tem até 64 pontos por arma no mobile e
96 no desktop, em um único desenho compartilhado; permanece visível mesmo
com faíscas e brilho de textura desligados. Além do contorno, uma aura ampla
e filamentos em órbita envolvem essas armas: os centros acompanham seções
da malha animada, incluindo curvas e hastes com poucos polígonos. O arco de
Hunter recebe uma corda luminosa entre suas duas pontas, animada junto com
a arma. Comprimento e afunilamento são ajustes específicos de espadas.

**Chapéu para testar → Royal Major Hat · original** equipa o item original
5488, exportado para os quatro personagens. A escolha persiste com o perfil e
aparece no jogo. Ao retirar o chapéu, o penteado original retorna. Rosto e cabelo
não recebem brilho por engano. O chapéu usa os ossos já animados do personagem;
cada modelo tem menos de 300 KiB e é carregado apenas quando selecionado.

Para reconstruir os chapéus a partir do Client:

```sh
python3 scripts/build_refinement_headgear.py /caminho/Client
```

## Pontos de monstros no mapa

Mapa completo e minimapa mostram pequenos pontos vermelhos estáticos baseados
nas posições originais de nascimento, em terra e no mar. O mapa agrupa pontos
próximos conforme o zoom; aproximar revela mais detalhes. São áreas aproximadas,
mesmo com monstros distantes, mortos ou ainda não carregados. A opção
**Monstros · terra e mar** do mapa liga/desliga a camada nos dois mapas.
Rotas, porto, desembarque e jogador continuam desenhados sobre os pontos.

## Verificação

```sh
node --test --test-isolation=none tests/*.test.mjs
node --check js/main.js
node --check js/naval-combat.mjs
node --check js/refinement-effects.mjs
python3 scripts/verify_mobile_assets.py
```

Os testes cobrem progressão e saves de cascos independentes, dano no impacto,
alcance e barreiras, manual/Auto, retaliação, reparo fora de combate, pausa,
resgate, velocidade por nível, migração de saves de herói, agrupamento de pontos
terrestres/marinhos, comprimento/afunilamento da energia e importação,
migração, persistência, cores e limites dos estilos de refino.
Prévia e jogo também foram conferidos em desktop e tela mobile de 844 × 390.
