# TOP Web no celular — câmera e instalação

## Câmera mobile
A câmera mantém a órbita ajustada pelo jogador, mas seu **foco acompanha o
personagem** com uma interpolação exponencial independente de FPS. Em **Configurações → Câmera no celular**, há dois modos:

- **Atrás do personagem · suave** (padrão): ao mover o joystick, a câmera
  gira suavemente para acompanhar a direção de deslocamento. O rumo usado
  pelo joystick é fixado no início de cada toque, evitando que um joystick
  lateral mantido cause rotação contínua/caminhada em círculos. Ao soltar o
  joystick e tocar novamente, a nova direção da câmera vira a referência.
- **Livre · giro manual**: a câmera só acompanha a **posição** do avatar;
  o ângulo pode ser girado manualmente sem correção automática.

Mesmo no modo suave, arrastar o cenário para olhar em volta suspende por
2,5 s o giro automático; movimentar o joystick depois faz a câmera voltar
gradualmente para trás da direção percorrida. O modo escolhido fica salvo
em `topweb_mobile_camera_mode` no armazenamento local do navegador.

A suavização da **posição** usa resposta 6,5 por segundo e faz snap para
distâncias grandes (por exemplo, teleporte), evitando uma câmera perdida.
O giro usa `gentleOrbit` com até 2,1 rad/s no modo suave.

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
