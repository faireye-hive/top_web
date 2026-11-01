# HUD desktop

O desktop usa uma composição inspirada no cliente clássico, com o centro livre
para o mundo. Molduras, retrato, barras e ícones são desenhados em HTML, CSS e
SVG, sem novas imagens de interface.

- **Acima à esquerda:** retrato, nível, nome, classe, HP e mana reais. Clique no
  retrato para abrir os atributos. O alvo aparece abaixo somente quando necessário.
- **Acima à direita:** minimapa quadrado, região e coordenadas. Clique no mapa
  ou no botão de expansão para abrir o mapa completo.
- **Abaixo à esquerda:** registro dos avisos e eventos reais de combate. Mantém
  até 50 mensagens nesta sessão; clique no título para recolher. É um registro
  local, sem chat multiplayer.
- **Abaixo ao centro:** quatro ações, quatro habilidades da classe e a barra de
  experiência. Os mesmos cooldowns, custos de mana e bloqueios continuam ativos.
- **Abaixo à direita:** Herói, Bolsa, Skills, Mapa e Menu. As configurações ficam
  em um painel recolhido, com rolagem. Abrir o Menu pausa o combate e o movimento.

## Atalhos

| Tecla | Ação |
| --- | --- |
| WASD | Mover |
| Shift | Correr enquanto se move |
| Q / E ou botão direito e arrasto | Girar a câmera |
| Espaço | Ataque ou interação contextual |
| F | Ligar ou desligar ataque automático |
| T | Alternar alvo |
| X | Parar o ataque e descansar |
| 1–4 | Habilidades da classe |
| C | Atributos do personagem |
| B | Bolsa |
| K | Habilidades |
| M | Mapa completo |
| Esc | Fechar o painel atual; fora dos painéis, abrir/fechar configurações |
| Insert | Interagir com NPC, banco ou parede próxima |

Os atalhos extras ficam desativados no mobile, enquanto você digita, em diálogos
da Arena e durante animações que bloqueiam ações. Botões mantêm foco visível,
nomes acessíveis e dicas com o atalho correspondente.

## Preservação do mobile

`desktop-hud.css` aplica seus ajustes somente em `body:not(.mobile-ui)`. Elementos
novos ficam ocultos no mobile; a barra de habilidades existente é reutilizada.
Nenhum arquivo de estilo ou controle mobile foi modificado. O jogo continua usando
os mesmos critérios de tela e ponteiro para escolher entre os modos.

Em janelas desktop menores, registro e menus sobem um pouco para deixar os oito
atalhos sem sobreposição. O redimensionamento para mobile fecha o Menu desktop.
Preferências de câmera, Bolsa, personagens e equipamentos continuam compartilhadas.

## Verificação

Foram conferidos os layouts desktop em 1920×1080, 1440×900, 1280×720, 1024×768 e
820×640; navegação por teclado, combate, Menu, atributos, Bolsa, skills, mapa,
redimensionamento e entrada na Arena. O mobile foi comparado antes e depois em
852×393 e 393×852, incluindo Menu e Bolsa, sem diferenças de geometria e estilos
nos controles existentes.

As regras de gameplay continuam cobertas por:

```bash
node --test tests/*.test.mjs
```
