> Registro da conferência anterior: a edição manual da Illusion Slash foi recuperada posteriormente, conforme solicitado pelo usuário. Este relatório não certifica as edições atuais.

# Verificação dos keyframes das skills

Os **714 keyframes dos 107 arquivos EFF**, além das curvas e tempos dos sistemas PAR, foram restaurados dos binários do Client. Os cinco campos pedidos são `d` (duração em segundos), `s` (escala XYZ), `a` (ângulo XYZ em radianos; a interface exibe graus), `p` (posição XYZ em metros, Z para cima no D3D) e `c` (RGBA).

A comparação independente com `sources/Engine/include/top/LegacyEffFormat.h`, compilado em C++, produziu **41.276 bytes de campos float32 exatamente iguais** aos valores do manifesto. A conferência Python dos 160 recursos também terminou sem diferenças. A última chave EFF interpola para a primeira, como em `CMPModelEff::FrameMove`; as curvas PAR usam `life / número de chaves` e seguram a última chave no último intervalo.

As poses convertidas em GLB são retemporizadas no editor para os 30 FPS do sources. Exemplo: Illusion Slash de Lance dispara seu evento original 15 frames após o início, ou 0,5 s; a pose dura 34/30 s. A duração de um vídeo, o cooldown, a vida das partículas e a duração de cada chave EFF são medidas diferentes.

## Resultado visual

Foram capturadas as 28 entradas do catálogo, em quatro instantes cada, e comparadas com amostras dos vídeos. Os clipes incluem tempo anterior ao cast, portanto a comparação é de forma/sequência, sem afirmar sincronização quadro a quadro entre os dois relógios. **A fidelidade visual integral não foi aprovada.** Os dados de keyframes conferem, mas o renderer ainda aproxima geometria, trajetórias, emissão e ligação aos personagens/armas.

| Classe | Skill | Observação visual |
|---|---|---|
| crusader | Illusion Slash #81 | Trilha segue arco de prévia; o projétil/impacto não coincide integralmente. |
| crusader | Berseker #84 | Aura dourada presente; volumes e emissão diferem. |
| crusader | Steath #123 | O personagem permanece opaco; o anel verde do vídeo não se reproduz nos instantes amostrados. |
| crusader | Shadow Slash #86 | Fita e expansão do impacto diferem. |
| cleric | Bolt #99 | Círculos presentes; a coluna de luz do vídeo não é reproduzida com a mesma forma. |
| cleric | Heal #97 | O editor aplica a cura ao alvo separado; o vídeo mostra autocura. |
| cleric | Energy #106 | Círculos/escudo presentes; altura e volume diferem. |
| cleric | Crystalline Blessing #255 | Partículas presentes; aparece mancha escura e falta o anel dourado do vídeo. |
| sharpshooter | Cripple #94 | Carga e impacto presentes; composição e ligação à arma diferem. |
| sharpshooter | Enfeeble #95 | O efeito roxo/raio aparece no editor, mas não coincide com a composição do vídeo. |
| sharpshooter | Headshot #96 | Disparo e marcas presentes; orientação/forma do disparo diferem. |
| sharpshooter | Red Thunder Cannon #456 | Feixe presente; orientação, volume e material diferem. |
| hunter | Dual Shot #90 | Círculo e projéteis presentes; enquadramento e sequência visual diferem. |
| hunter | Frozen Arrow #93 | Carga e impacto de gelo presentes; volume e composição diferem. |
| hunter | Venom Arrow #224 | Carga violeta presente; falta reproduzir a composição completa do projétil/impacto. |
| hunter | Meteor Shower #112 | O grande selo branco do vídeo não aparece completo; queda/impactos diferem. |
| voyager | Conch Ray #216 | Efeito de lançamento presente; não coincide com o caminho/composição do vídeo. |
| voyager | Lightning Bolt #214 | Carga elétrica e raio no alvo presentes; volume e luz diferem. |
| voyager | Tornado #213 | Partículas verticais presentes; falta a forma volumétrica do tornado. |
| voyager | Super consciousness #454 | Sem correspondência visual conclusiva nas amostras; vídeo e efeito são discretos. |
| seal-master | Spiritual Bolt #99 | Círculos presentes; a coluna de luz do vídeo não é reproduzida com a mesma forma. |
| seal-master | Heal #97 | O editor aplica a cura ao alvo separado; o vídeo mostra autocura. |
| seal-master | Intense Magic #256 | Onda radial branca presente; dimensão aparente e perfil visual diferem. |
| seal-master | Shadow Insignia #105 | Símbolos presentes; posição/orientação e composição diferem. |
| champion | Howl #107 | Lobo e onda presentes; planos e volumes diferem. |
| champion | Roar #243 | Onda e partículas presentes; composição de símbolos/poeira difere. |
| champion | Primal Rage #83 | A malha gigante é substituída/mostrada como cilindro; não corresponde ao pé do vídeo. |
| champion | Beast Legion Smash #455 | A malha e a nuvem de poeira não correspondem ao pé dourado do vídeo. |

O ZIP contém 29 vídeos. Holy Judgement (#458), o quinto vídeo de Cleric, não está entre as 28 entradas atuais do editor. Sua fidelidade visual não foi verificada nesta página.

## Capturas por classe

- Crusader: [editor](crusader-editor.jpg) e [vídeo](crusader-video.jpg).
- Cleric: [editor](cleric-editor.jpg) e [vídeo](cleric-video.jpg).
- Sharpshoot: [editor](sharpshooter-editor.jpg) e [vídeo](sharpshooter-video.jpg).
- Hunter: [editor](hunter-editor.jpg) e [vídeo](hunter-video.jpg).
- Voyager: [editor](voyager-editor.jpg) e [vídeo](voyager-video.jpg).
- Seal Master: [editor](seal-master-editor.jpg) e [vídeo](seal-master-video.jpg).
- Champion: [editor](champion-editor.jpg) e [vídeo](champion-video.jpg).

## Arquivos e repetição da conferência

- `assets/skills/visuals.json`: valores originais usados pelo editor.
- `assets/skills/keyframes-audit.json`: arquivos, hashes SHA-256 e dependências por skill.
- `referencias/skill-keyframes-backup/`: cópias anteriores à restauração.
- O navegador guarda a prévia anterior em `top-vfx-edits-v2-before-client-original-keyframes-v1` antes de limpar os presets genéricos.

```bash
python3 scripts/sync_skill_keyframes.py /home/elieltavares/DEV/TOP2/TalesOfPirateDX9/Client
node tools/tests/original-keyframes-tests.mjs
node tools/tests/pose-timing-tests.mjs
node tools/tests/timing-tests.mjs
```

Abra pelo servidor HTTP: http://127.0.0.1:8000/tests/skill-editor.html. Abrir o arquivo pelo protocolo file:// impede o carregamento normal dos módulos e assets.

## Resultados dos checks

A conferência dos keyframes, a temporização de poses e efeitos, e skill-vfx-data passaram. O teste de catálogo aponta um canal de Heal sem arquivo: a tabela original escreve `heallight.pa`, enquanto existe `heallight.par`; esse canal já estava nulo no catálogo. O teste geral game-visuals-parity falha numa comparação estrita preexistente entre `-0` e `0` em `skillWorldTransform`; os arquivos desse cálculo e desse teste não foram alterados.
