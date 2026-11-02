# Editor de terreno e vegetação

Abra **Menu → Editor de terreno e vegetação**. A edição acontece no próprio
cenário, com os prédios, árvores e demais objetos visíveis. Também é possível
abrir `?terrainEditor=1`; `&spawn=2218.5,2776.5` escolhe o ponto inicial.
O editor funciona em terra firme no mapa de Garner.

1. Ative **Pincel ativo**, escolha **Pintar chão** e uma das 49 texturas.
   Clique ou arraste no cenário. O círculo mostra o alcance do pincel.
   **Conta-gotas de chão** seleciona a textura existente no ponto clicado.
2. Ajuste **Suavidade das bordas** para a mistura de solos naturais no mapa
   inteiro. O padrão é 0,32 m; zero mostra bordas secas. Grama, terra, areia,
   neve e rocha se misturam. Calçadas e pisos mantêm os recortes definidos.
3. Escolha **Plantar grama alta**, ajuste altura, densidade e cor, e pinte
   perto dos pés de árvores, pedras e construções. Os ajustes valem para os
   próximos traços; repinte uma área para mudar a grama que já está nela.
   A vegetação tem volume, variação de direção e balanço leve de vento.
4. Use **Remover grama** para limpar caminhos. **Restaurar área original**
   remove todas as edições visuais locais nos quadrados alcançados.
5. **Desfazer** e **Refazer** guardam até 40 operações, agrupando cada arrasto.
   **Prévia original** mostra o terreno sem edições e sem mistura; também
   pode ser desfeita.

Botão direito arrasta a câmera; roda aproxima e afasta. Desative o pincel
para usar o clique normal do jogo ou girar a câmera por toque. WASD continua
movendo o personagem fora dos campos do painel. Feche o editor para retomar
o combate. O pincel atua no terreno sob os objetos, sem selecionar ou mover
os próprios modelos.

## Salvar e publicar

As alterações aparecem imediatamente como prévia. **Salvar no navegador**
guarda o projeto neste endereço e dispositivo. **Exportar projeto** baixa
`terrain-design.json`, incluindo a prévia atual mesmo antes de salvar.
**Importar projeto** substitui a prévia por esse arquivo, com possibilidade
de desfazer; salve para mantê-lo após recarregar. Exporte uma cópia antes de
limpar os dados do navegador.

Para publicar para todos, substitua `assets/terrain/design.json` pelo arquivo
exportado e envie ao repositório. Esse arquivo define o padrão do jogo.
Um projeto salvo no navegador tem prioridade sobre o padrão publicado;
importe o projeto publicado e salve para substituir a cópia local.

O projeto aceita até 20.000 quadrados alterados e arquivos de até 5 MB.
Texturas personalizadas continuam no **Editor de texturas do mundo** e usam
seu próprio pacote (`assets/textures/overrides.json`).

## Escopo e desempenho

Este é um editor visual: não muda alturas, colisões, navegação, regiões nem
posições dos assets. A grama só é criada em terra carregada, inclusive em
quadrados bloqueados junto aos objetos, nunca no mar. Escolha com o pincel
onde ela deve aparecer para evitar atravessar pisos e modelos.

A transição usa as texturas vizinhas do formato GNR1 atual, inclusive entre
setores. Não recupera as camadas secundárias do `.map` histórico. A grama é
geometria agrupada, sem downloads de imagens ou modelos adicionais, com
limite de 512 tufos por chunk no desktop e 192 no celular. Some gradualmente
entre 28 e 48 m; áreas muito densas usam uma amostra espacial estável para
respeitar esses limites.
