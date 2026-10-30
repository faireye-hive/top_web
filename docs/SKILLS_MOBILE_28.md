# TOP Web 0.14 — as 28 skills escolhidas

O pacote `TOP_Web_028_Skills_Originais_Assets.zip` foi produzido a partir
de `TOP_Web_Skills_28_assets.zip` enviado pelo usuário.

## O que é funcional nesta etapa

- São **sete classes com quatro slots fixos** no HUD: Crusader, Cleric,
  Sharpshooter (pistola), Hunter (arco), Voyager, Seal Master e Champion.
- São **28 slots e 26 skills únicas** (Bolt/Heal compartilhadas).
- **25 ícones PNG originais** aparecem na hotbar e no menu de Skills.
- Animações de ação dos `.lab` foram extraídas sem duplicar os personagens:
  `assets/skills/animations/lance.glb` (9 ações extras),
  `carsise.glb` (4 ações) e `phyllis.glb` (9 ações).
  Ami usa as ações já presentes no próprio GLB.
- Ao trocar de classe ou personagem, os quatro botões mudam automaticamente.
- Usa os IDs da ação de arma do catálogo, e não o rótulo `Skill 1`.
  **Ação ausente = skill desativada**, nunca animação de arma incorreta.
- Red Thunder Cannon pode executar a sequência 223/224/225.
- Hunter foi adicionado à seleção e à prática de arco, preservando saves
  antigos de personagens sem `practice.bow`.

**Importante:** estes botões executam **animações reais**, mas ainda **não**
implementam dano, consumo de mana, cooldown, estados de combate, efeitos de
partículas históricos ou aplicação de buffs. O projeto já tem combate local
separado; futuras skills precisam ser implementadas com regras próprias.
Os efeitos `.par`/`.eff` foram preservados em `legacy/` para a próxima fase,
porém o Three.js não renderiza esses formatos diretamente.

As classes Sharpshooter e Hunter receberam suas ações de arma corretas, mas
**os modelos 3D da pistola e do arco ainda não vieram neste ZIP**; não afirmamos
que foram equipados. Armas precisarão de seus modelos próprios.

## Instalação do ZIP na branch

1. Na raiz do repositório, após `git fetch origin`:

```bash
git switch feat/skills-28-class-assets
unzip -o TOP_Web_028_Skills_Originais_Assets.zip 'assets/skills/*'
python3 scripts/verify_skill_assets.py
node --test tests/*.test.mjs
git add assets/skills/
git commit -m "assets(skills): adicionar 28 skills originais e animacoes extras"
git push origin feat/skills-28-class-assets
```

2. Verifique que foram enviados `assets/skills/catalog.json`,
`assets/skills/icons/`, `assets/skills/animations/` e
`assets/skills/legacy/`.
3. Faça merge **depois** de verificar os arquivos binários na branch.
4. No GitHub Pages, atualize a página sem cache e abra **Herói → Skills**.
   Troque a classe na aba **Status** e verifique os quatro ícones.

O pacote tem aproximadamente 1,1 MiB comprimido e inclui os três GLBs de
animações suplementares. Não instale os arquivos `.lab` gigantes no frontend.

### Limites técnicos atuais

Não houve teste visual em navegador real das ações adicionadas, especialmente
as transições de arma e os ossos. Animações suplementares reutilizam nomes de
ossos do próprio GLB do personagem e são carregadas somente quando necessário.
Se um GLB/ícone suplementar não estiver publicado, o módulo mantém o HUD
anterior ou desabilita a skill, sem inventar uma ação.

**Próximo passo:** extrair as texturas usadas pelos 55 efeitos `.par/.eff`
e portar apenas os efeitos visuais necessários com orçamento de partículas
compatível com mobile. Não é necessária a versão C++ no navegador.
