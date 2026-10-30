# TOP Web — Laboratório de Efeitos Visuais por Skill

**Página:** `tests/skill-editor.html`

## Usar

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
