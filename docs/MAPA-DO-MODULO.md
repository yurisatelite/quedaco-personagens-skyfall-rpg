# Mapa do módulo — por funcionalidade

## Modelos de NPC (15/10/2026)

`src/npc-templates.mjs` resolve modelos com os motores de catálogo, benefícios,
treinamento, progressão e adapter deste Criador. `src/main.mjs` publica capacidade
opcional `npcTemplates` e métodos de prévia, criação e relações. Não depende do principal.
Identidade do modelo em flag própria evita adotar fichas por nome. Falhas deixam
`needs-review` e não apagam Actors. Testes: `tests/npc-templates.test.mjs` (dados falsos).
Conferir a ficha completa nos compêndios reais do Foundry 13. Contrato:
[MODELOS-DE-NPC.md](MODELOS-DE-NPC.md).

> Escopo ativo: [Foco da campanha — Thur Thur](FOCO-THURTHUR.md). O filtro reversível mora em `src/campaign-focus.mjs` e usa o setting `campaignFocus`.

> Índice pra achar rápido onde uma funcionalidade mora, antes de sair grepando
> `src/library.mjs` (arquivo grande, tudo passa por ele). Cada linha diz: o que é, os
> arquivos e funções principais, os testes que cobrem, e se falta algo conhecido.
>
> **Atualize esta tabela sempre que criar ou mexer numa área** — é o que faz o próximo
> pedido ("melhorar a loja", "mexer nas guildas"...) começar direto na implementação, sem
> perder uma rodada só relendo o código. Ver também `docs/PROGRESSO-MAPA-IMERSIVO.md` (a
> versão "por etapas" disto, pra uma funcionalidade grande em andamento) e
> `docs/REFERENCIA-SKYFALL.md` (o sistema por baixo, não o módulo).

## Loja / Vendas · exemplo completo

**O que é:** o Mestre marca um NPC como vendedor; jogadores compram do estoque dele
(carrinho, tudo-ou-nada) e vendem itens da própria ficha para qualquer NPC, com desconto
por atitude, condições do livro e pechincha.

| Peça | Onde |
|---|---|
| Preço nas 3 moedas | [rules.mjs:precoFormatado](../src/rules.mjs) |
| Cotação (compra/venda, atitude, condições, pechincha) | [negotiation.mjs:quote,sellQuote](../src/negotiation.mjs) |
| Compra/venda de verdade no Actor (débito, estoque, entrega) | [adapter.mjs:purchaseItem,purchaseCart,sellItem](../src/adapter.mjs) |
| Tela: abrir loja, montar carrinho, cartão do NPC vendedor | [library.mjs: openShop, cartFor, shopLineQuote, cartBlock, npcSellCard, npcGmStrip, coinNote](../src/library.mjs) (linha ~1146) |
| Ops de tela (`CampaignLibrary.action`) | `lib-cart-*` (4), mais os que abrem a ficha/loja |
| Visual | `styles/library.css` — bloco do cartão de item, carrinho, tira do GM |
| Testes | [adapter.test.mjs](../tests/adapter.test.mjs), [negotiation.test.mjs](../tests/negotiation.test.mjs) — compra debita e reduz estoque, insuficiente não altera nada, falha na entrega devolve a moeda, carrinho é tudo-ou-nada, venda paga metade do livro e credita a bolsa, venda parcial, quantidade maior que a ficha recusa |
| Doc original do pedido | `docs/T17-VENDINHAS-FASE2.md` |
| Falta conhecido | nenhum nesta rodada — foi a última coisa fechada antes da 0.8.0. Se for melhorar, comece lendo a tabela de condições de desconto do livro em `negotiation.mjs` antes de mudar a conta. |

**Pra melhorar a loja amanhã:** já dá pra abrir direto `negotiation.mjs` (a conta) e
`library.mjs` na linha 1146 (a tela) sem precisar re-explorar nada.

## NPCs

| Peça | Onde |
|---|---|
| Flag do NPC (papel, local, loja, forja) | [npcs.mjs](../src/npcs.mjs) — `flags.quedaco.npc` |
| Inferir região/local pela pasta ou pelo texto | `npcs.mjs: inferRegionId, inferPlaceId, regionIdFromFolderPath` |
| Cobertura regional (arquétipos esperados x existentes) | `npcs.mjs: npcCoverage` — **a exibição na tela some na tarefa 8** |
| Cartão de NPC na tela | `library.mjs: npcCard` (aba NPCs, e reaproveitado em `npcsForLocation`) |
| Geração de NPC novo | macro `.local/Skyfall-Criador-de-Conteudo.js` (fora do git) |
| Falta conhecido | nada pendente aqui — o painel da cena ativa (T6) já reaproveita `npcsForLocation`; ver `docs/PROGRESSO-MAPA-IMERSIVO.md` |

## Guildas e Hansas

