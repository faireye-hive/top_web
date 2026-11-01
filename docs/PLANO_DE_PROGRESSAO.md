# Progressão de personagem, arma e brilho de refino

**Proposta de game design; estas regras ainda não alteram o combate.** A entrega
de interface acrescenta a câmera próxima e as opções de Bolsa. Os números abaixo
são um ponto de partida para teste, não o balanceamento histórico do TOP.

## O que já existe

`js/hero-state.mjs` já concede XP ao derrotar monstros, aumenta atributos
automaticamente conforme a classe e salva proficiência separada para punhos,
espadas, espadões, tiro, arcos, cajados e adagas. A prática começa no nível 10,
vai até 200 e concede +1 ataque por nível. Hoje até golpes que erram podem treinar;
skills não treinam. O conjunto disponível concede +4 ataque e +4 defesa.

A XP exigida hoje é `40 × nível`. Forest Spirit concede 10 XP: são quatro
derrotas para sair do nível 1 e quarenta para sair do nível 10. Sem novos inimigos,
regiões e missões, aumentar a exigência apenas alongaria o treino de Argent.

## Recomendação: duas barras fáceis de entender

1. **Nível do personagem:** XP por monstros e missões; determina vida, mana,
   atributos e acesso a regiões. Primeiro ciclo planejado: níveis 1–60.
2. **Maestria da arma:** proficiência de 0–100 por uso efetivo. O nível da arma
   exibido é derivado dessa mesma barra: `min(20, 1 + piso(proficiência / 5))`.
   Não precisa de uma terceira barra de XP.

Para começar, manter a maestria **por família de arma**, como o sistema atual.
Trocar uma espada por outra preserva o aprendizado e os marcos de brilho. As
duas espadas do Crusader usam uma barra; cada golpe rende prática uma vez.
Se futuramente cada item precisar de uma história própria, adicionar vínculo
cosmético por exemplar, sem apagar a experiência adquirida com a família.

## Ciclo do personagem

Explorar → aceitar objetivo curto → combater inimigos adequados → ganhar XP e
prática → subir de nível → equipar uma melhoria ou abrir uma região → enfrentar
um encontro diferente. O próximo benefício deve aparecer na Bolsa e no mapa.

Proposta inicial de XP para passar do nível L para o seguinte:

`XP necessária = arredondar(40 + 28 × (L−1) + 2 × (L−1)²)`.

Monstro comum do mesmo nível: ponto de partida `10 + 3 × nível do monstro` XP.
Elite: aproximadamente 3× esse valor, ajustado pelo tempo e risco do encontro.
Missão curta: 20–30% da barra do nível; objetivo principal: 40–60%. Esses valores
não são somados outra vez na conclusão por cada inimigo já recompensado.

| Faixa | Conteúdo necessário | Benefício principal |
| --- | --- | --- |
| 1–5 | Tutorial de Argent; mover, selecionar, atacar, desviar do impacto e equipar | Entender o combate e conhecer a Bolsa |
| 6–10 | Acampamento próximo; dois tipos de inimigo e uma missão de elite | Primeiro brilho e primeiro novo equipamento |
| 11–20 | Rotas entre campos, objetivos de coleta e ameaças à distância | Novas combinações e acesso ao porto |
| 21–35 | Pequenas expedições marítimas e chefes de campo | Novos patamares de arma e armadura |
| 36–50 | Ilhas e encontros com preparação de recursos | Especialização da classe e refino avançado |
| 51–60 | Desafios de maestria e chefes finais do primeiro ciclo | Último brilho e variedade de configurações |

Equipamentos funcionais podem ter patamares em 1, 10, 20, 35 e 50. A aparência
Evanescence já liberada no nível 1 permanece como aparência; não deve virar
retroativamente um bloqueio de nível 55.

O nível é um benefício, sem exigir distribuições manuais a cada subida. Metas
iniciais de ritmo: 1–10 em 30–45 minutos; 10–30 em mais 3–5 horas; 30–60 em mais
10–20 horas. São metas para playtest: tempo de combate, deslocamento, missões e
quantidade de regiões precisam ser medidos. A fórmula de XP isolada não garante
esse ritmo. Para o próximo protótipo, construir primeiro apenas a faixa 1–10.

