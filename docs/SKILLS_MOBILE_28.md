# Skills e combate mobile em Argent

Sete classes, quatro slots fixos por classe, 28 slots e 26 habilidades únicas.
Os ícones, poses, cores e texturas vêm do cliente antigo; os atributos,
alcances, custos, recargas e estados são regras novas do protótipo.

## Controles em tela deitada

- O joystick mantém a orientação da câmera. Arrastar o cenário gira com
  sensibilidade proporcional à largura da tela, suavização e limite de
  1,1 rad/s. O acompanhamento automático anterior fica no computador.
- Informações de combate ficam à esquerda, abaixo de Herói. Avisos breves
  ficam junto aos controles esquerdos, liberando o centro do personagem.
- Toque diretamente num monstro ou pressione **Alvo** para percorrer os
  monstros visíveis por distância, até 30 m. A seleção fica marcada no chão.
- **Auto** encontra o alvo mais próximo e ataca no alcance da arma. O mesmo
  botão continua virando interação perto de um NPC.
- Uma skill ofensiva usa o alvo selecionado; sem seleção, procura o visível
  mais próximo. Se necessário, anda até o alcance e lança. Mover manualmente
  ou abrir um menu interrompe a ação. Mana e recarga já consumidas permanecem.
- Os atalhos mostram a recarga e ficam indisponíveis sem mana suficiente.
  Cura e buffs funcionam no próprio personagem, sem exigir alvo.

| Classe equipada | Arma | Alcance básico |
| --- | --- | --- |
| Crusader | Duas espadas | 2,2 m |
| Champion | Espada grande | 2,8 m |
| Sharpshooter | Pistola | 18 m |
| Hunter | Arco | 20 m |
| Cleric / Seal Master | Cajado | 14 m |
| Voyager | Adaga | 2,2 m |

Sem conjunto, o ataque básico usa punhos a 2,2 m. As skills têm alcance
próprio em `js/skill-rules.mjs`; os valores aparecem em Herói → Skills.
A linha de visão verifica terreno e objetos; a aproximação conserva colisão.
Somente golpes básicos válidos treinam a prática da arma.

## Poses e armas

Os 14 visuais equipados usam roupas/armas do tier 55 liberados no nível 1,
incluindo Lance/Phyllis Hunter com arco. A conversão prende a arma ao dummy
da mão e remove o conteúdo após o terminador NUL dos nomes de ossos LAB.
Esse reparo permite que as poses suplementares encontrem o esqueleto equipado.

As ações extras são carregadas somente para o personagem atual:

| Personagem | Ações extras | Tamanho |
| --- | --- | --- |
| Lance | 10 | 852.888 bytes |
| Carsise | 1 | 90.644 bytes |
| Phyllis | 11 | 1.057.716 bytes |
| Ami | 3 | 392.184 bytes |

Ami também precisa do suplemento: o GLB equipado possui um banco de arma
menor que o modelo base. Conch Ray em Ami/Phyllis usa a ação base real 013,
pois a ação de adaga 067 não tem quadros para essas personagens. Nenhuma
skill de arco/pistola usa um golpe de arma incompatível como alternativa.
Red Thunder Cannon encadeia 223 → 224 → 225.

## Efeitos leves e limites de fidelidade

`build_skill_visuals.py` lê PAR/EFF e recupera camadas, cores, escalas,
offsets e quadros UV. O runtime usa 93 texturas PNG originais, limitadas a
256 px, somando 2.054.258 bytes; só aquece as texturas da classe atual.
Até oito camadas por skill e 64 elementos ativos evitam picos sem limite.
Seis malhas originais (flechas, pé e volumes de vento) compartilham um GLB de
23.344 bytes. Geometrias pequenas compartilhadas representam cilindros, cones e esferas.

As trajetórias, distribuição de partículas, posicionamento de impactos e
algumas malhas especiais são **aproximados**. `visuals.json` identifica três
formas que ainda não têm reprodução exata (Cylinder, Cone e sphere02.lgo). Isto não é uma migração
integral do renderizador OpenGL: permanecem diferenças de volume, mistura,
tempo e densidade dos efeitos. Silêncio fica registrado nos monstros, mas
os três monstros de treino ainda não possuem habilidades mágicas para interromper.

## Reconstrução e validação

```bash
python3 scripts/build_evanescence.py /caminho/Client
python3 scripts/build_skill_visuals.py /caminho/Client
python3 scripts/verify_mobile_assets.py
python3 scripts/verify_skill_assets.py
node --test --test-isolation=none tests/*.test.mjs
```

São 38 testes de regras e controles. O verificador de assets confere os
14 GLBs equipados, quatro suplementos, referências de texturas, limites e
compatibilidade dos nomes de todos os ossos usados pelas ações extras.

A página `tests/skill-gallery.html` usa os mesmos modelos, resolução de ações
e renderizador de efeitos do jogo. Permite trocar classe/personagem,
reproduzir ou escolher um instante para comparar as quatro skills juntas.
Ela não altera o save do jogador. Use também o jogo para conferir a seleção,
o alcance real e a recarga; a galeria não simula dano ou colisão.

## Conferência realizada nesta atualização

- Navegador em 852 × 393: quatro poses de cada uma das sete classes e
  Ami Voyager/Cleric; capturas dos efeitos em 1,00 s.
- Após regenerar equipamentos: nenhum aviso de osso ausente na galeria.
- No jogo: Hunter equipado com Bow of Evanescence, botão Alvo selecionando
  monstro, ataque básico à distância e Meteor Shower consumindo 20 MP
  e exibindo 10 s de recarga. Personagem visível no centro.
- A fidelidade é parcial conforme os limites acima; não foi medido FPS
  num aparelho físico nem comparado vídeo a vídeo com o cliente antigo.
