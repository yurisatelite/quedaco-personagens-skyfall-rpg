# Cobertura e estado da implementação

Este arquivo distingue catálogo, texto de regras, escolhas variáveis e ficha jogável. Uma opção aparecer no catálogo não comprova que seus benefícios foram aplicados.

## Fontes verificadas

- Livro Básico DIGITAL 1.25 fornecido pelo Yuri: regras de criação pp. 63–217, equipamento pp. 219–259, magia pp. 261–303 e universos alternativos pp. 416–430.
- Instalação local: Skyfall 1.0.1, compatível com Foundry 13.
- Mesa online: Foundry 13 build 351, Skyfall 1.0.1, 57 módulos ativos, constatado na interface em 07/09/2026.
- Compêndios online do `skyfall-core`: Criação de Personagem, Equipamentos, Magias, Regras e demais coleções do Livro Básico. Constatadas pastas de legados tradicionais e dos universos 12:34 e 37:34.
- Diagnóstico online completo: 1.284 Itens lidos sem falhas (909 de Criação de Personagem, 201 de Equipamentos, 99 documentos no compêndio de Magias, 46 de Guildas e 29 de Criação de Ameaça). O compêndio de Magias contém 98 documentos do tipo `spell`.

## Implementado

- Leitura de todos os índices de Itens acessíveis de Skyfall, sem lista curta ou limite artificial.
- Catálogo canônico por tipo e identificador, com prioridade para Criação de Personagem, Equipamentos e Magias. Documentos soltos de Mundo não entram no seletor.
- Identificação de falhas/permissões de leitura; relatório de nomes ausentes e imagens genéricas.
- Checklist inicial: 16 legados (11 principais e 5 alternativos), 20 antecedentes, 3 classes, 4 maldições, 18 trilhas.
- Grafo oficial dos legados: 44 heranças vinculadas às opções corretas e nenhum UUID de benefício quebrado. A interface filtra as heranças pelo legado escolhido.
- Interface Noka e ciano; detalhes extraídos do documento real, com acesso à ficha original completa.
- Atributos fixos, convencionais, em ordem ou manuais; dados usando `Roll` do Foundry.
- Dinheiro dos 20 antecedentes e das 3 classes. Aristocrata usa 3d10+30; Devedor tem dívida; Viajante Intrépido tem verba de exploração, sem convertê-la indevidamente em dinheiro livre.
- Criação de `Actor.character` com proprietário explícito, token vinculado, `system.currency.t/p/k`, modificadores de atributos e origem rastreável do conteúdo.
- Inclusão dos documentos preservando seus efeitos, imagens e metadados, depois das escolhas feitas no QUEDAÇO.
- Resolução integrada dos benefícios registrados nos documentos até o nível escolhido, entre 1 e 12. A interface apresenta os marcos de Combatente, Especialista e Ocultista e separa as escolhas por nível.
- Classe gravada no nível de destino, 3 PE por nível e vida calculada com máximo no primeiro nível e valor fixo ou dados rolados nos níveis posteriores.
- Treinamento das 3 classes e dos 20 antecedentes: armas, armaduras, proteções, perícias, aptidões e idiomas são validados e gravados no esquema nativo da ficha. Escolhas repetidas são recusadas.
- Bônus de INT da página 155 como escolha de perícia ou truque para cada dois pontos positivos, sem permitir truques duplicados.
- Equipamento inicial das três classes com todas as alternativas do livro, quantidades e munição adequada. Foram confirmados no compêndio online 18 modelos de armas simples, 16 marciais e todos os itens fixos usados pelos conjuntos.
- Equipamento dos 20 antecedentes: itens concretos disponíveis no compêndio entram no inventário, escolhas respeitam preço e proficiência, e pertences narrativos são preservados nas notas da criação.
- Compras adicionais descontam a bolsa em Trocados; a verba do Viajante Intrépido permanece separada e só aceita itens de exploração. A prévia soma o volume dos itens e compara com a capacidade calculada pela FOR.

## Pendente antes de liberar como criador completo

- Resolver a herança `Corte do Crepúsculo`, presente no compêndio mas sem vínculo com qualquer legado. Ela fica fora das opções até haver fonte segura para atribuí-la.
- Completar escolhas variáveis contidas apenas em prosa dentro de alguns legados e talentos, incluindo tamanho, deslocamento, bênçãos e outras decisões internas.
- Requisitos, quantidade de magias, bônus de INT, fragmentação, aprimoramentos e outras variáveis derivadas.
- Simulação opcional de venda do equipamento inicial por metade do preço.
- Prévia final com efeitos realmente calculados pelo sistema e verificação de recursos/proteções.
- Testar a conclusão automática completa dentro do Foundry e confirmar o resultado com usuário jogador.
- Teste real com usuário jogador, permissões de criação/compêndios e eventual mediação do mestre.
- Conferir no Foundry cada trilha e talento de níveis 2–12, especialmente escolhas descritas somente em prosa e as variações da Tradição Ocultista.
- Imagens ausentes, retratos e tokens adequados às escolhas. Nenhuma arte genérica é considerada cobertura concluída.
- Instalação online e teste integrado com os módulos da mesa.
- O antecedente Estudioso Feérico concede o idioma Feérico, mas esse idioma não existe no esquema fechado de idiomas do Skyfall 1.0.1. Até a integração ser corrigida no sistema, o módulo preserva essa concessão nas notas de criação e aplica Élfico normalmente.

## Diferença encontrada no sistema

O método `prepareMaxHPMean` do Skyfall 1.0.1 local usa `Math.floor((die + 1) / 2)`. O livro informa 6/5/4 como valores fixos após o primeiro nível para d10/d8/d6. O QUEDAÇO calcula esses valores conforme o livro e ainda precisa de teste integrado para confirmar como o total calculado pelo sistema reage ao item de classe no nível de destino.

## Limite atual

Versão 0.1.8 do módulo separado de personagens (a contagem 0.2.0 citada antes era do QUEDAÇO principal). Os testes automatizados verificam regras e contratos com mocks; não substituem o teste dentro do Foundry. A progressão de níveis 2–12 precisa da rodada de testes integrada antes da publicação comunitária.
