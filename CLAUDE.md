# QUEDAÇO · Personagens Skyfall RPG — contexto para Claude Code

Módulo de Foundry VTT que **cria Atores**: o criador guiado de personagens de jogador
(13 etapas, níveis 1–12) e a API opcional de modelos de NPC, que usa o mesmo motor.
Nada de mapa, cena, atlas, guilda, loja ou painel da Mestra mora aqui — isso é do
QUEDAÇO principal, em `E:\RPG\QUEDACO\modulo`. Se um pedido for sobre essas áreas,
ele pertence àquele repositório.

Leia `README.md` e `docs/COBERTURA.md` antes de alterar código.

## Ambiente confirmado

- Foundry VTT 13 build 351.
- Sistema `skyfall` 1.0.1.
- Mundo oficial remoto: **Skyfall RPG**.
- ID do módulo: `quedaco-personagens-skyfall-rpg`. Funciona sozinho; não depende do QUEDAÇO principal.
- O código local é a fonte de verdade. Não edite diretamente os arquivos do servidor.

## Onde as coisas moram

- `E:\RPG\QUEDACO\personagens-skyfall-rpg` — **este repositório**. Remote `origin` → `github.com/yurisatelite/quedaco-personagens-skyfall-rpg`.
- `E:\RPG\QUEDACO\modulo` — QUEDAÇO principal (campanha, mapas, NPCs, guildas). Esta pasta nasceu como cópia dele em 10/10/2026.
- `.local/`, `dist/`, `Fotos pra subir/` — fora do git.

## Regras de trabalho

1. Não invente regras, campos ou opções. Confira `E:/RPG/Skyfall RPG - Livro Básico DIGITAL 1.25.pdf` e o esquema local em `C:/Users/YURI/AppData/Local/FoundryVTT/Data/systems/skyfall`.
2. Não copie textos extensos nem imagens do livro para o repositório. O módulo lê conteúdo dos compêndios autorizados da mesa.
3. Não crie, edite ou exclua Atores do mundo oficial durante desenvolvimento. Testes integrados devem parar antes da criação da ficha, salvo instrução expressa do Yuri.
4. Preserve compatibilidade com Foundry 13 e Skyfall 1.0.1 até uma migração deliberada.
5. Use `rg` para buscas. Faça mudanças pequenas e verificáveis.
6. Rode `npm test` e `npm run package` antes de considerar a alteração pronta. Mexeu em `styles/creator.css`, rode também `npm run lint:css`.
7. Aumente `module.json.version` e `package.json.version` somente ao preparar uma versão instalável.
8. Não publique a fonte Noka em repositório público sem confirmar sua licença de redistribuição.
9. Arquivo novo em `src/` só entra no pacote se for acrescentado à lista de `tools/package.mjs`. Teste novo só roda se entrar no script `test` de `package.json`.
10. Pesquisa funda vira documento antes de fechar a tarefa: fato do sistema Skyfall em `docs/REFERENCIA-SKYFALL.md`, fato deste módulo em `docs/MAPA-DO-MODULO.md`.

## Arquitetura

- `src/main.mjs`: inicialização, botão **Criar personagem** no Diretório de Atores e API (`game.modules.get('quedaco-personagens-skyfall-rpg').api`, protocolo QUEDAÇO v1).
- `src/app.mjs`: interface ApplicationV2, navegação e fluxo de 13 etapas.
- `src/catalog.mjs` + `src/coverage.mjs`: catálogo canônico dos compêndios; itens soltos de Mundo ficam fora.
- `src/benefits.mjs`: grafo de benefícios e escolhas até o nível de destino.
- `src/progression.mjs`: marcos de classe dos níveis 1–12.
- `src/training.mjs`: perícias, proteções, idiomas, proficiências e especialidade.
- `src/equipment.mjs`: equipamento inicial, compras, quantidades e volume.
- `src/rules.mjs`: regras puras de atributos, vida, dinheiro e capacidade.
- `src/adapter.mjs`: único ponto que cria ou atualiza documentos do Foundry.
- `src/npc-templates.mjs`: modelos de NPC (prévia, criação, relações). Contrato em `docs/MODELOS-DE-NPC.md`.
- `src/branding.mjs`: fonte Outfit/Noka.
- `styles/creator.css`: identidade visual azul-ciano.
- `tests/`: testes Node sem Foundry em execução.

## Comandos

```powershell
npm test
npm run package
npm run release            # zip privado
npm run release -- -Public # zip público (sem Noka)
npm run lint:css
```

O pacote fica em `dist/quedaco-personagens-skyfall-rpg-<versão>/quedaco-personagens-skyfall-rpg`. Publicação: `docs/ATUALIZACOES.md`.

## Estado funcional

- Versão: **0.1.8** (15/10/2026) — modelos de NPC. Ver `docs/RELEASE-0.1.8.md`.
- **Próximo passo:** conferir no Foundry 13 uma criação completa com os compêndios reais (personagem e modelo de NPC), num mundo de teste. Os testes automatizados usam dados falsos.
- Pendências de regra do criador: `docs/COBERTURA.md`, seção "Pendente".

## Entrega de uma mudança

Informe ao Yuri: comportamento alterado, arquivos principais, testes executados e qualquer parte ainda não confirmada dentro do Foundry. Não envie arquivos ao servidor nem publique releases sem autorização explícita para aquela versão.
