# Estado da migração

## Situação em 10/10/2026

- A cópia de trabalho tem o ID `quedaco-personagens-skyfall-rpg` e o título **QUEDAÇO - Personagens Skyfall RPG**.
- A inicialização abre somente o criador e registra **Criar personagem** no topo do Chat. Não há registro no Diretório de Atores, controles de cena ou ficha de NPC.
- O pacote gerado inclui somente os arquivos do criador e seus dados de regras; painel de campanha, mapas, teletransportes, NPCs e guildas ficam fora dele.
- `npm test` executa 49 testes da criação; `npm run package` monta o pacote de desenvolvimento.
- Falta a validação visual no Foundry 13 com os dois módulos instalados: conferir o botão no Chat e criar uma ficha descartável. O QUEDAÇO principal e o backup seguem intactos.

Esta pasta nasceu em 10/10/2026 como cópia de `..\modulo`.

- Origem intacta: `E:\RPG\QUEDACO\modulo`
- Backup datado: `E:\RPG\QUEDACO\backup-modulo-v0.12.0-20261010`
- Destino de toda alteração do Criador: esta pasta

Não instale esta cópia no Foundry enquanto o ID e o bootstrap ainda forem iguais aos do QUEDAÇO. A próxima etapa substitui o bootstrap por um módulo de personagens isolado, com ID próprio e botão no topo do Chat.
