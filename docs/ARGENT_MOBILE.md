# Argent mobile — visuais antigos, regras novas

O ponto de entrada é `index.html` → `js/main.js`. O jogo continua estático,
compatível com o subdiretório do GitHub Pages. O Three.js 0.170 vem do CDN.

## Controles para celular deitado

Joystick à esquerda, corrida ao lado dele, botão principal à direita e quatro
atalhos em arco ao redor do botão. O botão principal tem três usos:

- longe de interações: liga/desliga seleção e ataque automáticos;
- perto de NPC: muda ícone/cor/rótulo para **Conversar**;
- perto de banco/parede: senta/encosta; quando sentado, permite levantar.

NPCs têm prioridade sobre poses e combate. Aproximar-se de NPC desliga Auto.
O diálogo ainda mostra o nome do NPC e a indicação de desenvolvimento;
missões, lojas e regras de NPC não foram importadas do cliente.

Movimento manual, destino no chão, menus, interação, teleporte e perda de foco
interrompem Auto. O alvo deve estar a até 12 m e ter caminho livre em linha reta;
o golpe exige 2,2 m e verifica novamente distância/colisão antes do impacto.
Não há busca de caminho: o joystick permite contornar obstáculos.

**Menu → Ir ao treino · Argent** leva ao pátio de testes. Há seis monstros,
com três modelos compartilhados: Forest Spirit, Mini Bee e Cuddly Lamb.
Eles ficam nos pontos de treino e revidam se atingidos e próximos. Reaparecem
após 12 segundos. O herói recupera em Argent após 5 segundos se cair.

Os atalhos de Skills continuam demonstrando animações do banco da arma equipada.
Ainda não aplicam dano nem consomem mana. Somente o ataque básico treina a arma.

O HUD respeita margens do aparelho, com botões principais de 44–82 px e zoom de
40 px. Em retrato aparece “Gire o celular” e o jogo pausa renderização/combate.
A rotação atualiza o layout sem recarregar nem exigir bloqueio de orientação.

## Classes e atributos automáticos

Em **Herói → Status**, escolha entre as seis classes. Personagens disponíveis
respeitam os modelos que realmente existem para cada conjunto:

| Classe | Personagens | Crescimento por nível | Base do ataque |
| --- | --- | --- | --- |
| Crusader | Lance, Phyllis | +2 Força, +1 Constituição, +1 Destreza, +1 Agilidade | Força |
| Champion | Carsise | +2 Força, +3 Constituição | Força |
| Sharpshooter | Lance, Phyllis | +1 Constituição, +3 Destreza, +1 Agilidade | Destreza |
| Cleric | Phyllis, Ami | +3 Inteligência, +2 Constituição | Inteligência |
| Seal Master | Phyllis, Ami | +2 Inteligência, +2 Constituição, +1 Destreza | Inteligência |
| Voyager | Lance, Phyllis, Ami | +1 Força, +2 Inteligência, +2 Constituição | Inteligência |

Todos começam com cinco em cada atributo, sem pontos manuais. Cada nível custa
`nível × 40` XP. A troca de classe recalcula os atributos no nível atual.
Estes números são novos, editáveis em `js/hero-state.mjs`.

| Derivado | Regra inicial |
| --- | --- |
| HP máximo | 80 + Constituição × 12 + (nível − 1) × 10 |
| Mana máxima | 30 + Inteligência × 8 + (nível − 1) × 4 |
| Ataque básico | 6 + atributo principal × 2 + bônus do conjunto + prática |
| Magia | 4 + Inteligência × 2 |
| Defesa | Constituição + bônus do conjunto |
| Acerto | 70 + Destreza × 3 |
| Esquiva | Agilidade × 2 |
| Ataques/s | mínimo entre 2,5 e 0,7 + Agilidade × 0,03 |

## Ataque melhora com o uso

