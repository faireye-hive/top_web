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

## Câmera do barco

Ao embarcar, o botão **Atrás 3D** alterna entre três vistas:

- **Atrás 3D:** deslocada para o lado, com altura e distância ajustadas ao
  tamanho real do casco e dos mastros, olhando para a rota à frente.
- **Proa 3D:** posicionada à frente do casco para navegar sem as velas
  cobrindo o caminho. Ao selecionar, olha para a direção do barco.
- **Vista alta:** mantém a visão geral anterior.

O botão **↑** volta a olhar para a frente do barco. Arrastar gira a câmera;
pinça/roda ajusta a distância na vista atrás e o campo de visão na proa.
No computador, **V** alterna as vistas. A seleção também está em **Menu →
Câmera do barco** e fica salva neste navegador. Em terra, a câmera anterior
continua sendo usada.

## Monitor de desenvolvimento

O painel **DEV** inicia ligado em localhost. Em qualquer hospedagem,
`?debug=1` o liga e `?debug=0` o desliga para aquele carregamento. Também é
possível alternar em **Menu → Monitor de desenvolvimento**. Toque no cabeçalho
para expandir, arraste para reposicionar e use **Ocultar monitor** para parar
a coleta. Os dados são atualizados aproximadamente a cada segundo:

- FPS e tempo real entre quadros, incluindo o pior intervalo da amostra.
- Tempo de trabalho JavaScript/renderização medido na aplicação, em ms por
  quadro; não corresponde ao percentual de CPU do navegador.
- Tempo de GPU em ms, quando a extensão WebGL estiver disponível. Consultas
  são assíncronas e amostras inválidas são descartadas conforme a
  [especificação Khronos](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).
- Heap JavaScript usado/alocado, quando fornecido pelo navegador. É uma
  estimativa legada, não a memória total da aba ou do navegador; veja
  [Performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory).
- Memória dos dados de terreno, setores carregados, chamadas de desenho,
  triângulos, contagens de geometrias/texturas, objetos, efeitos e espuma,
  além da resolução real e da escala de renderização.

Medições indisponíveis aparecem como **N/D**. Contagens de texturas e
geometrias não medem VRAM total; percentuais de CPU/GPU não são estimados.
Ao ocultar a aba, a amostragem é reiniciada para excluir o tempo em segundo
plano. O painel usa os recursos já carregados e não baixa outros assets.

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
Também verificam o referencial das câmeras, espaço livre à frente da proa,
intervalos reais de quadros e consultas assíncronas de GPU.
Os recursos visuais e os controles dos editores também devem ser conferidos
em navegador; o desempenho final depende do aparelho.
