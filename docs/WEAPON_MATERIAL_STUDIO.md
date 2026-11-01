# Weapon Material Studio — Tales of Pirates

**Editor:** `tests/weapon-editor.html` · **Código:** `tests/weapon-editor.mjs` + `js/weapon-materials.mjs`

## Por que a Dance of Evanescence parece sem textura?

Auditoria executada sobre o **GLB versionado**, não uma suposição baseada na cor da imagem:
```bash
python3 scripts/audit_weapon_materials.py
```

O `assets/equipment/models/lance-crusader.glb` possui **duas espadas** (`slot 6` e `slot 9`), cada uma com **duas submalhas**. As quatro primitivas têm UVs `TEXCOORD_0` e imagens **embutidas**:

- Submalha 0: `01010021.bmp`
- Submalha 1: `1.BMP`

A mesma combinação aparece no `phyllis-crusader.glb`. Logo, **não se trata simplesmente de PNG ausente ou requisição HTTP 404**. As hipóteses ainda em aberto são aparência original do raster, UV inadequado, interpretação de mistura/canal de cor ou falta dos efeitos históricos de arma/refino do DirectX. Não atribuir causa definitiva antes da comparação visual.

## Controles

1. Escolha personagem, classe e espada (slot 6/9).
2. Escolha uma submalha; o painel mostra nome do material, presença de mapa e UVs e prévia da imagem original.
3. Ajuste cor base, rugosidade, metalização, emissive, intensidade e pulsação do brilho. A prévia emissiva **não é** uma reprodução dos efeitos históricos.
4. Para investigar imagens invertidas, marque **Inverter UV vertical**. Isso usa cópia da textura, não altera a UV do arquivo original.
5. **Testar imagem** aceita PNG/JPG/WebP de até 1,25 MB por arquivo. É incorporada ao JSON do perfil, não ao GLB.
6. **Salvar** guarda o perfil em `topweb_weapon_materials_v1` no navegador; **Exportar JSON** produz um arquivo pronto para publicar em `assets/weapons/overrides.json`. O jogo lê ambos, com configurações locais prioritárias.
7. **Restaurar este material** remove a sobrescrita da parte selecionada. As malhas, animações e arquivos GLB originais permanecem inalterados.

O controle de mãos/costas/ocultar já existe no Pose Studio, e também está disponível na prévia do Weapon Material Studio. O material atualizado se aplica às duas posições da arma.

## Estrutura do JSON

```json
{
  "version": 1,
  "profiles": {
    "lance:crusader": {
      "slots": {
        "6": {
          "subsets": {
            "0": {
              "color": "#ffffff",
              "roughness": 0.5,
              "metalness": 0.15,
              "emissive": "#64c8ff",
              "glow": 1.4,
              "pulse": 0.2,
              "pulseSpeed": 2,
              "flipV": false
            }
          }
        }
      }
    }
  }
}
```

O campo opcional `textureData` contém uma imagem PNG/JPG/WebP em data URL; evite criar JSONs excessivamente grandes ao publicar múltiplos materiais.

## Efeitos de refino futuros

**Esta primeira etapa prepara os materiais.** Para efeitos históricos verdadeiros, investigar
as definições `.eff`, `.par`, pontos de attachment e critérios por nível de refino no Client original. O brilho emissivo atual é apenas preview de material: não foi inventado como réplica dos efeitos de +1 a +13.

## Verificação

```bash
node --test tests/weapon-material-studio.test.mjs
node --check tests/weapon-editor.mjs
python3 scripts/audit_weapon_materials.py
```

Os testes automatizados conferem a integridade do GLB e os controles sem simular falsamente que o resultado foi inspecionado visualmente num navegador. Compare a imagem original renderizada com a referência histórica para corrigir cor ou UV.