Punhos, espadas, espadões, tiro, cajados e adagas têm prática independente,
começando em 10. O primeiro avanço exige 20 golpes; depois o requisito aumenta
em dez por nível de prática. Cada avanço acrescenta +1 ao ataque dessa arma.

Conta somente um golpe concluído contra monstro vivo, no alcance e sem obstáculo,
mesmo quando o alvo esquiva. Golpes cancelados, alvos distantes, animações sociais
e demonstrações de Skills não treinam. Trocar equipamento/classe preserva a
prática de cada tipo de arma. O limite inicial de prática é 200.

Classe, nível, XP, equipamento e prática são salvos localmente sob uma versão
própria, com validação ao restaurar. Atributos derivados são recalculados.
Não há conta online nem sincronização entre aparelhos; limpar os dados do
navegador apaga o progresso. HP e mana são restaurados ao reabrir o jogo.

## Evanescence do tier 55, disponível no nível 1

**Bolsa → Equipar Evanescence** aplica um conjunto de teste; **Remover conjunto**
restaura o visual básico. O bônus inicial do conjunto é novo: +4 ataque e +4 defesa,
independente dos atributos antigos. Não há requisito de nível 55 no jogo web.

| Classe | IDs visuais históricos |
| --- | --- |
| Crusader | 768, 807, 808 e duas armas 775 |
| Champion | 765 e 772 |
| Sharpshooter | 779, 809, 810 e 783 |
| Cleric | 791, 812, 814 e 787 |
| Seal Master | 797, 811, 813 e 794 |
| Voyager | 805, 815, 877 e 801 |

Cleric usa os nomes Arcane/Staff of Evanescence; Seal Master usa
Malediction/Staff of Mirage, correspondentes do tier 55 na tabela histórica.
As luvas e botas Warrior of Evanescence (4287/4284) são nível 50 e foram excluídas.
Champion usa somente Tattoo e Roar de nível 55. Nenhum item de outros tiers foi
incluído. As listas na Bolsa exibem os nomes originais exatos.

A conversão substitui as peças do corpo e encaixa armas por dummy LAB da mão
(6/9), incluindo a correção pelo inverso do dummy 0 de empunhadura do próprio
item. As armas ficam vinculadas ao osso correspondente. Cada conjunto exporta
somente o banco de animação da arma e as poses sociais necessárias.

São 12 combinações de personagem/classe, aproximadamente 11,5 MiB no repositório;
o navegador baixa uma combinação selecionada por vez e libera a anterior.
O manifesto não importa tabelas de dano, nível, preços ou missões.

## Argent e orçamento

O jogo carrega `assets/argent/`: 512 × 512 tiles com origem (1984,2528),
1,75 MiB de terreno descompactado e biblioteca de cenário de 12,4 MiB, com
137 modelos. Antes, o terreno inteiro usava 112 MiB e a biblioteca 31 MiB.
Os arquivos completos continuam como fontes de conversão e não são carregados
pelo jogo. As texturas de cenário ainda permitem otimizações futuras.

Os três monstros somam aproximadamente 437 KiB, com texturas embutidas e quatro
clipes por modelo. O gerenciador limita a 12 instâncias e carrega até 45 m.
As instâncias repetidas compartilham malhas/texturas, mantendo esqueleto próprio.

Recriar assets (conversores de personagens/equipamentos requerem NumPy/Pillow):

```bash
python3 scripts/build_argent_region.py
python3 scripts/build_argent_monsters.py /caminho/Client
python3 scripts/build_evanescence.py /caminho/Client
```

Verificar e abrir:

```bash
node --test --test-isolation=none tests/*.test.mjs
python3 scripts/verify_mobile_assets.py
python3 scripts/verify_npc_assets.py
python3 -m http.server 8000
```

A prévia foi conferida no navegador em tela deitada, incluindo equipar/remover,
trocar classe, poses de arma e ação contextual. Ainda é necessário medir FPS,
memória e alcance dos polegares em celulares físicos. Equipamento por peça,
projéteis, Skills com dano, pets, missões e multiplayer ficam para etapas próprias.
