# Estado da migração

Esta pasta nasceu em 10/10/2026 como cópia de `..\modulo` (QUEDAÇO principal), para separar o criador de personagens num módulo próprio.

- Origem intacta: `E:\RPG\QUEDACO\modulo`
- Backup datado: `E:\RPG\QUEDACO\backup-modulo-v0.12.0-20261010`

## Situação em 17/10/2026

- ID `quedaco-personagens-skyfall-rpg`, título **QUEDAÇO - Personagens Skyfall RPG**, versão 0.1.8.
- O botão **Criar personagem** fica no Diretório de Atores (voltou para lá no commit `bd19d53`; o teste `tests/bootstrap.test.mjs` garante que não há botão no Chat).
- O pacote leva somente o criador e a API de modelos de NPC.
- Limpeza de 17/10/2026: removidos desta pasta o código, os testes, o CSS e os documentos que vieram do QUEDAÇO principal (painel da Mestra, mapas, atlas de cenas, cena ativa, teletransportes, guildas, loja, monstros). Eles nunca iam para o pacote; continuam no repositório principal.
- Falta: conferência no Foundry 13 de uma criação completa com os compêndios reais, num mundo de teste.
