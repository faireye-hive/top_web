# TOP Web — Pose & Weapon Studio (MVP)

Abra `/tests/pose-editor.html` a partir da mesma origem HTTPS/localhost do
jogo, ou clique em **⚔ Editor de poses e armas** em Configurações.

## Problema corrigido nesta etapa

Os conjuntos Evanescence já foram convertidos por
`scripts/build_evanescence.py` como modelos GLB **com armas rigidamente
skinnadas ao osso da mão**. O jogo reproduzia somente essa geometria e
sempre usava `Parado` na exploração, então a arma continuava nas mãos na
cidade. A postura de guarda/corrida armada também não fazia parte de todos
os GLBs exportados.

Agora o jogo mantém o GLB original e, fora de combate:

1. Reconhece as partes `Parte N · weapon`, sem alterar roupas ou corpo.
2. Separa uma **cópia estática da geometria** transformada para o espaço
   local do osso de origem e centralizada para ajuste.
3. Prende a cópia a um osso editável (costas/coluna para espadas, arcos e
   cajados; quadril para pistola/espadão, conforme aproximação inicial).
4. Oculta apenas o mesh original da arma enquanto ela está guardada.
5. Durante ataque, skill ou Auto, restaura a arma animada na mão e esconde
   a cópia guardada. O AnimationMixer continua usando o GLB original.

As posições iniciais são **aproximações editáveis**, NÃO offsets históricos
comprovados dos dummies de guarda. A correspondência exata por tipo de
arma ainda necessita verificar os dummies originais e testar em browser.

## Ferramentas do editor

- Selecione **Lance, Carsise, Phyllis ou Ami**, classe e equipamento.
- Modos: **Cidade/descanso, Guarda, Corrida, Corrida armada, Ataque**.
- Selecione um clipe de animação que realmente esteja presente no GLB,
  reproduza/pare, navegue pela timeline, mude velocidade e visualize
  ossos/esqueleto. O editor avisa quando a animação histórica está ausente.
- Para **cada arma** separadamente, selecione osso, posição XYZ (em
  metros), rotação XYZ (graus) e escala. Presets Costas, Cintura, Padrão.
- **Guardar armas fora do combate** controla a visibilidade nos estados
  Cidade e Corrida; no modo Guarda/Ataque/Corrida armada a arma original
  permanece na mão.

### Salvar e publicar

1. Clique **Salvar no navegador**: grava `topweb_pose_profiles_v1` em
   `localStorage`, compartilhado com `index.html` **se estiverem na mesma
   origem**. Recarregue o jogo para testar; isso não publica no GitHub.
2. Clique **Exportar JSON**. O arquivo baixado deve se chamar
   `overrides.json`.
3. Substitua o arquivo versionado `assets/poses/overrides.json` no
   repositório e publique. Quem não tem configuração local receberá
   os ajustes do arquivo.
4. **Importar JSON** permite continuar uma edição anterior ou testar
   outro preset. Os clipes selecionados são nomes exatos dos GLBs:
   perfis de outra versão podem exigir remapeamento.

Estrutura do JSON:

```json
{
  "version": 1,
  "profiles": {
    "lance:crusader": {
      "clips": {
        "idle": "163 · Parado",
        "guard": "166 · Combate",
        "run": "167 · Correr",
        "armedRun": "168 · Correr armado",
        "attack": "169 · Ataque 1"
      },
      "stowOnIdle": true,
      "weapons": {
        "weapon-0": {
          "bone": "Osso 13 · Bip01 Spine1",
          "position": [0.1, 0, 0.1],
          "rotation": [0, 0, 40],
          "scale": 1
        }
      }
    }
  }
}
```

**Atenção:** os nomes e ossos nesse exemplo são ilustrativos; escolha
nomes disponíveis nos seus arquivos convertidos. Se um clipe não estiver
presente, o jogo usará o fallback existente. O editor **não reconstrói
keyframes binários**, nem publica arquivos automaticamente no GitHub.

## Fidelidade histórica e animações ausentes

`characterposeinfo.txt` tem colunas para Punhos, Espada, Espadão, Duas
Espadas, Pistola, Arco e Adaga, e separa Normal Wait, Guard Waiting,
Normal Run, Guarded Run e três ataques básicos. O conversor anterior
exportava apenas ações 1, 5 e 7 (além de skills e uma pose social) em
cada banco de arma.

O script `scripts/build_evanescence.py` agora seleciona também as ações
4, 6, 8, 9 e 10 da tabela histórica, **para a próxima regeneração**:

```bash
python3 scripts/build_evanescence.py /caminho/Client
node --test tests/pose-studio.test.mjs
```

Este comando exige os arquivos originais `Client/` contendo LAB, LGO,
texturas e tabelas. **Os modelos binários atuais no GitHub NÃO foram
automaticamente regenerados.** Por isso, algumas opções de Guarda e
Corrida armada ainda podem mostrar fallback de Parado/Correr no editor.

## Limitações e próximos testes

- Ajustar posições de todas as armas/classes, especialmente espadas duplas.
- Conferir que o mesh convertido seja rígido em um único osso. Se uma arma
  futura usar vários ossos, o estúdio não cria cópia estática: mantém o mesh
  original, evitando deformar a geometria.
- Validar estados Cidade, Corrida, Guarda, Ataque e Skills em todos os
  personagens, e associar dummies de costa/cintura históricos.
- A seleção de clipes afeta Parado, Correr e Ataque 1 no jogo atual; a
  implementação de estados adicionais (p. ex. pular, nadar) não foi criada.
- O navegador não tem acesso de escrita ao repositório; a exportação JSON
  precisa ser enviada/commitada via GitHub.

