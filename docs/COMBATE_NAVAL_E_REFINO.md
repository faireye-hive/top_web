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
| Cadência | 0,8 tiros/s |
| XP por criatura | 10 + 3 × nível original do monstro |

Subir de nível recalcula os atributos e recupera HP. Fora de combate, sem tiros
ou dano por **6 segundos** e sem inimigos engajados, o casco recupera
**4% do HP máximo por segundo**, inclusive parado ou atracado. Menus pausam os
tempos. Ao afundar, um resgate de cinco segundos devolve ao porto com HP
restaurado, sem perder XP ou nível. Fechar/reabrir o jogo preserva o HP salvo.

O painel do barco substitui o retrato enquanto navega e mostra nível, HP, XP e
estado de combate/reparo no mobile e no desktop. **GM → +1/+10 barco** permite
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
resgate, migração de saves de herói e crescimento/limites dos efeitos de refino.
