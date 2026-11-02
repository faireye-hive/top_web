# Editor de terreno, caminhos e vegetação

Abra **Menu → Editor de terreno e vegetação**. Edite no cenário real, com os
objetos visíveis. O editor funciona em terra firme em Garner. Projetos da
primeira versão continuam abrindo, incluindo texturas e grama salvas.

## Detalhes e caminhos

**Pintar detalhes do chão** e **Desenhar caminhos** criam traços contínuos,
sem prender o pincel aos quadrados de 1 m do mapa. O raio vai de **3 cm a
8 m**, com controle numérico e atalhos de 3, 10 e 25 cm ou 1 m. O círculo
mostra o raio real; o diâmetro define a largura do traço. Use a roda para
aproximar a câmera ao pintar detalhes pequenos.

Escolha uma textura, ajuste a **Suavidade** da borda e a **Intensidade** e
arraste no cenário. Em **Aplicar suavidade**, escolha **Todos os lados**,
**Sem suavidade**, **Em cima · fim do traço**, **Embaixo · início do traço**,
**Mais na esquerda** ou **Mais na direita**. Cima e baixo correspondem às
pontas final e inicial; esquerda e direita acompanham a direção do desenho.
As bordas não selecionadas permanecem definidas. Os ajustes valem para os
próximos traços. Caminhos oferecem atalhos de terra, areia e pedra e removem
a grama no espaço pintado. Não alteram as colisões: desenhar sobre uma área
bloqueada não a transforma em passagem. Os caminhos desenhados aparecem também no minimapa e no mapa completo, em cores simplificadas.

**Conta-gotas de chão** identifica tanto a textura base como os traços
pintados. **Apagar traço inteiro** remove o traço tocado por completo;
**Desfazer** recupera a operação. **Restaurar quadrado original · 1 m**
continua removendo as edições antigas do quadrado, sem apagar novos traços.

## Suavizar mais e escolher a borda

A mistura geral agora usa nove amostras vizinhas e suaviza também a coloração
do terreno, reduzindo os recortes quadrados. Abra **Suavidade geral do mapa**
para ajustar até **1 m**; zero mantém a borda seca. O novo padrão é 0,55 m.
O valor de projetos já salvos é preservado. Pisos e calçadas mantêm o recorte.

Para um ajuste localizado, escolha **Suavizar uma borda do mapa**, selecione
norte, sul, leste, oeste ou todas, ajuste a suavidade local e pinte. O desenho
no chão mostra a borda do quadrado selecionada. A orientação usa os eixos do
mapa, independentemente da rotação da câmera. Esse ajuste usa os cantos
compartilhados do terreno: afeta a área próxima à borda sem abrir costuras
entre quadrados. A suavidade local tem prioridade sobre a geral. A pintura
fina e os caminhos têm sua própria suavidade, independente desse ajuste.

## Grama e objetos

**Plantar grama alta** também usa o raio fino. Ajuste altura, densidade e cor;
repinte para mudar a aparência. **Remover grama** limpa somente a região do
traço. A grama aparece em terra carregada, inclusive junto a quadrados
bloqueados de árvores e construções, nunca no mar. Tufos pequenos podem ter
folhas que se estendem além do ponto onde foram plantados.

Em **Selecionar objeto do cenário**, passe o cursor sobre um objeto para ver
nome, arquivo, ID e posição, com uma caixa destacando aquela instância.
Clique para fixar a seleção. **Abrir textura deste objeto** abre o Ateliê de
Texturas na imagem do material atingido, sem precisar adivinhar o nome.
**Soltar seleção** volta à identificação ao passar o cursor. Objetos com
vários materiais podem abrir imagens diferentes conforme a parte clicada.
Editar uma textura compartilhada altera todas as instâncias que a utilizam.
A seleção identifica o asset; não move nem remodela o objeto.

Botão direito gira a câmera; roda aproxima e afasta. Desative o pincel para
usar a navegação normal por clique ou toque. WASD move o personagem fora
dos campos do painel. Feche o editor para retomar o combate.

## Salvar, publicar e limites

**Desfazer** e **Refazer** guardam até 40 operações; um arrasto conta como uma
operação. **Salvar no navegador** guarda o projeto neste endereço e
aparelho. **Exportar projeto** baixa a prévia atual como `terrain-design.json`,
incluindo caminhos, bordas e grama. **Importar projeto** substitui a prévia,
com possibilidade de desfazer; salve para mantê-la após recarregar.

Para publicar para todos, substitua `assets/terrain/design.json` pelo arquivo
exportado e envie ao repositório. O projeto salvo no navegador tem prioridade
sobre esse padrão. As texturas personalizadas usam o pacote separado do
Ateliê de Texturas (`assets/textures/overrides.json`).

Limites: 20.000 quadrados legados/cantos editados, 2.000 traços, 4.096 pontos
por traço, 100.000 pontos por projeto e arquivos importados de até 8 MB.
Solte o pincel para começar outro traço ao atingir o limite por gesto. A
pintura usa no máximo 100.000 triângulos por chunk. A grama mantém o limite
de 512 tufos por chunk no desktop e 192 no celular, com redução entre 28 e
48 m. Áreas muito densas usam uma amostra estável para respeitar esse limite.

A edição é visual: preserva alturas, bloqueios, regiões, navegação e posições
dos modelos. A mistura usa o terreno GNR1 atual; não recupera as camadas
secundárias nem os caminhos ausentes do `.map` histórico automaticamente.
