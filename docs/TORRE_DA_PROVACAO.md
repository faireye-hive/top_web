# Torre da Provação

## Entrar e jogar

Em Argent, use **Menu → Ir à Arena Administrator** ou caminhe até a NPC.
Toque em **Conversar → Entrar na Torre**. No desktop, use a ação de interação
perto dela (**Espaço** ou **Insert**). O retorno acontece em **2207, 2891**, à frente da NPC.

O mapa é o **teampk original**, com terreno 96 × 96, bloqueios, 295 objetos
estáticos, onze modelos e treze texturas recuperados do Client. A Torre reutiliza
essa arena a cada andar; não gera andares físicos novos.

1. O primeiro andar começa com dois **Forest Spirits**. É o único modelo usado
   neste teste. Eles perseguem e atacam por conta própria.
2. Elimine a horda inteira. Inimigos mortos permanecem mortos naquele andar.
3. Escolha **um dos três atributos** apresentados. Cada escolha dá +3 pontos:
   atributo principal da classe, Constituição ou uma alternativa que muda entre
   os andares. A ação fica pausada enquanto você escolhe.
4. O próximo andar aumenta HP, ataque, defesa e acerto dos inimigos. A quantidade
   aumenta a cada dois andares, até oito monstros simultâneos.
5. Ao subir, você recupera 20% do HP máximo e 30% da mana máxima. Constituição
   também acrescenta 36 HP máximo e três de defesa.
6. Ao morrer, você retorna automaticamente à NPC. **Menu → Encerrar tentativa**
   também permite sair, inclusive na tela de escolha.

Prepare classe e equipamento antes de entrar. A tentativa mantém seu personagem
separado do save permanente: bônus, treino de arma e alterações durante a Torre
não passam para o personagem em Argent. Monstros da Torre não concedem XP.
Uma nova entrada começa no andar 1, sem bônus.

O andar e as escolhas ficam na sessão da aba. Recarregar mantém os bônus e uma
escolha pendente, mas reinicia a horda atual e recupera o personagem. É um
protótipo local, ainda sem placar, recompensas permanentes ou validação no servidor.

## Câmera e mapa de origem

Distância, inclinação, rotação, enquadramento vertical e preferências mobile
continuam compartilhados entre Argent e Arena. O transporte salva a câmera atual
antes da troca de mapa. A posição da Arena nunca sobrescreve a posição de Garner
nem o estado de navegação marítima. Ao retornar, a posição de Garner passa a ser
2207, 2891.

## Balanceamento inicial

Para `n = andar - 1`, cada Forest Spirit tem:

- HP: `42 × (1 + 0,22n + 0,015n²)`.
- Ataque: `7 × (1 + 0,16n + 0,01n²)`.
- Defesa: `1 + 0,55n`, arredondada.
- Acerto: `65 + min(100, 2n)`.
- Velocidade de ataque: `min(1,4; 0,65 + 0,015n)`.
- Quantidade: `min(8; 2 + piso(n / 2))`.

São valores de teste, ajustáveis em `js/arena-state.mjs`. Em Garner, os monstros
continuam pacíficos até serem atacados.

## Reconstruir os recursos originais

O jogo já inclui os arquivos convertidos em `assets/arena/`. Para reconstruí-los,
com Python, NumPy, Pillow e g++ disponíveis:

```bash
python3 scripts/build_arena_map.py /caminho/TalesOfPirateDX9/Client \
  --sources /caminho/TalesOfPirateDX9/sources
```

O exportador lê `map/teampk.map`, `map/teampk.obj`, `model/scene` e `texture/scene`,
usando o leitor LMO de `sources/Engine`. O relatório em
`assets/arena/build-report.json` deve ter `scenery.problemas` vazio.

## Verificação

```bash
node --test tests/*.test.mjs
```

Os testes cobrem a escolha única, escala de hordas, agressividade, ausência de
respawn, bônus temporários, transporte e integridade dos recursos originais.
A verificação no navegador cobre entrada pela NPC, vitória, escolha, novo andar,
recarregamento, derrota, retorno e câmera.