| Peça | Onde |
|---|---|
| Dados de guilda, membros, nível, proteção da mesa | [guilds.mjs](../src/guilds.mjs) — `guildMembers, guildLevel, guildProtectionReasons, planGuildRedistribution` |
| Selo (P.I.P.I. e afins) | [seal-style.mjs](../src/seal-style.mjs) |
| Tela: abas Em jogo/Guardadas, filtro por guilda | `library.mjs: renderGuilds` |
| Redistribuir pela interface (T4) | `library.mjs: redistributeGuildMembers` — **feito, não commitado ainda em 17/09** |
| Macro (antes da T4 existir na tela) | `.local/guildas-em-jogo.js` |
| Testes | [guilds.test.mjs](../tests/guilds.test.mjs) — cobre os casos de proteção da P.I.P.I. |

## Mapa Imersivo (mapa, atlas de cenas, teletransporte, cena ativa)

Nome dado pelo Yuri em 17/09/2026. Funcionalidade grande, em andamento — tem doc próprio
de progresso, não repita aqui: **[PROGRESSO-MAPA-IMERSIVO.md](PROGRESSO-MAPA-IMERSIVO.md)**.
Atalho pra achar código (22/09/2026):

| Peça | Onde |
|---|---|
| Dado puro do atlas (hierarquia, arestas, posição das caixas) | [scene-atlas.mjs](../src/scene-atlas.mjs) — `buildSceneAtlasTree`, `resolveSceneLocality`; `atlas.layout[regionId]['place:x'|'scene:y'|'region:z']={x,y}` em pixels, gravado por `setAtlasLayoutPosition` |
| Quebra-cabeça por região (arranjo inicial, linhas, portais pra fora) | `scene-atlas.mjs: buildRegionPuzzle` (dado) → `panels/mapa-imersivo.mjs` (tela) → `app.mjs: _bindPuzzle` (arrastar caixa = grava posição; arrastar cena da bandeja pra uma caixa = `dropAtlasScene`) |
| Banco de mapas e seleção visual | [map-bank.mjs](../src/map-bank.mjs) (fontes, 48 recomendações, saídas planejadas); [BANCO-DE-MAPAS.md](BANCO-DE-MAPAS.md) (catálogo); `panels/mapa-imersivo.mjs: renderAtlasPuzzle` (cartões e prévia); `app.mjs` (FilePicker e aplicação). O botão **Registrar fundos das cenas vinculadas** lê somente o `background.src` real de cenas já ligadas à localidade e grava os caminhos marcados no banco, sem criar, editar ou mover Scenes. |
| Criar cenas com mapas escolhidos | `scene-atlas.mjs: missingPlaceScenePlan` (plano puro); `library.mjs: setMapBankFile, missingMappedScenes, createMappedScenes` (setting, prévia, Scene.create e save único no atlas) |
| Lista (árvore de `<details>`) | `library.mjs: renderSceneAtlas` com `state.atlasView='list'`; acordeões lembram estado em `state.atlasOpen` via evento `toggle` em `app.mjs` |
| Aba Cena Atual | `panels/mapa-imersivo.mjs: renderActiveScenePanel` (área `activeScene`) + `activeSceneDiagram` (vizinhança: `scene-atlas.mjs: sceneNeighborhood`) + `activeSceneNpcTree` (`scene-atlas.mjs: regionLocalityTree`) |
| World Explorer (módulo de terceiros) | [world-explorer.mjs](../src/world-explorer.mjs) — tudo blindado; `library.mjs: explorationButton`. Formato do dado dele: `docs/REFERENCIA-SKYFALL.md`, seção "Módulos de terceiros" |
| Hooks | `main.mjs`: `canvasReady` (re-render), `deleteScene` (limpa entrada e posição), `updateScene` (pergunta ao ativar) |
| Testes | [scene-atlas.test.mjs](../tests/scene-atlas.test.mjs), [world-explorer.test.mjs](../tests/world-explorer.test.mjs), `library.test.mjs` ("quebra-cabeça do Mapa Imersivo", "painel da cena ativa") |

## Monstros (catálogo do livro + importados de outros jogos)

