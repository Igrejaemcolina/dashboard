# Dashboard da Congregação

Este repositório contém a aplicação de dashboard responsiva que consome dados da planilha do Google Sheets e apresenta métricas sobre os irmãos cadastrados.

## Estrutura

- `docs/index.html`, `docs/styles.css`, `docs/script.js`: código-fonte principal utilizado tanto para desenvolvimento local quanto para publicação.
- `docs/category.html`: página dedicada para visualizar uma categoria específica de irmãos.
- `docs/services.html`: página dedicada ao gerenciamento das frentes de serviço.
- Demais ativos (imagens, traduções e lógica) residem dentro do diretório `docs/`, que é a fonte oficial do GitHub Pages.

## Publicação no GitHub Pages

1. Habilite o GitHub Pages no repositório escolhendo a branch principal e a pasta `/docs` como fonte.
2. Acesse a URL informada pelo GitHub Pages para visualizar a dashboard hospedada.

## Desenvolvimento

Basta abrir o `docs/index.html` em um navegador para testar localmente.

Os dados são carregados automaticamente a partir da planilha configurada em `script.js`.

### Suporte a idiomas

- A interface está disponível em Português (PT), Inglês (EN) e Espanhol (ES).
- O seletor aparece ao lado do perfil no cabeçalho; clique no código do idioma para abrir a lista e escolher outra tradução.
- A preferência fica registrada no navegador (via `localStorage`) e é aplicada automaticamente nas próximas visitas.

### Dados complementares

- Além da planilha principal, o código consulta a planilha complementar dos adolescentes (`1FLPdqmH6xOaMbc2RUjuANDWWNaMpJlc8RGuYiPjC_GQ`).
- Cada registro é reconciliado pelo nome; quando possível a combinação é confirmada pela data de nascimento e, não havendo essa informação, pelo número de telefone.
- Os campos encontrados na planilha complementar preenchem informações faltantes no modal de detalhes e também servem como fonte alternativa de telefone para os cartões de pessoas.

### Controle de acesso

- Ao abrir o site é exibido um modal com a mensagem **"Selecione a seguir sua função"**. Cada função possui senha própria (armazenada apenas em hash no código) e determina o nível de acesso:
  - **Irmão Responsável** — acesso completo a todas as abas, buscas, gráficos e relatórios.
  - **Capitães de Tropa** — visualizam somente os cartões de **Adolescentes** e **Pais** no painel principal. A navegação superior libera apenas essas categorias e o resumo de **Serviços** para consulta.
  - **Serviços** — perfil dedicado ao gerenciamento das frentes de serviço. Tem acesso completo às páginas e é o único autorizado a editar as tags de ministério exibidas nos cadastros.
- As senhas são validadas utilizando SHA-256; as versões cifradas (tanto das senhas quanto dos nomes exibidos) permanecem preservadas no código-fonte, sem exposição em texto puro.
- Todos os perfis podem acessar a categoria **Pais**, escolhendo entre pai ou mãe ao abrir cada registro, e visualizar o módulo de **Serviços** para acompanhar quem está servindo.
- A sessão é mantida em `sessionStorage` para não solicitar senha novamente enquanto o navegador permanecer aberto na mesma aba.
- O perfil autenticado aparece no cabeçalho da dashboard e oferece a opção **"Trocar de usuário"** para voltar ao modal de acesso quando necessário.
- Quando autenticado como **Serviços**, o menu do usuário também mostra **"Gerenciar serviços"**, que direciona para `services.html`. Nos demais perfis essa ação fica oculta.

### Navegação por categorias

- Os cartões do painel principal exibem os totais gerais e, ao serem clicados, navegam na mesma aba para a página `category.html` filtrada para a faixa correspondente.
- As faixas utilizadas são:
  - Crianças: 0 a 10 anos
  - Adolescentes: 11 a 17 anos
  - Capitães de Tropa: 18 a 29 anos
  - Valentes de Davi: 30 a 49 anos
  - Intendentes: 50 anos ou mais
- Cada página de categoria inclui um gráfico de distribuição de idades, a contagem de irmãos daquela faixa e cartões clicáveis com nome, idade calculada a partir da data de nascimento e telefone.
- A aba de adolescentes oferece um filtro extra chamado **"Idade apta para colportagem"**, que quando ativado exibe somente os jovens com 16 e 17 anos.
- O cartão **Pais** reúne pais e mães vinculados aos adolescentes. Na categoria correspondente, cada card exibe os nomes dos responsáveis e do filho, e ao clicar é possível escolher visualizar os dados do pai ou da mãe em um modal dedicado.
- O cartão **Serviços** apresenta o total de irmãos que servem; ao acessá-lo, são exibidos subtotais por frente de trabalho e os cards das pessoas filtrados pelo serviço selecionado.
- Usuários autenticados como **Serviços** também podem abrir diretamente `services.html` pelo menu do perfil para gerenciar todas as frentes em uma única tela, com filtros e resumo geral.

### Aniversariantes do dia

- O painel identifica automaticamente quem faz aniversário na data atual utilizando a coluna de data de nascimento.
- A lista de aniversariantes fica visível apenas na tela inicial para evitar poluição visual dentro das categorias.
- Irmãos Responsáveis visualizam aniversariantes de todas as faixas; Capitães de Tropa enxergam apenas adolescentes.
- Cada aniversariante aparece em um cartão clicável com idade e telefone para facilitar o contato imediato.

### Serviços na vida da igreja

- Ao acessar o modal de detalhes com o perfil **Serviços**, a lista de checkboxes fica disponível para marcar todas as frentes em que o irmão atua (Literatura, Recepção, Projeção, Transmissão, Irmão Responsável, Irmão que Fala a Mensagem, Casa Kids e Cozinha CDA). É possível selecionar quantos ministérios forem necessários simultaneamente.
- Nos demais perfis, apenas as tags de serviço aparecem nos cards e no modal, indicando em quais ministérios cada pessoa atua sem oferecer controles de edição.
- As escolhas ficam salvas no navegador por meio do `localStorage`, permitindo ajustes a qualquer momento sem depender da planilha.
- O resumo de serviços considera tanto os dados principais quanto os complementares e atualiza os totais em tempo real para todos os perfis. Perfis de Irmão Responsável e Capitães de Tropa acompanham os números em modo somente leitura, enquanto o perfil **Serviços** pode alterar e revisar diretamente pelo modal ou pelo gerenciador dedicado (`services.html`).

### JP assistant

- Um botão flutuante no canto inferior direito abre o JP assistant com perguntas frequentes sobre o uso da dashboard.
- Três dúvidas comuns já ficam disponíveis e uma quarta opção **"Outros"** permite digitar perguntas personalizadas.
- As respostas levam em consideração o perfil autenticado, mencionando o nome do usuário e as ações disponíveis para cada função.
