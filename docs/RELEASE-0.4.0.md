# v0.4.0 — Novo fluxo no criador original

O único botão **Criar personagem** abre o criador com três modos: **Passo a passo**,
**Personagem aleatório** e, para a Mestra, **Grupo por descrição**. A configuração
de acesso e pasta está em **Jogadores**, dentro da mesma aplicação. Não há outro
criador nem segundo botão de configuração no Diretório de Atores.

## Interface e identidade visual

As 13 etapas foram organizadas em cinco grupos: Identidade, Origens, Formação,
Ficha e Finalização. A composição se adapta à largura da própria janela, mesmo
em monitor grande. Em janelas menores o resumo abre sob demanda e a navegação
vira seletor; formulário e rodapé continuam acessíveis. As três moedas têm
cartões iguais. A marca é tipográfica, sem o retângulo do PNG. Fechar, minimizar
e ajustar à tela usam símbolos de texto e ações do Foundry.

O padrão reutilizável QUEDAÇO UI v1 está em `docs/IDENTIDADE-VISUAL.md` e
`styles/quedaco-ui.css`: tokens de cor e espaçamento, hierarquia de pesos,
componentes equivalentes, adaptação e acessibilidade. Outros módulos não foram
alterados nesta versão.

## Geração e revisão

- Sorteio de legado, herança vinculada, maldição opcional, antecedente, classe,
  distribuição fixa de atributos, benefícios por nível, treinamento, dinheiro e
  equipamento inicial usando os validadores existentes.
- Campos para fixar escolhas; **Sortear restante** preserva as origens já
  escolhidas no modo manual e refaz atributos, benefícios, treinamento e equipamento.
- Grupos de 1 a 20 personagens com quantidade, nível, conceito e contexto. O texto
  reconhece nomes do catálogo e “anão/anões” como Tôra. Campos explícitos têm prioridade.
- Funções de campanha podem variar no grupo, com propostas de classe, antecedente
  e distribuição de atributos. O contexto original é preservado na história.
- Prévia por personagem, edição no criador original e sorteio individual. Nenhum
  Actor é criado na prévia. É necessário revisar as fichas antes da criação.
- Antes de gravar o grupo, todas as propostas passam novamente pelos validadores.
  Fichas já criadas não são repetidas ao retomar um lote com falha parcial.
- Pasta de destino e Owner automático da v0.3.4 preservados. Quem cria recebe a
  propriedade; demais jogadores não recebem acesso por padrão. Gerar um grupo
  como Mestra não atribui personagens a outras contas automaticamente.

## Gnomos e limites

O animal da ânima agora é explícito no fluxo manual e preservado nas notas da
ficha. Os perfis automáticos de campanha disponíveis são gato, cobra e gavião,
sempre limitados às características concedidas pelo compêndio. Outros animais
ficam para revisão manual; benefícios não são inventados para completar uma ficha.

A descrição usa interpretação local e perfis de campanha, não um serviço de IA.
Não compreende livremente todo texto nem resolve regras presentes apenas em prosa.
Conteúdo ausente, concessões incompatíveis, carga excessiva e escolhas pendentes
aparecem na prévia e bloqueiam a criação automática. As pendências gerais de
regras em `docs/COBERTURA.md` continuam identificadas.

Validação: 84 testes automatizados, incluindo geração, treinamento nas três classes e vinte
antecedentes, revisão, acesso, pasta e retomada de grupo. Prévia visual com dados
fictícios em janela ampla, 800px e 360px. A exportação privada disponível dos
compêndios confirma a resolução de benefícios, mas omite categorias/preços de
equipamento e não comprova a geração de inventário real. A conclusão da criação
entre contas no Foundry ainda precisa de conferência em mundo de teste. Nenhum
Actor da mesa oficial foi criado, editado ou excluído durante o desenvolvimento.