| Peça | Onde |
|---|---|
| Catálogo do livro (bestiário, ND, página e índice de habitat) | [book-monsters.mjs](../src/book-monsters.mjs) — cada entrada do livro traz `placeId`, `regionId` ou `beyondId` conforme a tabela da macro |
| Conversor D&D 5e → Skyfall | [monster-convert.mjs](../src/monster-convert.mjs) — ver `docs/T24-MONSTROS-COMPLETOS.md` pro estado exato |
| Filtro/facetas na tela (tipo, papel, porte, ND, região e além de Opath) | `library.mjs: monsterLocation, monsterFacetValues, monsterMatches` |
| Região/habitat de cada monstro do mundo | macro `.local/distribuir-monstros-por-regiao.js` → `flags.quedaco.monster`; a flag prevalece sobre o índice do livro |
| Biografia em ficha de campo (T24 §3) | `monster-convert.mjs: buildFieldSheet, alignmentPhrase, tacticsFromItems`; `toSkyfallNpc(mob,{habitat,fieldSheet})`. Temperamento sai da tendência (`mob.alignment`, lida nos 3 normalizadores), Táticas dos Itens gerados, Habitat passado por quem chama (a macro de reconversão lê `flags.quedaco.monster`). Aparência/Comportamento/O que quer/Ganchos vêm de `fieldSheet` — sem ela, "—" |
| Fichas de campo escritas | `.local/fichas-de-campo.json` — 44 entradas do bestiário **do livro** (não dos de D&D); nenhum código lê ainda — os do livro são fichas nativas do compêndio, não passam pelo conversor |
| Falta conhecido | traços/magia/hierarquia/arquétipo já viram Itens (T24, passos 4–5, feito 17/09) — mas **não verificado no Foundry**; reconverter os 326 já importados (perderam dado na 1ª importação) |

## Mundo do livro (regiões, locais, moedas)

| Peça | Onde |
|---|---|
| Regiões, locais, Quedas, luas | [book-world.mjs](../src/book-world.mjs) — `REGIONS`, `PLACES`, `BEYOND` |
| Cor de região/pasta | [regions.mjs](../src/regions.mjs) |
| Pesos de localidade (capital sempre lidera) | [locality.mjs](../src/locality.mjs) |
| Moedas | `book-world.mjs: COIN_COMMON, COIN_FACES` |
| Conferência da região-espelho | `library.mjs: regionReadiness, renderRegionReadiness`, no topo de `renderRegionView`; cruza NPCs, cenas, atlas e rumores sem gravar. `scene-atlas.mjs: resolveSceneLocality({includeLegacy:false})` separa cena apenas vinculada pelos settings de uma realmente organizada no Mapa Imersivo. |

## Itens e Imbuir

| Peça | Onde |
|---|---|
| Conversão de item externo pra Skyfall | [item-convert.mjs](../src/item-convert.mjs) |
| Modificação de item (T-ITEM-MODIFICADO) | [item-mod.mjs](../src/item-mod.mjs) |
| Categoria/estilo do cartão de item | `library.mjs: ITEM_CATEGORY_STYLE, itemProperties, itemDescriptors` |

## Imagens da mesa

| Peça | Onde |
|---|---|
| Candidatos, manifesto e fallback | [images.mjs](../src/images.mjs) — `resolveImage, ImageResolver` |
| Índice contra 404 | `images.mjs: buildImageIndex, indexedImageCandidates`; o setting de mundo `imageIndex` guarda somente os caminhos existentes sob a `assetRoot` atual |
| Ação da Mestra | `library.mjs: reindexImages`, botão “Reindexar imagens” no topo da biblioteca; lista uma vez as subpastas conhecidas com `FilePicker.browse` |
| Testes | [images.test.mjs](../tests/images.test.mjs) — índice restringe candidatos existentes; sem índice conserva a tentativa por convenção |

## Sistema visual do painel da Mestra

Regras de espaçamento, chip e card em **[DESIGN-SISTEMA-VISUAL.md](DESIGN-SISTEMA-VISUAL.md)**
— confira antes de escrever CSS novo em `styles/library.css`/`styles/creator.css`.
`npm run lint:css` (Stylelint) audita o CSS; config em `.stylelintrc.json` (regras que
não geram falso positivo) e `.stylelintrc.audit.json` (inclui `no-duplicate-selectors`,
rodar manualmente de vez em quando, é barulhento pelo estilo de override do arquivo).

## Criação de personagem (jogador)

| Peça | Onde |
|---|---|
| Interface, navegação, 13 etapas | [app.mjs](../src/app.mjs) |
| Grafo de benefícios/escolhas | [benefits.mjs](../src/benefits.mjs) |
| Marcos de classe 1–12 | [progression.mjs](../src/progression.mjs) |
| Perícias, proteções, idiomas | [training.mjs](../src/training.mjs) |
| Equipamento inicial | [equipment.mjs](../src/equipment.mjs) |
| Regras puras (atributo, vida, dinheiro, capacidade) | [rules.mjs](../src/rules.mjs) |

---

## Como usar isto ao pegar uma tarefa nova

1. Ache a área na tabela acima. Se ela já tem "Falta conhecido" listado, comece por ali.
2. Abra só os arquivos citados — não releia `library.mjs` inteiro.
3. Se a área não está na tabela, é nova: depois de codar, **acrescente uma seção aqui**.
4. Pra saber o que existe *no mundo agora* (quantos NPCs, quais guildas estão em jogo,
   etc.), não dá pra ler isto — isto é o código. Use o snapshot do mundo:
   **[COMO-CONSULTAR-O-MUNDO.md](COMO-CONSULTAR-O-MUNDO.md)**.
