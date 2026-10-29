# TOP Web — arquitetura e evolução multiplayer

## Regra principal

O cliente **continua jogável sem conta e sem backend**. O renderizador Three.js
recebe estado do mundo; não deve consultar diretamente tabelas Supabase no loop de
renderização. Separe gradualmente `js/main.js` em serviços com responsabilidades
claras:

- `core/`: física, coordenadas, estados de jogador e simulação (determinística).
- `world/`: Garner, terreno, colisões, objetos e streaming de setores.
- `render/`: Three.js, GLBs, partículas, iluminação, câmera.
- `ui/`: HUD, joystick, menus e acessibilidade.
- `network/`: transporte opcional, snapshots, sincronização e reconexão.
- `assets/`: modelos GLB e demais recursos **estáticos**; nunca guardar senhas ali.

Não é necessário mover tudo de uma vez. Os módulos pequenos de câmera e pose são o
primeiro passo; migrar os demais sistemas com testes de regressão.

## Multiplayer em fases

**Fase 1 — Presença:** autenticação opcional e canal por mapa/sala (`garner:1`).
Use Supabase Presence para quem está conectado (identidade e estado *pouco frequente*),
não para atualização de posição a cada frame.

**Fase 2 — Movimento cooperativo:** Supabase Realtime **Broadcast** para snapshots
de posição, direção e animação em intervalo controlado (por exemplo 5–10 Hz),
com interpolação visual entre estados recebidos. Não grave movimentos no Postgres
a cada frame. Cada sala deve ter limites de participantes e de tráfego.

**Fase 3 — Persistência:** perfis, personagem escolhido, itens e último ponto
válido podem residir no Postgres. Vincule cada registro ao `auth.uid()`,
configure GRANT e políticas RLS e teste leitura e gravação entre usuários.
**Nunca** coloque a chave `service_role` ou chave secreta no frontend.

**Fase 4 — Combate/economia:** cliente não pode decidir sozinho dano,
recompensa, teleporte ou inventário. Use lógica autoritativa do lado do servidor
para validar ações e evitar trapaças. Supabase é útil para identidade,
persistência e sinalização; simulação de combate mais complexa pode exigir
servidor dedicado.

## Contrato proposto

```js
// Futuro contrato de transporte; não ativa conexão nem exige credenciais.
transport.connect({ mapId: 'garner', roomId: '1' });
transport.onSnapshot((players) => { /* atualizar entidades remotas */ });
transport.sendInput({ sequence, moveX, moveZ, action });
transport.disconnect();
```

O estado visual deve funcionar com `LocalTransport` sem rede. Quando chegar
a hora, `SupabaseTransport` pode cumprir o mesmo contrato sem reescrever
câmera, GLBs ou a simulação local.

## Câmera, cores e bancos

- Modo de câmera automática acompanha a direção de movimento quando o jogador
  caminha para frente; Q/E ou arrasto suspendem o acompanhamento por 2,5 s.
- Zoom perto reduz a inclinação e aumenta o FOV para aparência de terceira pessoa.
- O modo visual **Clássico (cores vivas)** evita o efeito dessaturado do ACES.
  O modo **Cinemático** continua disponível.
- Banco histórico: o centro do volume define o assento; o lado de entrada
  é preservado para levantar. A direção pode ser invertida no painel se o
  marcador histórico tiver orientação contrária.

## Verificações

Rode `node --test tests/*.test.mjs` para testar as funções de câmera/pose.
Para controles e colisão integrados, abra `/?selftest` no navegador. Teste
especialmente escadas, bancos de diferentes orientações, zoom mínimo e celular.
