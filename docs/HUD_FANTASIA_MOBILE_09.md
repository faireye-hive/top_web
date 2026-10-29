# TOP Web 0.9 — HUD mobile inspirado no RPG fantasia

**Alteração real no código**, sem substituir o jogo por uma imagem.

O visual usa apenas **HTML, CSS e SVG inline**: não adiciona texturas 3D,
shaders ou dependências ao Three.js.

## Em celular (landscape e portrait)

- Cartão do personagem com avatar ilustrativo temporário e barras HP/MP.
  **Não exibimos HP/MP falsos:** barras vazias e valores "—" até os atributos reais
  serem implementados; `rpgHud.setStats({hp,maxHp,mp,maxMp})` atualiza os dois.
- Topo: menus pequenos com ícones de Missões/Loja **desativados** (sem sistema),
  Bolsa/Skills (abrem as respectivas abas) e Menu (abre as configurações).
- Minimapa de Garner em moldura circular, com +/− para zoom.
- Joystick azul à esquerda (mesmo código de movimentação).
- Ataque grande com espadas douradas, Interagir e Correr à direita.
- **Quatro** skills circulares (animações reais do GLB) acima das ações.
  Atalhos salvos em localStorage; teclado `1`–`4` no desktop.
- O menu **Herói** continua contendo Status/Bolsa/Skills.
- A câmera automática e as otimizações de renderização existentes foram preservadas.

## Arquivos

```text
index.html             layout, SVGs e IDs das ações
mobile-fantasy.css     tema visual e breakpoints
js/rpg-hud.mjs         quatro slots, menus rápidos e barras HP/MP
js/main.js             atalho 4 (sistemas Three.js intactos)
```

As imagens das skills são **ícones ilustrativos de interface**: não inventam
efeitos ou dano. Quando o jogador selecionar um clipe, o atalho aciona
a animação que já existe no GLB. Espaços sem clipe permanecem indisponíveis.

## Testar

```bash
node --test tests/*.test.mjs
python3 -m http.server 8000
```

Abra no celular em **paisagem** primeiro, depois retrato. Verifique abertura
de Bolsa/Skills, os quatro atalhos, controle de câmera, zoom, ataque, corrida e
joystick. No desktop, confirme que WASD, teclas 1–4 e mouse continuam funcionando.

**Observação:** não é uma reprodução pixel-perfect da referência; a imagem
tem interface de um RPG completo, enquanto o TOP Web continua em fase de
exploração. Sem dados reais, itens, missão ou loja ficam inativos.
