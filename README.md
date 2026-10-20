# QUEDAÇO · Personagens Skyfall RPG

Módulo de Foundry VTT para criar personagens de Skyfall RPG. Um criador guiado monta a ficha nativa do sistema a partir dos compêndios da própria mesa, do nível 1 ao 12. Uma API opcional usa o mesmo motor para criar NPCs a partir de modelos.

Funciona sozinho. O QUEDAÇO principal (campanha, mapas, NPCs, guildas) é outro módulo e pode usar esta API quando os dois estiverem instalados.

## O que faz

- Lê os compêndios autorizados da mesa, elimina cópias equivalentes, prioriza **Criação de Personagem** e não oferece documentos soltos de **Mundo**.
- Fluxo guiado de 13 etapas, com treinamento, equipamento inicial e compras.
- Níveis 1 a 12: reúne os benefícios da classe e da trilha até o nível escolhido, separa as decisões por nível e grava as origens `class-01` a `class-12` usadas pela ficha nativa.
- Vida com valor fixo ou rolagem nos níveis adicionais; dinheiro, capacidade e volume conforme o livro.
- Rascunho salvo automaticamente.
- API de modelos de NPC: ver [`docs/MODELOS-DE-NPC.md`](docs/MODELOS-DE-NPC.md).
- Lotes de até 200 NPCs com prévia assinada e relatório individual; integração com o Cadastro QUEDAÇO 0.18.6.
- Em 0.2.0, propostas por descrição com perfis de propósito/ânima do Cadastro 0.19.0; seleções explícitas e pendências para conteúdo não resolvido. Ver [RELEASE-0.2.0](docs/RELEASE-0.2.0.md).

## Ambiente alvo

- Foundry VTT 13 build 351.
- Sistema Skyfall 1.0.1, com o conteúdo do Livro Básico (`skyfall-core`).
- Permissão de criação de Atores para quem usar o criador.

## Uso

Em 0.3.0, a Mestra liga/desliga o acesso dos jogadores pelo botão **Jogadores:
criação desligada/ligada**, no Diretório de Atores. O padrão é desligado. Gerencia
ACTOR_CREATE sem remover permissões preexistentes. Ver [RELEASE-0.3.0](docs/RELEASE-0.3.0.md).

Depois de habilitar o módulo, use **Criar personagem** no topo do Diretório de Atores. Por macro:

```js
game.modules.get('quedaco-personagens-skyfall-rpg').api.open();
```

## Desenvolvimento

Node.js 22 ou superior, sem dependências em execução.

```sh
npm test
npm run package
```

Publicação e atualização: [`docs/ATUALIZACOES.md`](docs/ATUALIZACOES.md). Estado das regras: [`docs/COBERTURA.md`](docs/COBERTURA.md).

## Identidade visual

Azul-ciano, fonte Outfit (licença OFL, incluída) e Noka opcional, carregada de uma pasta privada da mesa.

## Conteúdo

As regras foram conferidas no Livro Básico DIGITAL 1.25. O repositório não redistribui textos, ilustrações nem compêndios do livro; esses materiais são lidos no Foundry conforme as permissões da mesa.
