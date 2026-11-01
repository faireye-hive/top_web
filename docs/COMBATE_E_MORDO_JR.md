# Combate, rotas e Mordo Jr

Os monstros do treino de Argent patrulham os pontos de `assets/monsters/manifest.json`.
Selecionar um alvo não o torna hostil. Quando recebe um ataque básico ou habilidade,
o monstro persegue o jogador, prepara seu golpe e aplica dano no impacto, se o
jogador continuar no alcance e sem um obstáculo entre os dois. É possível se
afastar durante a preparação para evitar o impacto.

As rotas usam o terreno e a colisão do cenário; uma busca local contorna obstáculos.
Lentidão reduz a velocidade e atordoamento impede deslocamento e ataque. A mais de
34 m da origem, a perseguição termina, a vida é restaurada e o monstro caminha de
volta. Monstros em retorno não podem ser atacados. Após morrer, a animação de morte
é exibida, e o reaparecimento ocorre na origem após 12 segundos, sem estados ou
ataques pendentes. Menus e navegação marítima pausam o combate.

Mordo Jr é o companheiro visual padrão de todos os personagens, inclusive saves
existentes, sem compra ou seleção adicional. Permanece com o jogador na troca de
classe, personagem, teleporte e navegação. O voo e a aura usam os controladores
PAR/EFF originais: item 681, efeito 526 e `fjlxiao1.par`. O pet é visual e não
acrescenta atributos ou dano.

Para regenerar seus recursos a partir do Client original:

```bash
python3 -B scripts/build_default_pet.py /caminho/Client
```

O exportador publica a malha transformada em GLB, as três texturas e o manifesto
com a trajetória original de 101 pontos por sistema. O jogo percorre o voo em loop
pela distância dos segmentos, preserva as cores e tamanhos e reproduz os efeitos
com o mesmo renderizador das skills. O pet acompanha o deslocamento suavemente,
salta junto em teleportes distantes e pausa com os menus.

Validação automatizada: `node --test tests/*.test.mjs`. Os testes de combate
cobrem retaliação, preparação, alcance, visão, atordoamento, pausa e respawn;
os de navegação verificam patrulha, desvio de paredes e retorno; os de pet verificam
o pacote publicado, trajetória contínua, acompanhamento e teleporte.
