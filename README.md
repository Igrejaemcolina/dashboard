# Dashboard da Congregação

Este repositório contém a aplicação de dashboard responsiva que consome dados da planilha do Google Sheets e apresenta métricas sobre os irmãos cadastrados.

## Estrutura

- `index.html`, `styles.css`, `script.js`: código-fonte principal para desenvolvimento local.
- `category.html`: página dedicada para visualizar uma categoria específica de irmãos.
- `docs/`: cópia dos mesmos arquivos utilizada pelo GitHub Pages para servir o site.

## Publicação no GitHub Pages

1. Habilite o GitHub Pages no repositório escolhendo a branch principal e a pasta `/docs` como fonte.
2. Acesse a URL informada pelo GitHub Pages para visualizar a dashboard hospedada.

## Desenvolvimento

Basta abrir o `index.html` em um navegador para testar localmente.

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

- Ao abrir o site é exibido um modal com a mensagem **"Selecione a seguir sua função"** (Irmão Responsável ou Capitães de Tropa).
- Cada opção exige uma senha pré-configurada que é comparada utilizando hash SHA-256. As versões cifradas ficam no código e as senhas em texto puro não são expostas.
- Os nomes vinculados a cada credencial também são armazenados cifrados no código-fonte para evitar exposição direta.
- **Irmão Responsável** tem acesso completo a todas as abas, buscas e gráficos.
- **Capitães de Tropa** enxergam somente os cartões de **Adolescentes** e **Pais** no painel principal. A navegação superior também libera o acesso ao resumo de **Serviços** junto com os adolescentes, enquanto os demais blocos permanecem ocultos.
- Ambos os perfis podem acessar a categoria **Pais**, selecionando entre pai ou mãe ao abrir cada registro para consultar os detalhes disponíveis daquele responsável, e o módulo de **Serviços** para acompanhar quem está servindo.
- A sessão é mantida em `sessionStorage` para não solicitar senha novamente enquanto o navegador permanecer aberto na mesma aba.
- O perfil autenticado aparece no cabeçalho da dashboard e oferece a opção **"Trocar de usuário"** para voltar ao modal de acesso quando necessário.

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

### Aniversariantes do dia

- O painel identifica automaticamente quem faz aniversário na data atual utilizando a coluna de data de nascimento.
- A lista de aniversariantes fica visível apenas na tela inicial para evitar poluição visual dentro das categorias.
- Irmãos Responsáveis visualizam aniversariantes de todas as faixas; Capitães de Tropa enxergam apenas adolescentes.
- Cada aniversariante aparece em um cartão clicável com idade e telefone para facilitar o contato imediato.

### Serviços na vida da igreja

- Dentro do modal de detalhes de cada irmão há um campo para marcar se ele serve e selecionar uma das frentes disponíveis (Literatura, Recepção, Projeção, Transmissão, Irmão Responsável, Irmão que fala a mensagem, Casa Kids e Cozinha CDA).
- As escolhas ficam salvas no navegador por meio do `localStorage`, permitindo ajustes a qualquer momento sem depender da planilha.
- O resumo de serviços considera tanto os dados principais quanto os complementares e atualiza os totais em tempo real para todos os perfis.

### JP assistant

- Um botão flutuante no canto inferior direito abre o JP assistant com perguntas frequentes sobre o uso da dashboard.
- Três dúvidas comuns já ficam disponíveis e uma quarta opção **"Outros"** permite digitar perguntas personalizadas.
- As respostas levam em consideração o perfil autenticado, mencionando o nome do usuário e as ações disponíveis para cada função.
