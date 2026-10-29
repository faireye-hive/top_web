# TOP Web 0.8 — interface RPG mobile

O RPG HUD é **somente interface e atalhos de animações** nesta etapa.
O jogo segue local, sem inventário, nível, dano ou HP simulados.

## Objetivo visual

- Menus escondidos durante exploração: um botão **Herói** abre o painel.
- **Status, Bolsa, Skills** são abas do mesmo painel modal, não três janelas.
- No celular o painel vira uma folha inferior (paisagem: lateral) que oculta
  o restante da interface apenas enquanto aberto.
- Joystick e ataque existentes são preservados; três skills menores ficam
  acima dos botões de combate, sem bloquear o centro de Garner.
- Ícones são simples, sem arquivos de imagem adicionais ou shaders.
- A câmera clássica e o modo de cores vivas permanecem intactos.

## Arquivos

- `index.html`: markup acessível, abas e atalhos.
- `rpg-hud.css`: responsividade, cores, tamanhos e safe area.
- `js/rpg-hud.mjs`: painel, foco, clipes, slots e conteúdo.
- `js/rpg-state.mjs`: funções puras de seleção e persistência de slots.
- `js/main.js`: ponte com as animações históricas do GLB.
- `js/mobile-controls.js`: solta joystick e corrida quando o menu abre.
- `tests/rpg-state.test.mjs`: testes da seleção de animações.

## Fonte dos dados

```js
// Futuro: após carregar uma save local/autorizada
rpgHud.setStats({
  name: 'Lance',
  level: numeroReal, hp: hpReal, mp: mpReal,
  strength: forcaReal, agility: agilidadeReal, defense: defesaReal
});
rpgHud.setItems([
  {name: 'Item real do save', symbol: '◇', quantity: 1},
  // ... até 24 slots, sem dados inventados
]);
```

Até integrar um estado real de gameplay, todos os atributos são mostrados
com **—** e os 24 slots de bolsa aparecem vazios. `setItems()` não concede
itens e não mexe em arquivos de save; é apenas um renderer de dados.

O script lê os `gltf.animations` do personagem carregado; somente nomes que
correspondem a `Skill N`, `Habilidade`, `Magia` ou `Ataque N` entram na lista.
O usuário pode escolher os atalhos 1, 2 e 3, que ficam em
`localStorage.topweb_rpg_skill_slots_v1`.
Cada atalho executa **apenas a animação existente**, via `playClip`, sem efeito
visual ou dano. Slots inválidos após trocar de personagem são substituídos
pelos clipes disponíveis.

## Passos seguintes, sem aumentar a carga na GPU

1. Criar `js/game-state.mjs` com estado local de HP/MP, inventário, itens e
   atributos quando os sistemas reais forem implementados.
2. Disparar eventos de mudança: UI atualiza DOM somente quando necessário,
   **nunca uma vez por frame**.
3. Substituir símbolos genéricos por ícones otimizados depois de saber quais
   itens/skills realmente existirão.
4. Se entrar multiplayer com Supabase, o servidor deverá autorizar alterações
   em inventário/atributos. A UI recebe snapshots validados; não gera dados
   autoritativos nem expõe chaves secretas no navegador.

## Teste

```bash
node --test tests/*.test.mjs
python3 -m http.server 8000
```

No celular: menu Herói, alternar abas, escolher skill para o atalho 1–3,
fechar, executar ícone e voltar a andar. Verificar retrato/paisagem e que o
joystick para de mover o personagem quando o menu abre. No desktop, testar
teclas **1, 2 e 3** e **Esc**. Todas as animações dependem dos clipes reais.
