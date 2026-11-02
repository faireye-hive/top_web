# NPCs, itens, drops, missões e comércio

Abra **Menu → Ir à Senna · missão de exemplo**, aproxime-se e use **Conversar**.
Aceite **Primeiros suprimentos de Argent**: derrote 3 **Forest Spirits**, obtenha
2 méis das **Mini Bees** e entregue a missão à **Innkeeper Marriam**. Receba
40 ouro, 80 XP reais do herói e 1 Vale de suprimentos. A missão só pode ser
concluída uma vez. **Menu → Diário de missões** mostra objetivos, recompensas,
nomes e coordenadas dos NPCs de início e entrega.

**Grocery Jimberry**, em **2232, 2729**, demonstra compra, venda e troca.
Ele vende mel por 8 ouro, compra materiais pelo `sellPrice` do item e troca
3 sementes por 1 mel. O drop de sementes e mel está em 100% para facilitar
o primeiro teste; altere `chance` para mudar isso.

## Onde editar

Todos os arquivos usam JSON comum: aspas duplas, sem comentários e sem vírgula
depois do último campo. Cada arquivo abaixo contém uma lista (`[...]`), exceto
o manifesto dos NPCs, que contém a lista `npcs` e os metadados do mapa.

| Arquivo | O que configura |
| --- | --- |
| `assets/npcs/manifest.json` | ID individual, nome, modelo, X, Z e rotação de cada NPC |
| `assets/content/items.json` | ID, nome, descrição, símbolo, categoria e preço de venda dos itens |
| `assets/content/drops.json` | Itens que cada espécie de monstro pode deixar |
| `assets/content/quests.json` | Objetivos, NPC inicial/final, pré-requisitos e recompensas |
| `assets/content/npc-services.json` | Diálogo, compras, vendas e trocas vinculados ao ID do NPC |
| `assets/monsters/manifest.json` | Catálogo das 129 espécies originais e seus nascimentos |

## IDs permanentes

O NPC **Senna** usa `garner-npc-21`, **Marriam** usa `garner-npc-10`, **Jimberry**
usa `garner-npc-18` e o administrador da Torre usa `garner-npc-52`.
Todos os 14 NPCs originais têm seu próprio `id`. O exportador histórico mantém
esse ID ao reconstruir a lista. Ao duplicar um NPC pelo editor, ele recebe um
ID novo `npc-...`, sem herdar a identidade especial do administrador da Torre.

`characterId` identifica o visual histórico; não identifica um NPC individual.
NPCs podem usar o mesmo modelo e continuar com missões e lojas diferentes.
Conserve o `id` ao mover, renomear ou girar um NPC para preservar suas ligações.

Monstros usam o ID compartilhado da espécie: **Forest Spirit** é `original-103`,
**Mini Bee** é `original-206`. O editor tem um catálogo no seletor
com nome e ID de todas as espécies. Cada ator de combate conserva seu `id`
interno de instância e expõe `speciesId` para missões e drops.

## Criar itens

Adicione um registro à lista de `items.json`:

```json
{
  "id": "minha-concha",
  "name": "Concha azul",
  "kind": "material",
  "symbol": "◆",
  "description": "Uma concha usada em missões e trocas.",
  "sellPrice": 5
}
```

`id` deve ser único. Use letras, números e hífen, sem espaços. `kind` pode ser
`material`, `quest` ou `consumable`; essas categorias organizam a Bolsa. Os itens
criados aqui são objetos de inventário, coleta e comércio. Não aplicam cura,
bônus de equipamento ou visuais automaticamente. `sellPrice: 0` impede a venda
do item aos NPCs. O preço para comprar do NPC é configurado na loja.

## Definir drops por espécie

Adicione uma espécie a `drops.json`, ou edite o registro dela se já existir:

```json
{
  "speciesId": "original-206",
  "items": [
    { "itemId": "minha-concha", "chance": 0.35, "min": 1, "max": 2 }
  ]
}
```

Todos os monstros dessa espécie, em qualquer região de Garner, usam a mesma
tabela. Cada entrada tem seu sorteio independente: `0.35` = 35%, `1` = 100%,
`0` = nunca. A quantidade é sorteada entre `min` e `max`, inclusive. A morte
efetiva no combate concede o item diretamente à Bolsa e mostra o resultado
no registro. Abates terrestres e navais seguem a mesma regra; a Torre da
Provação não gera esses drops nem avança as missões de Garner.

## Criar uma missão

Duplique a missão de exemplo em `quests.json`, dê outro `id` e ajuste:

```json
{
  "id": "conchas-de-argent",
  "name": "Conchas para Marriam",
  "description": "Senna pede ajuda. Derrote Forest Spirits e leve conchas a Marriam.",
  "startNpcId": "garner-npc-21",
  "endNpcId": "garner-npc-10",
  "minimumLevel": 1,
  "requires": [],
  "objectives": [
    { "id": "matar", "type": "kill", "speciesId": "original-103", "quantity": 3 },
    { "id": "coletar", "type": "collect", "itemId": "minha-concha", "quantity": 2 }
  ],
  "rewards": {
    "gold": 25,
    "xp": 60,
    "items": [{ "itemId": "supply-token", "quantity": 1 }]
  }
}
```

