# Mapa do módulo — por funcionalidade

## Modelos e dependências — 0.3.3 (21/10/2026)

`npc-templates.mjs` adia erros de dependência até estabilizar o grafo e seleciona
a façanha correspondente ao estilo. `npc-description.mjs` também espera as
dependências. Capability `npcTemplateResolution` em `main.mjs`. Regressões em
`npc-templates.test.mjs` e `npc-description.test.mjs`. Prévia privada de 37 modelos
com estrutura real passou; criação e recursos derivados ainda requerem Foundry.

## Liberação de jogadores e grupos — 0.3.0 (20/10/2026)

- `src/player-access.mjs`: settings de liberação/restauração, fila de toggle da Mestra, concessão de ACTOR_CREATE para PLAYER/TRUSTED, remoção apenas das concessões próprias; assertCreatorAccess valida toggle e permissão nativa. Padrão desligado.
- `src/main.mjs`: botão da Mestra no Diretório de Atores; oculta entrada do jogador e fecha janela ao desligar. API setPlayerCreationEnabled/isPlayerCreationEnabled e capabilities playerCreationControl/npcProfileSelection. preCreateActor cobre o caminho normal dos drafts do módulo.
- `src/adapter.mjs:createDraft` e `src/app.mjs:start`: checam liberação, inclusive janela aberta antes de desligar. Não alteram ownership de Actors existentes.
- `src/npc-description.mjs`: purposeProfileId explícito valida escopo e impede troca silenciosa do perfil sorteado; sobrenome automático com maior variação em lote.
- `tests/player-access*.test.mjs`: permissões, restauração seletiva, falha parcial, criação/propriedade, botões com DOM simulado. `tests/npc-description.test.mjs`: perfil explícito e rejeição de ausente.
- Fonte primária local: Foundry 13 `client/game.mjs` registra core.permissions/onChange para atualizar game.permissions e sidebar; `common/constants.mjs` define ACTOR_CREATE/defaultRole 3; `common/documents/user.mjs:hasPermission` lê override individual antes do papel. Não é preciso reload para atualizar a permissão nativa.
- Documentação de uso/limites: `docs/RELEASE-0.3.0.md`; contrato de grupos no Cadastro 0.20.0, não neste Criador.

## Descrição e ânima — 0.2.0 (20/10/2026)

`src/npc-description.mjs` expõe catálogo de criação/treinamento e prepara propostas
de NPCs por reconhecimento local de nomes, nível e perfis de propósito/ânima.
Escopos regionais têm precedência. Compila escolhas por grupo/UUID, sem completar
heranças de gnomo com opções não priorizadas. Ausência/ambiguidade vira pendência.
`npc-templates.mjs` valida benefitChoices explícitas e preserva ânima na biografia.
O grafo de benefícios continua em benefits.mjs. A fila persistente é do Cadastro.
Testes: `tests/npc-description.test.mjs`. Leitura do sourcemap local confirmou
BenefitsDialog.addGrant: query seleciona portadores por tipo/identifier, e as
opções feat vêm dos system.feats desses portadores. Esse critério foi reutilizado
por grantOptions, sem criar regra própria de concessão.

## Lotes de NPCs — 0.1.9 (17/10/2026)

`src/npc-templates.mjs`: `prepareNpcBatch` valida até 200 modelos com um catálogo,
gera prévia assinada incluindo dados resolvidos, aponta erros individuais e
conflitos de nomes/IDs. `createNpcBatch` confere assinatura, cria em sequência
pelo mesmo motor individual e vincula relações das fichas novas ao final.
Relatório contém created/existing/errors, results e warnings. Equipe, tags,
origem e contexto ficam na flag npcModel. Somente Mestra; execute em um cliente
da Mestra ativa. `src/main.mjs` publica capacidade npcBatch.
`tests/npc-batch.test.mjs` cobre prévia, assinatura, conflito, criação fictícia,
repetição, relação e falha parcial. O parser humano e a seleção de modelos
pertencem ao Cadastro: `modulo/src/npc-batch-content.mjs` e `npc-models.mjs`.

> Índice para achar onde cada parte mora antes de sair procurando. Atualize sempre que
> criar ou mexer numa área. O sistema por baixo (campos da ficha, tipos de Item) está em
> [REFERENCIA-SKYFALL.md](REFERENCIA-SKYFALL.md).

## Entrada e API

