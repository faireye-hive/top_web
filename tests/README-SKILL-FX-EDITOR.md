# TOP Web — Laboratório de Efeitos Visuais por Skill

**Página:** `tests/skill-editor.html`

## Usar

### Edição manual ampliada

A duração automática da prévia usa exatamente o clipe mostrado em **Animação 3D**.
O modo Manual permite escolher uma janela maior para efeitos longos.
O editor preserva as edições locais ao abrir; não restaura presets automaticamente.

- Cada camada tem posição, rotação e escala XYZ, opacidade, origem/socket,
  atraso, início absoluto, velocidade e limite de duração.
- Peças EFF podem ser criadas, duplicadas, ocultadas e excluídas.
- Keyframes podem ser duplicados, reordenados e copiados/colados entre peças;
  há multiplicador de tempo, interpolação linear ou valor fixo e campos RGBA/hexadecimal.
- A prévia aceita tempo numérico, passos de 1/30 s e reprodução sem repetição.
- **Salvar** mantém o trabalho no navegador. **↓ Edições** permite reimportar;
  **↓ visuals.json** incorpora os controles e parâmetros globais para publicar o arquivo.

O ajuste da Illusion Slash anterior à restauração dos dados históricos foi
recuperado de `referencias/skill-keyframes-backup/visuals.json`. Edições mais
recentes já salvas no navegador continuam tendo prioridade sobre esse arquivo.

Em uma cópia do repositório com o PR incorporado:

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000/tests/skill-editor.html`. Na hospedagem
GitHub Pages, use `/top_web/tests/skill-editor.html`.

O editor carrega recursos já publicados em:
- `assets/skills/catalog.json` (7 classes / 28 posições);
- `assets/skills/visuals.json` (originais: `channels` e `resources`);
- `assets/skills/textures/` e `assets/skills/models.glb`;
- `assets/characters/*.glb` para prévia do ator;
- `assets/skills/animations/*.glb`, quando disponível.

### Fluxo

1. Selecione classe, personagem e skill.
2. Escolha uma camada do efeito (partícula `.par`/`.eff`).
3. Edite **visibilidade, tamanho, XYZ, opacidade, duração, atraso,
   rotação, cor e quantidade de cópias**.
4. Ajuste escala geral, opacidade, velocidade, duração, altura, distância
   ao alvo e limite de partículas.
5. Use prévia 3D, arraste para girar câmera, role para zoom, teste a
   linha do tempo ou clique **Reproduzir**.
6. **Salvar** grava a alteração por ID de skill em
   `localStorage.topweb_skill_vfx_overrides_v1`.
   O jogo nesta mesma origem lê os mesmos presets.
7. **Exportar JSON** baixa `vfx-presets.json`. Para distribuir os ajustes,
   publique em `assets/skills/vfx-presets.json`.
8. **Importar** recupera arquivo JSON. **Restaurar skill** repõe a
   configuração padrão dessa habilidade sem alterar outras skills.

### O que foi corrigido

O código antigo esperava `manifest.skills[id].layers` inexistente.
O módulo `js/skill-vfx-data.mjs` agora converte os canais e os recursos
históricos em camadas com IDs estáveis, usadas tanto pelo editor quanto
pelo renderizador `js/skill-visuals.mjs`.

O editor **não** converte integralmente os sistemas de partículas do
DirectX para WebGL. É uma aproximação editável em Three.js: ainda
será necessário ajustar individualmente posicionamento, orientação,
textura, duração e movimentação. O motor limita os objetos FX para
reduzir custo em dispositivos móveis.

### Validação

```bash
node --test tests/skill-vfx-data.test.mjs
node --test tests/*.test.mjs
```

A estrutura de dados foi validada para as 28 skills. Falta confirmar
visualmente no navegador as animações e os efeitos em contexto de combate.
Use servidor HTTP, não abra o HTML via `file://`.


## Efeitos editados dentro do jogo

O jogo `index.html` usa o mesmo `FxPlayer` de `tests/skill-editor.html`
via `js/skill-visuals-runtime.mjs`. Ambos entendem os sistemas PAR, modelos
EFF, as trilhas `strips` (inclusive `swing.rotation`) e os keyframes do
`visuals.json`. O jogo agora posiciona a cena da skill no personagem e gira
o eixo +X em direção ao alvo; o motor de combate continua independente.

**Duas formas de testar alterações:**

1. No mesmo navegador e origem, clique **Salvar** no Studio e atualize a página
   do jogo. Os patches locais `top-vfx-edits-v2` serão aplicados na próxima
   skill executada; não é necessário exportar a cada mudança.
2. Para publicar alterações para todos, clique **↓ visuals.json** no Studio,
   substitua `assets/skills/visuals.json` e faça commit/push desse arquivo.
   A versão publicada no GitHub não muda somente ao clicar em Salvar ou
   baixar o JSON. O jogo solicita o manifesto com revalidação de cache.

Se o arquivo já tiver `source: "... + editado no Skill FX Studio"`, o jogo
usa os recursos já editados e ignora os patches locais para não duplicar
camadas acrescentadas. Para testar novos patches locais sobre um JSON já
exportado, trabalhe a partir de uma cópia original não incorporada.

**Diagnóstico:** no Console (F12) da página do jogo, rode
`window.__skillVfxInfo()`. A propriedade `mode` deve mostrar
`shared FxPlayer / PAR + EFF + strip + keyframes`, `loaded` deve
ser `true` e `activeSkills` mostra efeitos durante a execução.

A geometria das trilhas ainda é uma aproximação do DX9: segue um arco
configurável, não os dummies da arma a cada frame. O multiplayer, a física
de colisão e os tempos de impacto do GameServer não são reproduzidos
automaticamente pelo renderer.
