# Monstros originais de Garner e testes GM

Garner usa novamente a população de `Client/scripts/offline/garner/garnerChaSpn.txt`:
129 espécies, 160 regiões e 10.435 nascimentos, incluindo criaturas do mar.
As espécies, quantidades, retângulos e tempos de reaparecimento vêm do original.
Como o servidor original sorteia as posições dentro de cada retângulo, o exportador
usa uma semente fixa e rejeita pontos bloqueados ou do habitat errado no terreno
original. Os seis monstros artificiais no centro de Argent foram removidos.

Os modelos, texturas e animações vêm do Client. HP, ataque médio, defesa, acerto,
esquiva, velocidade e nível vêm do CharacterInfo. O combate continua usando as
fórmulas web; XP recebida é `10 + 3 × nível do monstro`. As plantas com ataque zero
não revidam. IA 10 inicia combate por proximidade; os demais inimigos revidam.
Criaturas marinhas participam do [combate naval](COMBATE_NAVAL_E_REFINO.md),
com seleção, canhões, retaliação e XP própria do barco.
Eventos e criações adicionais por scripts de servidor não são executados.

## Celular e desktop

Não são instanciados dez mil atores: um índice espacial consulta a vizinhança
duas vezes por segundo. O celular mantém até 12 monstros num raio de 55 m,
com dois carregamentos simultâneos; o desktop mantém até 28 num raio de 80 m,
com três carregamentos. O alvo e inimigos em combate têm prioridade nas vagas.
A mudança entre interfaces também atualiza esses limites.

Ao sair da região, atores e texturas de esqueleto são liberados. Geometrias,
materiais e texturas de modelos sem uso saem do cache, que tenta conservar
até seis modelos no celular e doze no desktop; modelos ainda em uso permanecem
compartilhados até seus atores saírem. Os 129 GLBs somam cerca de 36 MiB no
repositório, mas são baixados sob demanda. Cada arquivo tem menos de 1 MiB.
Sair e voltar não antecipa o reaparecimento de um monstro derrotado.

**Menu → Ir aos monstros · arredores de Argent** leva a uma área original
de monstros, em aproximadamente **2130, 2730**.

## Menu GM

Abra **Menu → GM · Teste de balanceamento**, tanto no celular quanto no desktop:

- **+1 herói / +10 herói:** aumentam o nível real, recalculam os atributos da
  classe e recuperam HP/mana. Limite 1000; XP acumulada é preservada.
- **+1 arma / +10 arma:** aumentam a proficiência do ataque em uso, de 10 até
  200. Cada nível acrescenta +1 ao ataque; não altera o refino visual.
  Sem conjunto equipado, aumenta **Punhos**. Com conjunto equipado, aumenta
  Espadas, Espadões, Tiro, Arcos, Cajados ou Adagas conforme a classe.

O painel mostra qual prática será alterada. Cada arma conserva sua prática ao
trocar classe/equipamento. Os valores são salvos no mesmo progresso local do
jogo e persistem ao recarregar; não há permissões GM de servidor nesse jogo local.
Prepare os níveis em Argent antes de entrar na Torre: os botões ficam bloqueados
durante a tentativa, trocas de personagem/equipamento e animações de skill.
Os quatro botões têm área mínima de toque de 44 px, e o menu continua aberto
após um aumento para permitir incrementos consecutivos.

## Recriar e verificar

```sh
python3 scripts/build_garner_monsters.py /caminho/Client
node --test --test-isolation=none tests/*.test.mjs
python3 scripts/verify_mobile_assets.py
```

`--manifest-only` recria somente os dados, sem converter novamente os modelos.
O exportador requer os setores originais já publicados em `assets/garner/terrain`.