| Peça | Onde |
|---|---|
| Botão **Criar personagem** no Diretório de Atores | [main.mjs: addActorCreatorButton](../src/main.mjs) (hook `renderActorDirectory`) |
| API / protocolo QUEDAÇO v1 (`open`, `getStatus`, modelos de NPC) | `main.mjs`, hook `ready` → `module.api` e `Hooks.callAll('quedaco:register')` |
| Fonte Outfit/Noka | [branding.mjs](../src/branding.mjs) |
| Testes | [bootstrap.test.mjs](../tests/bootstrap.test.mjs) — garante entrada só no Diretório de Atores |

## Criação de personagem (jogador)

| Peça | Onde |
|---|---|
| Interface, navegação, 13 etapas, rascunho | [app.mjs](../src/app.mjs) |
| Catálogo canônico dos compêndios | [catalog.mjs](../src/catalog.mjs), [coverage.mjs](../src/coverage.mjs) |
| Grafo de benefícios/escolhas | [benefits.mjs](../src/benefits.mjs) |
| Marcos de classe 1–12 | [progression.mjs](../src/progression.mjs) |
| Perícias, proteções, idiomas | [training.mjs](../src/training.mjs) |
| Equipamento inicial e compras | [equipment.mjs](../src/equipment.mjs) |
| Regras puras (atributo, vida, dinheiro, capacidade) | [rules.mjs](../src/rules.mjs) |
| Gravação no Foundry (Actor, itens, trilha `path-01/02`) | [adapter.mjs](../src/adapter.mjs) |
| Visual | `styles/creator.css` |
| Testes | `benefits`, `equipment`, `integration`, `path-progression`, `progression`, `rules`, `training` em `tests/` |
| Falta conhecido | [COBERTURA.md](COBERTURA.md), seção "Pendente" |

## Modelos de NPC (15/10/2026)

`src/npc-templates.mjs` resolve modelos com os motores de catálogo, benefícios,
treinamento, progressão e adapter deste criador. `src/main.mjs` publica a capacidade
opcional `npcTemplates` e os métodos de prévia, criação e relações. Não depende do principal.
Identidade do modelo em flag própria evita adotar fichas por nome. Falhas deixam
`needs-review` e não apagam Actors. Testes: `tests/npc-templates.test.mjs` (dados falsos).
Conferir a ficha completa nos compêndios reais do Foundry 13. Contrato:
[MODELOS-DE-NPC.md](MODELOS-DE-NPC.md).

## Empacotamento

### Fluxo e identidade visual (v0.4.0)

- `creator-layout.mjs`: cinco grupos, marca tipográfica e cartões dos três modos.
- `app.mjs`: tela inicial, configuração de jogadores interna, prévia, edição e
  criação de grupos pelo mesmo fluxo manual. Diretório tem somente uma entrada.
- `generation.mjs`: interpretação local, sorteio com escolhas fixas, perfis de
  campanha/ânima, busca de treinamento sem duplicatas e equipamento inicial.
- `styles/quedaco-ui.css` e `docs/IDENTIDADE-VISUAL.md`: padrão reutilizável.
- `styles/creator.css`: composição por container, resumo recolhível e moedas iguais.
- Testes: `generation.test.mjs`, `creator-workflow.test.mjs` e bootstrap.
- `tools/preview.mjs`: harness visual local com dados fictícios e Actor.create
  desativado; `tools/validate-generation.mjs`: prévia somente-leitura de exportação
  privada. Nenhum desses dados/harness é incluído no pacote instalado.

### Pasta dos personagens (v0.3.4)

`player-access.mjs` registra `playerCreationFolder` e resolve a pasta pelo ID.
`main.mjs` apresenta o painel de liberação com seletor de pastas de Atores e
hierarquia. `adapter.createDraft` valida novamente o destino antes de criar a
ficha; `actorSource` mantém None como padrão e Owner para a conta da sessão.
Não migra Actors anteriores nem interfere na criação por modelos de NPC.
Testes: `player-folder.test.mjs`, `player-access.test.mjs` e
`player-access-bootstrap.test.mjs`. Conferência entre contas no Foundry pendente.

`tools/package.mjs` copia uma **lista fixa** de arquivos de `src/`. Arquivo novo precisa
entrar nessa lista. `tools/release.ps1` roda testes, empacota e monta o zip com `/` como
separador (o Foundry em Linux não aceita `\`). `tools/diagnostic-macro.js` é uma macro
somente-leitura que audita os compêndios do Livro Básico.
