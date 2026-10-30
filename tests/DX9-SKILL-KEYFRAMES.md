# Skill FX Studio v6 — keyframes de ações DX9

Fontes verificadas: `CharacterAction.tx`, `characterposeinfo.txt`,
`characterinfo.txt`, `fontes/Client/src/CharacterAction.cpp`,
`fontes/Client/src/CharacterModel.cpp` e `fontes/Client/src/Character.cpp`.

- **Ação e arma:** o SkillInfo indica a ação; o catálogo visual do editor
  registra as ações equipadas; `characterposeinfo.txt` explica as variações
  (fists, sword, 2H, dual swords, firegun, bow e dagger). A coluna `Action ID`
  do characterinfo seleciona o grupo em CharacterAction; personagens
  Lance/Carsise/Phyllis/Ami usam grupos 1/2/3/4, respectivamente.
- **Frames históricos:** em CharacterAction, cada registro contém
  `ação, frame inicial, frame final, frame-chave 0, frame-chave 1, ...`.
  O callback do cliente DX9 `__keyframe_proc` encaminha `key_id` a
  `CCharacter::ActionKeyFrame`, e daí ao estado da skill.
- **Conversão:** na reprodução DirectX, o controle usa velocidade
  `30/fps` (com fps 32 por padrão); duração de referência `(fim-início)/30`.
  Quando o GLB contém o clipe da mesma ação, o editor remapeia o
  frame para `(chave-início)/(fim-início) * clip.duration`.
  Este último é um **remapeamento para a animação convertida**, não
  comprovação de que a exportação GLB preserve todos os eventos do motor.
- **Callbacks:** código -1 significa início, -2 significa fim, 0 ou maior
  é o índice do keyframe de ação correspondente; nunca é timestamp GLB.
- **Edições:** cada skill+personagem pode sobrescrever o tempo de cada
  keyframe individualmente (localStorage), preservando o tempo original e
  permitindo restaurar todos os eventos daquele personagem.
- **Duração da prévia:** ao abrir pela primeira vez a v6, o modo padrão é
  Automático. O campo de duração fica somente leitura e acompanha a
  maior duração conhecida da animação, arquivos PAR/EFF e eventos.
  O modo Manual mantém a duração salva anteriormente e permite ajustá-la.

Cobertura inicial: somente as ações equipadas pelas 26 skills do catálogo
visual e pelos quatro personagens jogáveis. Grupos/ações sem registros
históricos válidos não recebem eventos inventados. Colisão real de projétil,
trajetórias dinâmicas e comportamentos do servidor ainda não são idênticos
à execução DX9.

Validação: `node tools/tests/pose-timing-tests.mjs` e
`node tools/tests/timing-tests.mjs`.
