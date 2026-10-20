# 0.2.0 — motor local de criação por descrição

API `prepareNpcDescription(request, {context, profiles})` e
`getNpcCreationCatalog()`, capacidade npcDescription. O Cadastro 0.19.0 guarda
pedidos privados, envia contexto/perfis e consome propostas ou pendências.

O motor lê os compêndios, identifica legado, nível e propósito, considera perfis
regionais e de ânima, resolve benefícios e guarda escolhas explícitas por UUID.
Ânima não mapeada, opções insuficientes, conteúdo ausente e ambiguidades bloqueiam
a proposta. Perfis de animais são propostas de campanha, não regra oficial fixa.
O motor é local, baseado em vocabulário/perfis; não é uma IA geral embutida.

Guia: `E:/RPG/QUEDACO/modulo/docs/MOTOR-NPCS-POR-DESCRICAO.md`.
Diagnóstico de alimentação: `modulo/docs/DIAGNOSTICO-NUTRICAO-NPCS.md`.
Testes com documentos simulados e interface em navegador; sem criação de Actor
oficial. Ainda requer conferência no Foundry com os compêndios reais.