## Prática por uso que vale a pena

- Golpe ou skill ofensiva que causa dano útil a um inimigo adequado: +1 uso.
  Uma skill em área concede no máximo um uso por execução; ticks de veneno,
  animações, impactos cancelados, esquivas e dano em monstros retornando não treinam.
- A família corresponde à arma realmente empunhada. Punhos têm sua própria barra.
  Treinar uma skill de cajado não deve melhorar espadas guardadas.
- Próximo ponto de proficiência P exige `30 + 4 × P` usos. O contador precisa
  mostrar o progresso e o próximo marco, inclusive quando a recompensa visual
  aguarda o nível de personagem.
- Inimigos mais de cinco níveis abaixo do personagem deixam de render prática.
  Isso exige adicionar nível e faixa de XP às espécies; os seis monstros atuais
  não possuem esse dado. A área de treino não pode sustentar toda a progressão.
- Teto de poder sugerido: até **+12% de ataque** e **+8 pontos de acerto** pela
  proficiência máxima. Evitar bônus ilimitado de ataque e velocidade.

## O brilho conta a história da arma

| Proficiência | Nível da arma exibido | Nível do herói para liberar o efeito | Marco visual |
| --- | ---: | ---: | --- |
| 0–19 | 1–4 | 1 | Material original, sem refino adquirido |
| 20 | 5 | 5 | Refino +1: contorno discreto |
| 40 | 9 | 15 | Refino +2: brilho contínuo leve |
| 60 | 13 | 30 | Refino +3: pulso e trilha curta |
| 80 | 17 | 45 | Refino +4: aura mais definida |
| 100 | 20 | 60 | Refino +5: efeito completo da família |

O efeito só sobe quando **ambos** os requisitos forem cumpridos. Exemplo:
proficiência 40 no herói nível 12 mantém +1 e informa “Refino +2 no nível 15”.
A aparência de refino é reconhecimento de maestria: não acrescenta outro
multiplicador de dano além do bônus de proficiência. Assim a arma pode ficar
impressionante sem tornar o combate trivial. A Bolsa deve exibir “Arma Nv. 5 ·
Espadas 20/100 · próximo brilho: 40 + herói Nv. 15”.

**Restauração dos efeitos:** usar as tabelas originais `itemrefineinfo.txt` e
`itemrefineeffectinfo.txt` do Client para identificar os recursos adequados a cada
arma. Converter modelos, texturas e controladores necessários, anexar aos sockets
originais das mãos 6 e 9 e verificar as duas espadas em movimento e guardadas.
Não tratar a textura secundária `1.BMP` como se fosse todo o sistema de refino.
O emissive atual do Weapon Material Studio também não substitui esses efeitos.

Os cinco estágios da tabela são uma direção visual: a associação exata aos
efeitos históricos depende de inspecionar e converter os recursos. Usar partículas
limitadas no celular e um nível de efeito reduzido para armas distantes. Mordo Jr
permanece companheiro visual padrão, sem bônus obrigatório de XP ou atributos.

## HP, mana, ataque e defesa

Manter os atributos automáticos, com cinco pontos por nível distribuídos pela
identidade da classe. Sugestão para o ciclo inicial:

| Classe | Crescimento automático por nível |
| --- | --- |
| Crusader | +2 FOR, +1 CON, +1 DES, +1 AGI |
| Champion | +2 FOR, +3 CON |
| Sharpshooter | +3 DES, +1 CON, +1 AGI |
| Hunter | +2 DES, +1 CON, +2 AGI |
| Cleric | +3 INT, +1 CON, +1 AGI |
| Seal Master | +2 INT, +1 CON, +1 DES, +1 AGI |
| Voyager | +2 INT, +1 CON, +1 FOR, +1 DES |

Todos começam com cinco em cada atributo. Valores finais sugeridos, antes de
arredondar para exibição:

