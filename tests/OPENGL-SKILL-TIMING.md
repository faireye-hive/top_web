# Skill FX Studio — callbacks do cliente OpenGL (integração inicial)

Fonte consultada: `ultimo_sources29(1).zip`, cliente OpenGL, sem executar o jogo.
Esta integração **não** afirma equivalência visual ao DirectX 9.

## Proveniência do tempo

- `sources/Engine/src/top/play/PlayCombat.cpp`: `keyFrameDelay` separa `-1` (início), `-2` (fim), e outros valores (callback de impacto da pose); separa lançamentos de item, ator, voo e resultado.
- `sources/Engine/include/top/SkillVisual.h`: associa canais do SkillInfo e seus índices de callback; itens nas colunas 54/55 possuem callback próprio, voo na 56.
- `sources/Engine/src/top/play/PlayPresentation.cpp`: preenche duração e instante de impacto por ação conforme personagem e grupo de arma.
- `sources/Engine/src/top/ActorSkin.cpp` (`playerActionDuration`, `playerActionWindup`): duração `(end-start)/30` e impacto `(impact-start)/30`, a partir dos dados de **pose** (`start/end/impact`).
- `sources/MIGRATION/MIGRATION_05-CG.md`: a recarga não deve esticar animações não cíclicas; por exemplo, Illusion Slash tem cooldown de 5 s, **não** animação de 5 s.
- `sources/MIGRATION/MIGRATION_SK2_18C_SKILL_EFFECT_AUDIT.md`: lançamento/chegada do projétil no porte GL é uma aproximação estática; trajetórias móveis e colisões DX9 não são equivalentes.

## O que o editor faz agora

1. Mapeia callbacks de **início** (`-1`) para `t=0`.
2. Mapeia callbacks de **fim** (`-2`) para a duração do clipe GLB escolhido, **se** ele estiver disponível.
3. Mantém os callbacks de **impacto** (`0` ou positivos) sem timestamp quando a pose não fornece `impact`; o fallback `t=0` é explicitamente rotulado como aproximação.
4. Lê de modo independente os callbacks de item, item extra e voo; a chegada continua como **estimativa** `distância/velocidade`.
5. Exibe eventos verificáveis e estimados numa trilha separada e exporta o diagnóstico em **↓ Tempos**.
6. A API `stageTimes` aceita `overrides.verifiedImpactTime` (segundos relativos à animação) quando houver dados confiáveis da pose, e `overrides.verifiedRelease` para lançamento previamente medido. O editor não inventa esses valores.

## O que falta para os timestamps 100% automáticos

O ZIP de código do OpenGL possui o leitor e o cálculo, **mas não todas as tabelas de poses** usadas por `ActorSkin` para cada personagem/grupo de arma. Precisamos da tabela original de ações/poses do Client contendo `start`, `end` e `impact`, ou de uma exportação fiel e identificada por personagem, grupo de arma e ação. Os clipes GLB possuem tempos de **movimento**, mas as suas chaves não são automaticamente eventos de disparo.

Sem isso, não é possível certificar os instantes de lançamento de Illusion Slash (callback 0) nem de outras skills com o mesmo tipo de evento.

## Testes

```bash
node tools/tests/timing-tests.mjs
node tools/tests/catalog-timing-tests.mjs
```

Cobrem -1/-2/0, callback de itens independentes, voo, aviso de pose ausente e importação futura de um tempo de impacto verificado.