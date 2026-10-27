# QUEDAÇO · Personagens Skyfall RPG

Módulo de Foundry VTT para criar personagens de Skyfall RPG. Um criador guiado monta a ficha nativa do sistema a partir dos compêndios da própria mesa, do nível 1 ao 12. Uma API opcional usa o mesmo motor para criar NPCs a partir de modelos.

Funciona sozinho. O QUEDAÇO principal (campanha, mapas, NPCs, guildas) é outro módulo e pode usar esta API quando os dois estiverem instalados.

## O que faz

- Lê os compêndios autorizados da mesa, elimina cópias equivalentes, prioriza **Criação de Personagem** e não oferece documentos soltos de **Mundo**.
- Fluxo guiado de 13 etapas em cinco grupos, com treinamento, equipamento inicial e compras.
- Interface adaptável ao tamanho da janela, resumo sob demanda e moedas com o mesmo peso visual.
- Sorteio com escolhas fixas e prévia de grupos por descrição, com revisão antes de criar fichas.
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

Desde 0.4.0, existe uma única entrada **Criar personagem** no Diretório de Atores.
Ela oferece Passo a passo, Personagem aleatório e Grupo por descrição (Mestra).
Dentro do criador, **Jogadores** configura o acesso e a pasta de destino.
O padrão é desligado. Gerencia ACTOR_CREATE sem remover permissões preexistentes.
Ver [RELEASE-0.4.0](docs/RELEASE-0.4.0.md).

Depois de habilitar o módulo, use **Criar personagem** no topo do Diretório de Atores. Por macro:

```js
game.modules.get('quedaco-personagens-skyfall-rpg').api.open();
```

### Pasta dos personagens dos jogadores

Dentro do criador original, a Mestra usa **Jogadores** para escolher uma pasta de Atores existente,
como **Jogadores 2 Era Cravokia**, e liberar todas as escolhas do criador.
Cada ficha nova vai para essa pasta com Owner para quem criou e acesso padrão None.
A Mestra vê todas; cada jogador vê as próprias fichas. A seleção usa o ID da pasta,
sem adivinhar nomes de campanha. Pasta removida impede a criação com um aviso.
Fichas anteriores e o personagem principal da conta não são alterados.

Liberar também concede a permissão nativa de criar Atores aos papéis de jogador.
Desligar restaura somente concessões feitas pelo módulo, preservando permissões
preexistentes e acesso às fichas já criadas. A leitura dos compêndios continua
sujeita às permissões da mesa. Modelos e lotes de NPC seguem seu fluxo próprio.

## Desenvolvimento

Node.js 22 ou superior, sem dependências em execução.

```sh
npm test
npm run package
```

Publicação e atualização: [`docs/ATUALIZACOES.md`](docs/ATUALIZACOES.md). Estado das regras: [`docs/COBERTURA.md`](docs/COBERTURA.md).

## Identidade visual

Azul-ciano, fonte Outfit (licença OFL, incluída) e Noka opcional, carregada de uma pasta privada da mesa.

O padrão QUEDAÇO UI v1 está em [IDENTIDADE-VISUAL.md](docs/IDENTIDADE-VISUAL.md),
com tokens reutilizáveis em `styles/quedaco-ui.css`. Os outros módulos permanecem independentes.

## Sorteios e grupos

Escolha quantidade (1–20), nível e conceito; nomes reconhecidos no texto ou campos
fixos restringem o sorteio. Revise a interpretação e cada proposta. Use **Revisar /
editar** para abrir as escolhas no criador original ou sorteie apenas um personagem.
O contexto é preservado na história; funções são propostas de campanha. A criação
de todas as fichas só começa após revisão e validação.

O processamento é local: não usa serviço de IA nem credenciais externas. Gnomos
têm campo de animal da ânima; perfis automáticos de gato, cobra e gavião usam apenas
características do compêndio. Outros animais exigem revisão manual. Regras apenas
em prosa continuam sujeitas às pendências documentadas em `docs/COBERTURA.md`.

## Conteúdo

As regras foram conferidas no Livro Básico DIGITAL 1.25. O repositório não redistribui textos, ilustrações nem compêndios do livro; esses materiais são lidos no Foundry conforme as permissões da mesa.
