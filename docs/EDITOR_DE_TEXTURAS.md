# Ateliê de Texturas

Abra **Menu → Editor de texturas do mundo** ou `tests/texture-editor.html`.
O atalho do Menu abre a textura do chão sob o personagem. O editor funciona
com mouse ou toque; no celular, os atalhos inferiores levam à biblioteca,
prévia, ajustes e salvamento.

## Editar e testar

1. Escolha uma categoria e uma imagem. A biblioteca contém 49 texturas de
   terreno e 990 imagens dos modelos e efeitos publicados no jogo.
2. Confira resolução, formato, tamanho e arquivo de origem no painel de
   diagnóstico. Use zoom e **Ver pixels sem suavizar** para avaliar a fonte.
   No terreno, compare também com o atlas JPEG anterior.
3. Ajuste brilho, contraste, saturação e nitidez; use pincel/borracha ou importe
   PNG, JPEG ou WebP. A borracha apaga a pintura sobreposta. A transparência
   da imagem é preservada. A resolução de saída mantém a proporção e tem
   limite de 2.048 pixels por lado.
4. A prévia 3D mostra a imagem repetida sobre um plano, sem as cores dos
   vértices e a iluminação específicas do mapa. Imagens de modelos continuam
   sendo atlas 2D; seus recortes devem manter os encaixes originais.
5. **Salvar no jogo** grava a edição no navegador e atualiza o jogo aberto
   no mesmo endereço. Confira a aparência no modelo real. **Restaurar textura
   original** remove a substituição local daquela imagem.

O original no repositório é preservado. Nada é aplicado ao jogo apenas por
mover um controle ou trocar de textura. Rascunhos são mantidos enquanto esta
página permanece aberta. O botão de salvar também aplica os ajustes de
qualidade selecionados. Texturas compartilhadas por várias partes de um
modelo ou instâncias mudam em todas elas, como no material original.

**Baixar edição PNG** exporta a imagem atual. **Exportar pacote** leva apenas
edições já salvas, junto com a qualidade. **Importar pacote** adiciona ou
substitui os itens presentes no pacote, preservando as outras edições locais.
Os pacotes aceitam até 256 imagens e 96 MiB de dados; cada substituição tem
até 24 MiB. Endereços externos e caminhos fora de `assets/` são rejeitados.

## Por que a grama e a terra pareciam ruins

- Muitas imagens históricas têm 256 × 256 pixels; algumas têm 128 ou 32.
  Ampliar uma imagem sozinha não cria detalhes novos.
- Cada textura de terreno se repete a cada quatro metros. No atlas padrão,
  há 252 pixels úteis por repetição, aproximadamente 63 pixels por metro.
- O atlas JPEG anterior adicionava perdas à imagem original. O novo atlas
  WebP sem perdas foi reconstruído das imagens do cliente histórico.
- Havia um erro nos encaixes: o último vértice de cada repetição voltava ao
  início da textura dentro do mesmo quadrado. A correção mantém os quatro
  cantos contínuos e elimina esse esticamento periódico.
- As bordas quadradas entre tipos de chão também dependem das camadas de
  transição do mapa original. O formato GNR1 atual carrega a textura base;
  o **Editor de terreno e vegetação** agora mistura os solos naturais vizinhos e permite pintar o mapa e grama alta ([guia](EDITOR_DE_TERRENO.md)). Essa mistura visual não recupera as camadas secundárias do arquivo histórico.

O atlas padrão continua com 2.048 × 2.048 pixels, cerca de 21 MiB na GPU com
mipmaps. O WebP ocupa aproximadamente 6 MB para baixar, contra 1,7 MB do JPEG
anterior, que permanece disponível como opção de download menor.

O modo de 512 pixels por textura monta um atlas de 4.096 × 4.096, cerca de
85 MiB na GPU. Serve para imagens novas com detalhe adicional; não recupera
informação ausente nas imagens antigas. O jogo respeita o limite de textura
da GPU e limita a filtragem anisotrópica a 4× no celular. O padrão permanece
em 256 pixels por textura e 4×.

## Dados e publicação

O catálogo está em `assets/textures/catalog.json`; as imagens recuperadas em
`assets/textures/terrain/`, e o atlas em `assets/textures/terrain-atlas.webp`.
IDs usam `terrain:9`, `image:assets/caminho.png` ou
`glb:assets/caminho.glb#2` (índice da imagem embutida, não do material).

O jogo lê `assets/textures/overrides.json` como pacote publicado, e as
substituições locais do IndexedDB `topweb_textures_v1` têm prioridade. Esse
arquivo começa vazio. Para publicar uma seleção para todos, exporte o pacote,
revise as imagens e substitua esse JSON no repositório antes do merge. As
edições locais do navegador não são enviadas automaticamente ao GitHub.

Para reindexar os arquivos publicados:

```bash
python3 scripts/build_texture_catalog.py
```

Para reconstruir também as imagens originais e o atlas, instale Pillow e use:

```bash
python3 scripts/build_texture_catalog.py --client /caminho/TalesOfPirateDX9/Client
```

O gerador recupera o cabeçalho dos BMP/DDS históricos marcados com `mp.x`,
consulta `referencias/terraininfo.txt` e extrai metadados das imagens GLB.
A biblioteca exclui ícones de interface e mapas de visão geral.

## Modelos 3D

Para mudar a forma de personagens, NPCs e monstros, o caminho indicado é
importar/exportar GLB no Blender, preservando ossos, pesos, UVs, escala e nomes
das animações. O editor atual cuida das imagens; não altera as malhas.
Veja a documentação oficial do [importador/exportador glTF do Blender](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst).

## Validação

`node --test tests/*.test.mjs` cobre os encaixes UV nos limites das repetições,
padding do atlas HD, catálogo real e extração de imagem GLB, processamento
de pixels/transparência, pacotes e aplicação/restauração de materiais.
O combate testa alvos que saem do alcance depois do início do ataque, inclusive
habilidades e canhões, garantindo um único impacto e mantendo os cancelamentos
por morte, retorno e obstáculos.