- **HP máximo:** `100 + 8 × CON + 6 × (nível−1) + bônus plano de equipamento`.
- **Mana máxima:** `30 + 8 × INT + 4 × (nível−1) + bônus de equipamento`.
- **Ataque:** `(6 + 2 × atributo principal + ataque da arma) × (1 + 0,12 × P/100)`.
  FOR para espadas/espadão, DES para arco/tiro e INT para os ataques mágicos.
- **Poder mágico:** `4 + 2 × INT + bônus do equipamento`; as skills definem seus
  próprios coeficientes, custo e cooldown.
- **Defesa:** `2 + 0,6 × CON + 0,4 × (nível−1) + defesa da armadura`.
- **Acerto:** `70 + 3 × DES + 8 × P/100`; esquiva começa em `2 × AGI`.
  Manter chance de acerto limitada, por exemplo entre 20% e 98%.
- **Velocidade de ataque:** iniciar com `0,7 + 0,03 × AGI`, limitada a 1,8/s no
  primeiro ciclo. Nenhum bônus de refino multiplica esse valor.

Exemplo para Crusader, sem equipamento e com P=0:

| Herói | HP | Mana | Ataque | Defesa |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 140 | 70 | 16 | 5 |
| 10 | 266 | 106 | 52 | 14 |
| 20 | 406 | 146 | 92 | 24 |
| 30 | 546 | 186 | 132 | 34 |
| 45 | 756 | 246 | 192 | 49 |
| 60 | 966 | 306 | 252 | 64 |

Fórmula de dano físico proposta: `ataque do golpe × 100 / (100 + defesa)`;
aplicar variação pequena e arredondar ao final. A defesa reduz uma porcentagem
progressiva, evitando que uma pequena diferença de atributo derrube todos os
golpes para 1 de dano. Dano mágico precisa de resistência própria; não presumir
que a mesma armadura anula todo tipo de ataque.

Projetar inimigos comuns para quatro a sete golpes do jogador e dano suficiente
para que ignorar suas preparações tenha consequência. Elite deve exigir usar
uma skill e se reposicionar. Champion aguenta mais; classes frágeis compensam com
alcance, controle e mobilidade. Validar contra inimigos de cada faixa, não apenas
contra o HP fixo dos monstros de Argent.

## Recuperação e custos

Sem regeneração passiva de HP durante combate, salvo habilidade específica.
Após oito segundos sem causar/receber dano: regenerar 3% do HP máximo por segundo.
Mana em combate: `0,5 + 0,05 × nível` por segundo; fora dele, 4% do máximo,
limitados a 20 MP/s. Mana precisa continuar sendo uma decisão em níveis altos;
custos de skills podem crescer por graduação, sem crescer a cada nível do herói.

Subir de nível recupera HP e mana e comunica o benefício. Derrota pode manter o
retorno à cidade sem perder nível, XP ou proficiência no primeiro ciclo. Consumíveis
entram quando existir inventário persistente por exemplar; não simular itens
consumíveis na interface antes de implementar quantidade e uso.

## Ordem de implementação

1. Conteúdo 1–10: níveis/XP de inimigos, duas missões, uma elite e telemetria
   local de tempo para matar, dano recebido, duração dos níveis e uso de skills.
2. Regras de proficiência elegível, barra única de maestria, nível da arma derivado
   e avisos do próximo marco na Bolsa.
3. Converter e testar apenas o primeiro efeito de refino de espadas, nas duas
   mãos, antes de expandir famílias e estágios.
4. Aplicar fórmulas de atributos, equipamentos por patamar e recuperação junto
   ao rebalanceamento de inimigos. Depois ampliar o conteúdo e o limite de nível.

Preservar saves: manter nível e classe, converter a fração de XP para a curva
nova e mapear a faixa antiga de prática 10–200 para 0–100, preservando a fração
do ponto em andamento. Não apagar prática de outras famílias nem truncar saves
que já ultrapassaram o novo limite planejado. A migração deve ter versão própria
e testes antes de substituir as regras atuais.
