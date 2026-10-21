# API opcional de modelos de NPC

**Correção 0.3.1 (21/10/2026):** modelos e descrições resolvem trilhas antes
de recusar talentos dependentes. A façanha inicial acompanha o estilo de combate.
A capacidade `npcTemplateResolution: true` permite ao Cadastro 0.20.1 detectar
o motor corrigido. Não há mudança no formato do modelo nem dependência obrigatória.

**Atualização 0.2.0 (20/10/2026):** a API `prepareNpcDescription` recebe pedidos
narrativos e perfis de propósito/ânima do Cadastro. Ela gera modelos com
benefitChoices explícitas, ou pendências. A API antiga de modelos completos
continua aceitando modelos já resolvidos. Guia: [RELEASE-0.2.0.md](RELEASE-0.2.0.md).

## Lotes — 0.1.9

Capacidade `npcBatch: true`. `prepareNpcBatch({name,npcs})` recebe modelos
completos com IDs próprios, devolve rows/errors, contagens e signature sem gravar.
`createNpcBatch({name,npcs}, {expectedSignature})` exige prévia atual. Até 200
NPCs. A assinatura inclui os dados dos compêndios resolvidos. Erros da prévia
impedem iniciar. Falhas posteriores são reportadas por NPC e o restante continua.
Ficha parcial permanece needs-review e precisa de revisão, sem recriação.
Fichas existentes são devolvidas sem alteração. Relações de fichas recém-criadas
são vinculadas ao final. Sem Atomic rollback: o relatório identifica o que ficou.

Descrição, contexto, equipe (teamId), tags e módulo de origem (sourceModule)
acompanham o modelo. O Actor é character e fica privado à Mestra. A API aceita
objeto ou JSON; documento humano QUEDACO-NPCS 1 é interpretado pelo Cadastro
QUEDAÇO 0.18.6. O guia consultável está em
`game.modules.get('quedaco').api.getNpcBatchInstructions()` e em
`E:/RPG/QUEDACO/modulo/docs/LOTES-DE-NPCS.md`.

O Criador anuncia `family: 'quedaco'`, `contractVersion: 1` e
`capabilities.npcTemplates: true`. Não depende do módulo principal.

`prepareNpcTemplate(model)` resolve o conteúdo dos compêndios autorizados e retorna
assinatura, escolhas, carga, capacidade, inventário, classe e nível, sem criar documentos.
`createNpcFromTemplate(model, {expectedSignature})` exige a assinatura da prévia atual.
Usa o mesmo motor de benefícios, treinamento, progressão, itens e vida do Criador.
O uniforme é aparência da campanha sobre item nativo, sem bônus mecânico inventado.

O modelo usa ID estável, nome, nível 1–12, legado, herança, classe, antecedente, seis
modificadores de atributo, dinheiro inteiro em Trocados e inventário com nomes exatos
dos compêndios. Pode trazer maldição, trilha, conjuração, prioridades de escolhas,
aparência, vestuário, comportamento, voz, rotina, objetivo, receio, segredo, gancho,
tática, pertences e relações. A ausência/ambiguidade de item ou escolha incompatível
impede a criação na preparação. Nenhum código de pacote é executado.

O ID fica em `flags.quedaco-personagens-skyfall-rpg.npcModel`. Actor já criado é
devolvido como `existing`, sem atualização. Nome coincidente sem esse ID não é adotado.
Falha depois de criar deixa a ficha `needs-review`; o erro informa UUID e não apaga a
ficha. Execute em uma sessão da Mestra; a fila cobre concorrência no mesmo cliente.

`refreshNpcTemplateRelations(model)` vincula IDs de modelos a UUIDs de Actors e altera
apenas a lista marcada `data-npc-model-relations="true"` da biografia. Preserva o resto
da biografia e não altera Actors com dono jogador. Remover a lista desliga a atualização.

Implementação: `src/npc-templates.mjs`; publicação da API: `src/main.mjs`.
Testes com dados falsos: `tests/npc-templates.test.mjs`. A criação completa, inventário,
recursos derivados e comportamento de ficha precisam de conferência no Foundry 13
com Skyfall 1.0.1 e os compêndios reais. Nenhum Actor oficial foi criado nesta mudança.
