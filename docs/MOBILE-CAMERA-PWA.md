# TOP Web no celular — câmera e instalação

## Câmera mobile
A câmera mantém a órbita ajustada pelo jogador, mas seu **foco acompanha o
personagem** com uma interpolação exponencial independente de FPS. Em **Configurações → Câmera no celular**, há dois modos:

- **Atrás do personagem · giro discreto** (padrão): a câmera ajusta o
  enquadramento suavemente ao caminhar. O usuário pode alterar ao vivo a
  **velocidade automática (0–180°/s)** e a **correção máxima (0–180° por gesto)**,
  ambas com barra e campo numérico. O padrão é **24°/s e 24° por gesto**;
  valor 0 desliga a rotação automática. A zona morta de ~7° evita pequenos
  ajustes excessivos. A direção usada pelo joystick é fixada ao iniciar
  cada pressão, evitando caminhada em círculos quando a câmera gira.
  Ao soltar e pressionar novamente, o ângulo atualizado vira a referência.
- **Livre · giro manual**: a câmera só acompanha a **posição** do avatar;
  o ângulo pode ser girado manualmente sem correção automática.

Mesmo no modo suave, arrastar o cenário para olhar em volta suspende por
2,5 s o giro automático; movimentar o joystick depois faz a câmera voltar
gradualmente para trás da direção percorrida. O modo escolhido e os ajustes ficam salvos no armazenamento local do
navegador (`topweb_mobile_camera_mode`,
`topweb_mobile_camera_speed_deg`, `topweb_mobile_camera_turn_deg`).
O botão **Restaurar** retorna para 24°/s e 24° por movimento. Os controles
ficam desativados no modo Livre, preservando os valores para quando o
acompanhamento for reativado.

A suavização da **posição** usa resposta 6,5 por segundo e faz snap para
distâncias grandes (por exemplo, teleporte), evitando uma câmera perdida.
O giro usa `gentleOrbit` com velocidade máxima derivada do controle em
graus por segundo, enquanto `subtleFollowTarget` limita a correção por gesto.

A regra só é aplicada em `MOBILE_UI`; no desktop, o enquadramento permanece
instantâneo. O cálculo puro pode ser testado em
`tests/mobile-camera-pwa.test.mjs`.

## Instalação (PWA)
- **Android (Chrome e navegadores compatíveis):** abra o jogo em HTTPS;
  toque em **Instalar jogo** quando aparecer o botão ou use
  menu ⋮ → **Instalar app / Adicionar à tela inicial**.
- **iPhone/iPad:** abra em Safari, toque em **Compartilhar** e selecione
  **Adicionar à Tela de Início**; o site pode abrir em modo standalone.
- **Hospedagem:** a instalação completa e o Service Worker requerem
  HTTPS (ou localhost no dispositivo). Endereços HTTP da rede local,
  como `192.168.x.x`, não são origens seguras para Service Workers.
- **Ícone:** `pwa/top-icon.svg` contém o ícone vetorial de TOP Web,
  registrado no `manifest.webmanifest`.
- **Offline:** o Service Worker guarda somente o shell leve de navegação.
  O mundo 3D, as animações e as bibliotecas externas ainda exigem internet;
  portanto, não tratamos o jogo como offline.
- **Atualizações:** `sw.js` usa rede primeiro para o shell e evita cache de
  `visuals.json`, animações e modelos de personagens, para não esconder
  modificações publicadas via GitHub.

O botão de instalação é opcional e pode ser dispensado; quando o navegador
não fornece `beforeinstallprompt`, ele mostra como criar o atalho manual.

## Skills sem cortes no meio

A partir da versão mobile `main.js?v=37`, o personagem fica imóvel durante
uma habilidade. A animação é liberada **somente quando o evento `finished`
do Three.js AnimationMixer for emitido para o último clipe GLB** (inclusive
as ações subsequentes previstas no catálogo histórico). Movimentos do
joystick, WASD, cliques no terreno e botões de pose não substituem a skill
por `Correr`/`Parado` durante esse período.

- Não se utiliza timeout fixo nem duração visual dos `.par/.eff`: o tempo
  vem da própria duração da animação GLB e do fim da sequência.
- O combate continua processando o tempo de conjuração, impacto e dano,
  independentemente de o personagem estar imóvel.
- Trocas de classe, personagem e equipamento solicitadas no painel são
  bloqueadas até a skill terminar. Teletransporte e derrota continuam sendo
  exceções explícitas que podem encerrar a animação por segurança.
- Ataque básico continua com seu comportamento de movimento anterior;
  o bloqueio é exclusivo das animações de skill.

A validação inclui um teste simulando `finished` de dois clipes em sequência
e conferindo que o bloqueio só é removido no segundo.
