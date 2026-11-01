# Ataque normal e ataque automático

O TOP Web possui dois modos de ataque básico **independentes**.

## Ataque normal (botão Atacar, Espaço, botão contextual no mobile)

1. Selecione um monstro clicando nele ou use o botão de alvo (T / Alvo).
2. Pressione **Atacar uma vez**.
3. Se estiver até 30 unidades mas fora do alcance da arma, o personagem se aproxima usando o mesmo caminho de aproximação já empregado no combate.
4. Quando entrar no alcance, ataca repetidamente na cadência normal, reproduzindo os clipes existentes e aplicando dano/treino após o impacto.
5. **Ao derrotar o monstro, para**. Não seleciona outro monstro, mesmo que haja outros vivos perto.
6. Se outro monstro for selecionado, a sequência anterior termina e é necessário tocar Atacar novamente.

O ataque normal também termina ao mover o personagem manualmente, clicar para caminhar, abrir menus que suspendam combate, perder o alvo/visão, morrer ou executar uma interrupção explícita. O alvo escolhido pode permanecer marcado depois de parar, mas não causa dano automaticamente.

## Ataque automático (Auto)

O pequeno botão Auto do mobile escolhe o modo do botão principal; **não ataca ao ser selecionado**. Quando o Auto é iniciado, o personagem procura um alvo válido e segue atacando até derrotá-lo. Então seleciona o próximo monstro disponível dentro do raio e continua enquanto o Auto estiver ligado. **Não há alternância para o modo manual ao matar uma vítima.**

Movimentar manualmente o personagem, selecionar um destino para caminhar, abrir um menu de pausa/recuperação, teletransportar ou desligar o Auto encerra a automação. Estar em postura de combate na área exterior, por si só, não liga o ataque automático.

### Diferença de estado na implementação

No `js/combat-state.mjs`:
- `combat.auto`: ataque contínuo **com** troca automática de alvos.
- `combat.manualActive`: ataque contínuo **sem** troca automática de alvos.
- `combat.target`: seleção visual; possuir alvo **não** significa que está atacando.
- `combat.approach`: pedido de aproximação do alvo durante qualquer modo, respeitando alcance e interrupções.

O `js/main.js` exibe o estado manual ativo no HUD, cancela ambos os modos durante deslocamento voluntário e mantém os controles de desktop/mobile separados.

### Testes

```sh
node --test tests/combat-state.test.mjs tests/mobile-auto-mode.test.mjs
```

Verificam sequência de golpes após um único comando, parada no primeiro abate, continuidade do Auto para outro monstro, deslocamento e alcance, seleção sem ataque, cancelamentos e integração com os controles mobile.
