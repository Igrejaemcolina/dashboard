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

### Navegação por categorias

- Os cartões do painel principal exibem os totais gerais e, ao serem clicados, abrem uma nova aba com a página `category.html` filtrada para a faixa etária correspondente.
- As faixas utilizadas são:
  - Crianças: 0 a 10 anos
  - Adolescentes: 11 a 19 anos
  - Capitães: 20 a 29 anos
  - Valentes de Davi: 30 a 49 anos
  - Intendentes: 50 anos ou mais
- Cada página de categoria inclui um gráfico de distribuição de idades, a contagem de irmãos daquela faixa e cartões clicáveis com nome, idade calculada a partir da data de nascimento e telefone.
