# Skill FX Studio v6.2 — modelos equipados e sockets LAB

## O que já existia

O projeto já inclui GLBs de personagens com visual equipado em
`assets/equipment/models/<personagem>-<classe>.glb`.
O script `scripts/build_evanescence.py` monta esses modelos e incorpora
a geometria dos itens ao esqueleto usando os dummies de
`Client/animation/*.lab`. O jogo alternava entre modelo básico e equipado,
mas o Studio mostrava somente o básico e as skills usavam um ponto fixo.

## O que foi integrado

1. **Editor:** opção `Exibir equipamento da classe (GLB)` ativada por padrão.
   Ela carrega o mesmo modelo equipado do jogo e continua aceitando os clipes
   extras em `assets/skills/animations/<personagem>.glb`.
   Quando o conjunto não existe, continua usando o GLB básico.
2. **Ponto FX:** marcador verde no visualizador indica a origem animada da
   camada selecionada, se houver dummy e osso compatíveis. A opção
   `Origem FX` liga e desliga esse marcador.
3. **Dados:** `js/skill-fx-sockets.mjs` consulta
   `visuals.attachments.<personagem>.items.<classe>[dummy]` para canais
   `item/itemExtra`; para `flight` usa `itemDummy` quando especificado,
   ou o dummy do personagem. A matriz do dummy é aplicada ao osso animado
   do GLB e transformada para o espaço local do `FxPlayer`.
4. **Reprodução:** partículas, voo EFF e trilhas usam essas origens quando
   disponíveis. O renderer consulta o dummy apenas uma vez por camada/frame,
   para limitar o custo em mobile.
5. **Jogo:** ao equipar o conjunto, a instância do avatar é informada ao
   renderizador de skills. Com o GLB básico, dummy ausente ou modelo
   indisponível, usa o fallback existente em vez de selecionar um osso não
   relacionado.

## Limitações

- O dummy LAB é o **ponto de conexão do item**. A extremidade exata do modelo
  equipado pode exigir um helper adicional do arquivo LGO, ainda não
  exportado como um nodo separado no GLB.
- O arco da trilha continua sendo a aproximação ajustável do editor, mas
  agora acompanha o dummy quando existe. Ele ainda não usa os dois pontos
  animados da lâmina para reconstruir a fita histórica.
- Não existe correspondência automática completa de todos os efeitos do
  DirectX. Os timings de eventos não verificados e a colisão da trajetória
  permanecem aproximações.

## Como testar

Abra `tests/skill-editor.html`, escolha uma classe, personagem e skill,
marque `Exibir equipamento da classe (GLB)` e `Origem FX`. Selecione uma
camada `item` e arraste a linha do tempo: o marcador verde deve acompanhar
o dummy daquela camada. Em `index.html`, habilite `Equipar Evanescence`
para carregar o GLB com equipamento. O console do jogo disponibiliza
`window.__skillVfxInfo()`, que agora indica `actorModelConnected`,
`actorEquipped` e `actorJob`.

Validação de código e de transformações de sockets efetuada; reprodução
visual final no navegador precisa de confirmação com os GLBs e animações.
