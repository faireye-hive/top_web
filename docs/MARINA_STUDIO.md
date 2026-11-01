# Garner original e Marina Studio

O jogo agora usa **Garner original, de 4096 × 4096 tiles**, com o terreno,
posicionamentos e biblioteca de cenário já existentes no projeto. O mapa
expandido oferece zoom, arrasto e seleção de destinos. O botão **Garner
inteiro** retorna à visão do continente e suas ilhas. Outros mapas do TOP
(como Darkblue e os mapas de masmorras) não fazem parte desta entrega.

O terreno é carregado em setores de 256 × 256, com limite de 24 setores em
memória (aproximadamente 10,5 MiB de dados de terreno). O teste inicial em
Argent carregou nove setores, aproximadamente 4 MiB. Um setor ainda não
baixado bloqueia o movimento; ele nunca é tratado como oceano livre.

## Água e veleiro

O mar tem duas ondas sobrepostas, pequenas ondulações irregulares, reflexo
aproximado do céu e do sol, transparência e espuma junto à costa. São
simulações visuais leves, sem reflexão por captura adicional da cena.

O barco padrão é o casco **Phantom Galley original**, com escala 3,5×,
aproximadamente **12,2 m de comprimento**, e dois mastros com velas novas e
animadas. Há balanço suave e um rastro de espuma que aparece apenas quando
a embarcação realmente se move. O movimento físico permanece na altura
marítima; a ondulação afeta somente o visual.

O espaço de colisão acompanha o tamanho escolhido. Barcos maiores precisam
de mais água livre; o embarque procura espaço mais longe do cais. O Guppy
original continua selecionável no editor. Não há combustível ou combate
naval nesta versão.

## Editores

Abra **Menu → Editor de mapa e barco**, ou `tests/marine-editor.html`.

**Editor de barco:** prévia 3D com controles para casco, escala de 0,75× a
5×, velocidade, cor do casco e das velas, mastros, espuma, balanço, ondas e
reflexos do mar. Arraste a prévia para girar e use pinça/roda para aproximar.

**Editor de mapa:** visão de Garner com zoom e arrasto. Aproxime para pintar
água ou terra, ajustar elevação, bloquear/liberar passagem ou restaurar
terreno. Cada traço pode ser desfeito e refeito. O editor altera o terreno
e a colisão; não move nem remove casas, NPCs ou objetos de cenário.

**Salvar no jogo** grava o projeto neste navegador, em
`topweb_marine_design_v1`; as alterações são lidas no próximo carregamento.
**Salvar e testar no centro da vista** abre o jogo no ponto escolhido, em
terra ou em um barco quando houver água suficiente para o casco.

**Exportar** gera `marina-garner.json`, com barco, água e patches de terreno.
**Importar** valida o arquivo antes de substituir a prévia. A versão atual
aceita até 50.000 tiles editados, sem modificar os assets originais. Limpar
os dados do navegador remove o projeto local: exporte para guardar uma
cópia. Publicar configurações para todos os jogadores é uma etapa separada.

## Reconstrução e validação

```bash
python3 scripts/build_garner_stream.py
python3 scripts/build_mobile_boat.py /caminho/Client --all
node --test tests/*.test.mjs
```

O primeiro comando gera os 256 setores e a imagem geral a partir de
`assets/region.gmap.gz`. O segundo exporta os dois cascos e as texturas
originais. Requerem NumPy e Pillow, já usados pelos conversores existentes.

Os testes verificam os 256 setores, equivalência com o terreno de Argent,
limite de memória, carregamento compartilhado e nova tentativa após erro,
validação de projetos, pintura/restauração e espaço para o veleiro grande.
Os recursos visuais e os controles dos editores também devem ser conferidos
em navegador; o desempenho final depende do aparelho.
