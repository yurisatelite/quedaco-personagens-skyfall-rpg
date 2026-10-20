# Próxima atualização — escolhas por conceito e ânima

Atualização em 20/10/2026: implementação inicial no código 0.2.0, descrita em
[RELEASE-0.2.0.md](RELEASE-0.2.0.md). O restante registra o diagnóstico anterior.

Pedido do Yuri em 20/10/2026, pendente de implementação.
Especificação central e texto de referência:
`E:/RPG/QUEDACO/modulo/docs/PROXIMA-ATUALIZACAO-NPCS-POR-DESCRICAO.md`.

O Criador 0.1.9 recebe modelos mecânicos completos. O motor de NPCs não recebe
animal da ânima nem seleções exatas por grupo; usa prioridades e ordem por nome
para completar escolhas. Não confundir esse processo com interpretação do animal.

Implementar escolhas explícitas ligadas a animal/aspectos e conceito; exibir
pendências se faltarem decisões. Validar primeiro estrutura e depois as opções
concretas de herança, inclusive concessões adicionais de talentos.
Não fixar mapa universal animal -> heranças nem inventar habilidades temáticas.
O Cadastro mantém os pedidos e lotes; o Criador permanece dono das regras e
da montagem da ficha. Texto livre pode ser preparado pelo assistente sem
pressupor um serviço de IA executando dentro do Foundry.

Referência local conferida: Livro Básico DIGITAL 1.25, páginas 81–82
(`E:/RPG/QUEDACO/modulo/.local/book/081.txt` e `082.txt`). A regra inicial
permite duas heranças maiores ou uma maior e duas menores. A página seguinte
inclui talento de concessão adicional. A regra de quantidade não basta para
resolver quais opções atendem ao animal desejado pelo jogador.
