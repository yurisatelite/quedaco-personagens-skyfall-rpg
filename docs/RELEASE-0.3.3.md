# v0.3.3 — Modelos de NPC e escolhas dependentes

O motor de modelos e descrições aguarda a resolução de trilhas e benefícios
aninhados antes de declarar que faltam talentos. A façanha inicial de combate
acompanha o estilo selecionado. Escolhas explícitas incompatíveis e conteúdo
realmente ausente continuam bloqueando a criação antes de gravar Actors.

O Criador anuncia `npcTemplateResolution: true` no protocolo opcional QUEDAÇO v1.
QUEDAÇO 0.20.2 verifica essa capacidade antes de preparar lotes. Os módulos
continuam independentes, sem dependência obrigatória no manifesto.

Validação: testes Node com dados simulados, empacotamento e prévia local dos 37
modelos de Thur Thur usando estrutura de benefícios e inventário exportada dos
compêndios reais da mesa em 21/10/2026. Nenhum texto ou asset desses compêndios
faz parte do pacote público. A prévia não comprova recursos derivados nem a
conclusão da criação dentro do Foundry; essa conferência permanece necessária.
