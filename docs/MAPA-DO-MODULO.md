# Mapa do módulo — por funcionalidade

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

`tools/package.mjs` copia uma **lista fixa** de arquivos de `src/`. Arquivo novo precisa
entrar nessa lista. `tools/release.ps1` roda testes, empacota e monta o zip com `/` como
separador (o Foundry em Linux não aceita `\`). `tools/diagnostic-macro.js` é uma macro
somente-leitura que audita os compêndios do Livro Básico.
