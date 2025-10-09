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

### Controle de acesso

- Ao abrir o site é exibido um modal solicitando o perfil de acesso (Irmão Responsável ou Capitão).
- Cada opção exige uma senha pré-configurada que é comparada utilizando hash SHA-256. As versões cifradas ficam no código e as senhas em texto puro não são expostas.
- **Irmão Responsável** tem acesso completo a todas as abas, buscas e gráficos.
- **Capitão** visualiza os contadores gerais, porém só pode abrir e pesquisar a aba de adolescentes (11–17 anos); as demais categorias ficam bloqueadas.
- A sessão é mantida em `sessionStorage` para não solicitar senha novamente enquanto o navegador permanecer aberto na mesma aba.
- O perfil autenticado aparece no cabeçalho da dashboard e oferece a opção **"Trocar de usuário"** para voltar ao modal de acesso quando necessário.

### Navegação por categorias

- Os cartões do painel principal exibem os totais gerais e, ao serem clicados, navegam na mesma aba para a página `category.html` filtrada para a faixa etária correspondente.
- As faixas utilizadas são:
  - Crianças: 0 a 10 anos
  - Adolescentes: 11 a 17 anos
  - Capitães: 18 a 29 anos
  - Valentes de Davi: 30 a 49 anos
  - Intendentes: 50 anos ou mais
- Cada página de categoria inclui um gráfico de distribuição de idades, a contagem de irmãos daquela faixa e cartões clicáveis com nome, idade calculada a partir da data de nascimento e telefone.
- A aba de adolescentes oferece um filtro extra chamado **"Idade apta para colportagem"**, que quando ativado exibe somente os jovens com 16 e 17 anos.
