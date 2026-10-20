# 0.3.0 — liberação de jogadores e grupos por perfil

Preparado em 20/10/2026, para Foundry 13 / Skyfall 1.0.1. Pacote local;
não instalado ou publicado por esta entrega. Nenhum Actor oficial foi alterado.

## Liga/desliga dos jogadores

No Diretório de Atores, a Mestra vê **Jogadores: criação desligada/ligada**.
O padrão é desligado. Um clique alterna a liberação do Criador para todos os
jogadores; a Mestra mantém sua entrada. Não altera proprietários ou fichas
já existentes. Ao desligar, fecha o Criador aberto nos clientes dos jogadores,
preserva o rascunho local e bloqueia a conclusão pelo caminho do módulo.

Ligar concede ACTOR_CREATE aos papéis PLAYER e TRUSTED na configuração nativa
do Foundry; isso também permite a criação normal de Atores enquanto concedido.
O módulo guarda quais papéis acrescentou. Desligar remove apenas essas concessões,
preservando as permissões anteriores e todas as outras capacidades. Se já havia
ACTOR_CREATE, o usuário continua podendo criar pelo Foundry mesmo com o Criador
fechado. Não é uma proibição global do mundo nem uma trava de segurança de
scripts arbitrários; o servidor aplica a permissão nativa.

Overrides individuais de permissão e acesso aos compêndios não são alterados:
um jogador explicitamente impedido pode precisar de revisão pela Mestra.
Se alguém editar as permissões enquanto o toggle estiver ligado, reconfira-as
ao desligar; a API não identifica a intenção de concessões simultâneas iguais.
Usar a sessão da Mestra ativa e uma operação por vez.

API sem cliques:

```js
const api = game.modules.get('quedaco-personagens-skyfall-rpg').api;
await api.setPlayerCreationEnabled(true); // false para desligar
api.isPlayerCreationEnabled();
```

World settings privados de configuração: allowPlayerCreation (Boolean),
playerCreationGrantedRoles (Array). Não contém fichas nem conteúdo narrativo.
Registro em init; atualização dos botões/fechamento em onChange. Abertura,
CreatorApp.start, createDraft e preCreateActor normal validam a liberação.

## Grupos do Cadastro

Nova capability `npcProfileSelection` permite que o Cadastro 0.20.0 fixe
purposeProfileId explicitamente. O motor valida existência/disponibilidade/escopo
em vez de trocar o perfil sorteado por outro com palavras parecidas. O Cadastro
exige essa capability para planejar grupos, evitando incompatibilidade com 0.2.0.
Nomes automáticos têm maior espaço de variação para lotes. Nomes explicitamente
informados continuam preservados; duplicações são pendências no Cadastro.

O fluxo completo por texto/JSON está em
`E:/RPG/QUEDACO/modulo/docs/GRUPOS-NPCS-PARA-IA.md` e pode ser consultado em
`game.modules.get('quedaco').api.getNpcBatchInstructions().populationEngine`.

## Validação e limites

Testes automatizados cobrem a liberação, restauração seletiva, falha parcial,
bloqueio na criação, propriedade do jogador e atualização dos botões, com
documentos/DOM simulados. Ainda falta conferir uma criação completa com usuário
jogador e compêndios reais na mesa. COBERTURA.md continua definindo os limites
de regras, sobretudo escolhas descritas apenas em prosa e níveis 2–12.

Referência primária local de Foundry 13: core game.mjs registra core.permissions
com onChange que atualiza game.permissions e renderiza sidebar/controles.
common/constants.mjs define ACTOR_CREATE com defaultRole ASSISTANT (3).
User.hasPermission prioriza override individual e depois a lista do papel.
