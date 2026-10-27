# v0.3.4 — Pasta dos personagens dos jogadores

O botão **Liberar criação para jogadores** abre um painel para selecionar uma
pasta de Atores existente e liberar o criador completo. Quando já liberado, o
botão aparece como **Configurar criação dos jogadores**. Nenhuma escolha de
legado, nível ou classe é imposta aos jogadores.

Cada nova ficha do criador recebe a pasta selecionada por ID, Owner para a conta
que a criou e acesso padrão None. A Mestra vê todas; jogadores veem suas próprias
fichas. Se a pasta for removida, a criação é interrompida com um aviso em vez de
salvar a ficha na raiz. Fichas anteriores, pastas e personagem principal da conta
não são alterados. A API de modelos e lotes de NPC permanece independente.

A liberação mantém o controle de permissões nativas da v0.3.3: concede criação de
Atores aos papéis de jogador e, ao desligar, remove apenas as concessões feitas
pelo módulo. Permissões preexistentes são preservadas.

Validação: 74 testes Node, incluindo permissões, pasta, isolamento de propriedade e painel;
pacote público sem Noka. APIs conferidas na instalação local do Foundry 13.
Ainda falta validar a criação entre contas dentro de um mundo de teste. Nenhum
Actor do mundo oficial foi criado ou alterado durante o desenvolvimento.
