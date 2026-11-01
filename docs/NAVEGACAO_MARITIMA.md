# Navegação marítima mobile

Abra **Menu → Ir ao porto de Argent**. No cais, o botão grande passa a
**Embarcar**. Toque nele para usar o Guppy; o joystick, WASD, câmera e toque
no mar controlam a embarcação. Ao chegar perto de uma margem livre, o mesmo
botão mostra **Desembarcar**. O menu também oferece esse comando.

O casco e a textura são os originais do Guppy (`2004000000.lgo`), convertidos
para um GLB de aproximadamente 144 KiB. A velocidade de 4,5 m/s e a altura
de −0,1 m vêm de `shipinfo.txt`, `shipiteminfo.txt` e `characterinfo.txt`.
Corrida não acelera o barco. O personagem e a sombra ficam ocultos no mar.

A navegação consulta a máscara LAND e os quatro subtiles de bloqueio do
mapa, conforme `MapFile::sailableAt` do cliente C++. Não depende da altura
do fundo. O casco verifica espaço ao redor e o movimento continua dividido
em passos de até 20 cm, impedindo atravessar terra e sair do recorte.
Embarque e desembarque procuram posições próximas com passagem livre,
respeitando os volumes sólidos e a altura do cais. Desembarcar exige terra
ou ponte livre, inclusive com “Ignorar bloqueios” ativado.

Combate terrestre e skills ficam suspensos enquanto o jogador navega.
Posição e modo são salvos em `topweb_sea_travel_v1` a cada cinco segundos e
ao sair da página. Na reabertura, o barco só é restaurado em água válida.
O último local em terra continua separado. **Voltar a Argent City** e o
minimapa mantêm o teletransporte para terra como saída de emergência.

A área disponível é o recorte mobile de Argent, de 512 × 512 tiles.
Esta entrega não inclui combate naval, combustível, comércio ou outros
mapas. O visual utiliza o casco original, sem novos componentes de barco.

Para reconstruir o asset a partir do cliente:

```bash
python3 scripts/build_mobile_boat.py /caminho/Client
```

O exportador requer NumPy e Pillow, já usados pelos conversores existentes.
Validação automática:

```bash
node --test tests/*.test.mjs
```

`tests/sea-navigation.test.mjs` cobre máscaras e bloqueios, espaço do casco,
transferências, retomada, o GLB e uma ida e volta no terreno real do porto.
