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

## Correção confirmada da Dance of Evanescence — camada 1.BMP (01/11/2026)

A investigação do `Client/model/item/01010021.lgo` **original** encontrou
dois materiais distintos:

| Subset | Imagem | Faces | Valor no LGO | Renderização histórica |
|---|---|---:|---:|---|
| 0 | `01010021.bmp` | 156 | `blend=0` | Superfície principal, vermelha |
| 1 | `1.BMP` | 90 | `blend=1` | Passagem aditiva `SRC_ALPHA,ONE` |

A textura `1.BMP` não é a pintura da espada. É uma **camada adicional**
de 32×32 px, azul, que foi convertida incorretamente como material PBR
opaco por `Lance/converter.py`. Isso cobria visualmente a textura
vermelha de 128×128 px, embora o GLB tivesse ambos os mapas corretos.

A nova versão do conversor conserva `extras.topOriginalBlend=1` e
`extras.topLayer='additive-overlay'` para exportações futuras.
No GLB publicado anterior, `js/weapon-materials.mjs` identifica essa
camada por nome de material **somente para a combinação conhecida**
`01010021.lgo · 1.BMP`. Aplica `THREE.AdditiveBlending` com
`depthWrite=false` e **deixa a camada desligada por padrão** até
termos o gatilho histórico de refino. Assim a espada principal
`01010021.bmp` volta a aparecer em vermelho.

No Weapon Material Studio, selecione **Parte 2 · 1.BMP** para ajustar
`Exibir camada aditiva azul` e a intensidade. A escolha é salva como
`overlayVisible` / `overlayOpacity` por espada e por submalha;
uma configuração explícita também vale no jogo e nas cópias guardadas
nas costas. O Pose Studio usa a mesma correção visual.
**Isto não reproduz ainda os níveis históricos de refino**, apenas
respeita a existência de duas passagens de renderização diferentes.

Reproduzir o caso:

```sh
node --test tests/weapon-material-studio.test.mjs
python3 scripts/audit_weapon_materials.py
```