Publique primeiro o item e o drop dos exemplos anteriores. `kill` só conta
abates depois que você aceita a missão. `collect` confere a quantidade atual
na Bolsa; materiais obtidos antes da aceitação, comprados ou trocados também
servem. Se quiser exigir uma origem específica, crie um item exclusivo e coloque
o drop somente na espécie desejada. A entrega consome os itens pedidos.
Vender, trocar ou entregar os mesmos materiais em outra missão pode deixar um
objetivo incompleto. Objetivos de abate não são perdidos.

Pode haver vários objetivos de abate e de coleta. Cada objetivo precisa de um
`id` único dentro da missão; agrupe a quantidade de um mesmo item em um único
objetivo. `startNpcId` e `endNpcId` podem ser iguais ou diferentes.
`requires: ["argent-first-supplies"]` exige concluir a primeira missão antes
de aceitar esta. Referências inválidas, IDs repetidos e ciclos são rejeitados.
Mantenha os IDs de missões e objetivos ao editar progresso já salvo; use novos
IDs para aventuras independentes. Não há missões repetíveis nesta versão.

## Colocar loja, compra e troca em qualquer NPC

Adicione um registro em `npc-services.json` com o `npcId` escolhido:

```json
{
  "npcId": "garner-npc-7",
  "dialogue": "Bem-vindo! Tenho conchas e aceito materiais.",
  "buysItems": true,
  "shop": [{ "itemId": "minha-concha", "quantity": 1, "price": 12 }],
  "trades": [
    {
      "id": "conchas-por-vale",
      "name": "2 conchas por um vale",
      "goldCost": 0,
      "cost": [{ "itemId": "minha-concha", "quantity": 2 }],
      "reward": [{ "itemId": "supply-token", "quantity": 1 }]
    }
  ]
}
```

`shop` é o que o NPC vende ao jogador: preço total pelo pacote `quantity`.
`buysItems` permite ao jogador vender uma unidade por clique, pelo `sellPrice`.
`trades` pode exigir vários itens e ouro e entregar vários itens. Sem recursos
suficientes, a operação inteira é recusada. Lojas têm estoque ilimitado.
Use listas vazias para desativar loja/trocas e `buysItems: false` para desativar
compras do NPC. O mesmo NPC pode oferecer missões e comércio juntos.

## Editar dentro do jogo

1. Abra **Menu → Editor de NPCs, itens e missões**, em terra firme de Garner.
2. Escolha o NPC. Ajuste nome, modelo, X, Z e rotação em graus e aplique. As
   coordenadas correspondem às exibidas no mapa; `yaw` conserva a orientação
   histórica (`rotação 3D = 180° − yaw`).
3. Use **Usar posição do herói**, ou **Escolher ponto no chão** e clique no
   cenário. O destino precisa ser terra firme livre e carregada. Para um ponto
   distante, feche o editor, viaje até lá e reabra.
4. **Duplicar com ID novo** cria outro NPC na posição do herói. Ele não herda
   missões nem comércio; associe-os ao novo ID nos campos ou JSON.
5. Selecione Missões, Itens, Drops ou Serviços para editar o JSON. **Adicionar
   exemplo editável** ajuda a iniciar um registro. Os rascunhos de cada seção
   ficam preservados ao alternar entre seções; **Validar e aplicar JSON** confere
   todas elas antes de mudar a prévia.
6. Em **Criar missão com campos**, escolha título, NPC inicial/final, espécie,
   quantidade, item, ouro e XP. O botão cria um ID e aplica a missão. Edite o
   texto e os demais objetivos pelo JSON se quiser.
7. **Salvar no navegador** mantém o projeto para as próximas aberturas.
   **Exportar projeto JSON** baixa `adventure-project.json` com tudo.
   **Importar projeto JSON** recupera esse projeto em outro navegador.

O combate e o movimento ficam pausados durante a edição e os diálogos. O botão
direito e a roda ainda permitem observar o cenário no editor. A prévia não
publica mudanças. **Restaurar prévia publicada** volta aos arquivos do
repositório; salve no navegador para substituir também seu projeto local.
Um projeto local salvo tem prioridade sobre os arquivos publicados. Se ele
ficar inválido, o jogo informa o erro e abre o conteúdo publicado.

## Publicar um projeto exportado

Na pasta do repositório, valide primeiro:

```bash
node scripts/publish-adventure-project.mjs /caminho/adventure-project.json --check
```

Para atualizar os quatro arquivos em `assets/content/` e a lista de NPCs:

```bash
node scripts/publish-adventure-project.mjs /caminho/adventure-project.json
node --test tests/*.test.mjs
```

Revise o diff e envie os arquivos pelo fluxo normal do GitHub. O comando
preserva os metadados do manifesto dos NPCs e confere os modelos antes de
escrever. Novos modelos GLB precisam existir em `assets/npcs/models/`.
Os testes das regras usam exemplos independentes: você pode editar o conteúdo
publicado sem alterar esses testes. A validação também confere suas novas referências.

## Persistência e limites atuais

O jogo continua local, sem servidor: ouro, materiais e missões ficam no
`localStorage` (`topweb_adventure_v1`), compartilhados pelas classes deste
navegador, como o restante da aventura. O projeto do editor usa outra chave
(`topweb_content_project_v1`). O XP de recompensas usa a progressão existente
do herói. Limpar os dados do navegador apaga esse progresso. Exporte o projeto
para guardar suas configurações; ele não contém o progresso do jogador.

O editor está disponível para testes locais; não fornece permissões GM nem
economia autoritativa de multiplayer. Para multiplayer, validações de missão,
drop, ouro e comércio deverão ser executadas no servidor.
