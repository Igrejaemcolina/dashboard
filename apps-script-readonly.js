/**
 * Google Apps Script utilities to read and interpret the Serviços, Pais e Rede de Cuidado datasets
 * without modifying any source spreadsheet.
 *
 * All functions operate in read-only mode and return plain JavaScript objects so they can be easily
 * logged, returned by a web app, or consumed by other scripts.
 */

// === Configuration ===
const SERVICOS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQxT6NKzLoYEjJcVF-f-Z7llsdhxUHdB6ib3uHrhjnfO2jeD2NK0Ot5abJqSmNThoyt2WRh69yC3wPB/pub?gid=2086743732&single=true&output=csv';
const PAIS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKe0sITHUBQQ9maOOcKKgAPPdF7v_ZR8Qb1ZdbRLsC5gqeDyhXjOEwbrnronhTSnFPIhlf3_7u-g0O/pub?gid=821736003&single=true&output=csv';
const REDE_CUIDADO_SHEET_ID = '1XWYkdQTUHo5qhcnaYVpexxCxtL9Tifjm2tmDnT6ZTC4';
const REDE_CUIDADO_SHEET_NAME = 'Cadastrados da Rede de Cuidado';

// === Public API ===

/**
 * Lê a planilha publicada de serviços e retorna objetos com o nome e a lista de serviços.
 * @return {Array<{nome: string, servicos: string[]}>}
 */
function lerServicos() {
  const tabela = carregarCsvComoTabela_(SERVICOS_CSV_URL);
  if (!tabela.dados.length) {
    return [];
  }

  const idxNome = assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Nomes:');
  const idxServicos = assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Serviços');

  return tabela.dados
    .map((linha) => {
      const nome = limparTexto_(linha[idxNome]);
      const servicos = dividirServicos_(linha[idxServicos]);
      if (!nome && servicos.length === 0) {
        return null;
      }
      return { nome, servicos };
    })
    .filter(Boolean);
}

/**
 * Lista todos os serviços associados a uma pessoa específica.
 * @param {string} nome Nome a ser consultado.
 * @return {string[]}
 */
function listarServicosDe(nome) {
  if (!nome) {
    return [];
  }
  const alvo = normalizarBusca_(nome);
  return lerServicos()
    .filter((registro) => normalizarBusca_(registro.nome) === alvo)
    .flatMap((registro) => registro.servicos);
}

/**
 * Retorna quem serve um serviço informado.
 * @param {string} servico Serviço alvo.
 * @return {Array<{nome: string, servico: string}>}
 */
function listarQuemServe(servico) {
  if (!servico) {
    return [];
  }
  const alvo = normalizarBusca_(servico);
  const resultados = [];

  lerServicos().forEach((registro) => {
    registro.servicos.forEach((item) => {
      if (normalizarBusca_(item) === alvo) {
        resultados.push({ nome: registro.nome, servico: item });
      }
    });
  });

  return resultados;
}

/**
 * Lê a planilha publicada de Pais consolidando os campos de irmãos repetidos.
 * @return {Array<Object>}
 */
function lerPais() {
  const tabela = carregarCsvComoTabela_(PAIS_CSV_URL);
  if (!tabela.dados.length) {
    return [];
  }

  const idx = {
    adolescente: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Nome do Adolescente(a):'),
    nascAdolescente: assegurarCabecalhoObrigatorio_(
      tabela.cabecalhos,
      'Data de aniversário do Adolescente:'
    ),
    mae: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Nome da Mãe:'),
    nascMae: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Data de aniversário da Mãe:'),
    foneMae: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Telefone da Mãe:'),
    pai: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Nome do Pai:'),
    nascPai: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Data de aniversário do Pai'),
    fonePai: assegurarCabecalhoObrigatorio_(tabela.cabecalhos, 'Telefone do Pai:'),
    possuiIrmaos: assegurarCabecalhoObrigatorio_(
      tabela.cabecalhos,
      'O adolescente possui um irmão, ou mais irmãos?'
    ),
    irmaoParticipa: assegurarCabecalhoObrigatorio_(
      tabela.cabecalhos,
      'O irmão(a) do adolescente(a) participa das atividades da casa de adolescentes?'
    ),
    foneAdolescente: assegurarCabecalhoObrigatorio_(
      tabela.cabecalhos,
      'Telefone do adolescente:'
    ),
  };

  const idxIrmao = encontrarIndicesRepetidos_(tabela.cabecalhos, 'Nome do irmão(a):');
  const idxNascIrmao = encontrarIndicesRepetidos_(
    tabela.cabecalhos,
    'Data de nascimento do Irmão(a)'
  );

  return tabela.dados
    .map((linha) => {
      if (!linha || linha.length === 0 || linha.every((celula) => limparTexto_(celula) === '')) {
        return null;
      }

      return {
        adolescente: limparTexto_(linha[idx.adolescente]),
        nascAdolescente: limparTexto_(linha[idx.nascAdolescente]),
        mae: limparTexto_(linha[idx.mae]),
        nascMae: limparTexto_(linha[idx.nascMae]),
        foneMae: limparTexto_(linha[idx.foneMae]),
        pai: limparTexto_(linha[idx.pai]),
        nascPai: limparTexto_(linha[idx.nascPai]),
        fonePai: limparTexto_(linha[idx.fonePai]),
        possuiIrmaos: limparTexto_(linha[idx.possuiIrmaos]),
        irmaoParticipaNaCasa: limparTexto_(linha[idx.irmaoParticipa]),
        irmaos: comporCampoIrmaos_(linha, idxIrmao, idxNascIrmao),
        foneAdolescente: limparTexto_(linha[idx.foneAdolescente]),
      };
    })
    .filter(Boolean);
}

/**
 * Busca pais pelo nome (parcial) do adolescente.
 * @param {string} consulta Termo de busca.
 * @return {Array<Object>}
 */
function buscarPaisPorAdolescente(consulta) {
  if (!consulta) {
    return [];
  }
  const alvo = normalizarBusca_(consulta);
  return lerPais().filter((registro) =>
    normalizarBusca_(registro.adolescente).includes(alvo)
  );
}

/**
 * Lê a aba "Cadastrados da Rede de Cuidado" e devolve objetos com os campos definidos.
 * @return {Array<{nome: string, numero: string, bairro: string, ficouComKit: string, interessadoReunir: string, observacao: string, irmaoQueAbordou: string}>}
 */
function lerRedeDeCuidado() {
  const planilha = SpreadsheetApp.openById(REDE_CUIDADO_SHEET_ID);
  const aba = planilha.getSheetByName(REDE_CUIDADO_SHEET_NAME);
  if (!aba) {
    throw new Error('Aba "Cadastrados da Rede de Cuidado" não encontrada.');
  }

  const valores = aba.getDataRange().getValues();
  if (!valores.length) {
    return [];
  }

  const cabecalhos = valores[0].map(limparTexto_);
  const idx = {
    nome: assegurarCabecalhoObrigatorio_(cabecalhos, 'Nome Completo'),
    numero: assegurarCabecalhoObrigatorio_(cabecalhos, 'Número'),
    bairro: assegurarCabecalhoObrigatorio_(cabecalhos, 'Bairro abordado'),
    ficouComKit: assegurarCabecalhoObrigatorio_(cabecalhos, 'Ficou com o Kit?'),
    interessadoReunir: assegurarCabecalhoObrigatorio_(
      cabecalhos,
      'Se mostrou interessado em reunir?'
    ),
    observacao: assegurarCabecalhoObrigatorio_(cabecalhos, 'Observação sobre a pessoa:'),
    irmaoQueAbordou: assegurarCabecalhoObrigatorio_(cabecalhos, 'Irmão(a) que abordou'),
  };

  const registros = [];
  for (let i = 1; i < valores.length; i += 1) {
    const linha = valores[i] || [];
    if (linha.every((celula) => limparTexto_(celula) === '')) {
      continue;
    }

    registros.push({
      nome: limparTexto_(linha[idx.nome]),
      numero: limparTexto_(linha[idx.numero]),
      bairro: limparTexto_(linha[idx.bairro]),
      ficouComKit: limparTexto_(linha[idx.ficouComKit]),
      interessadoReunir: limparTexto_(linha[idx.interessadoReunir]),
      observacao: limparTexto_(linha[idx.observacao]),
      irmaoQueAbordou: limparTexto_(linha[idx.irmaoQueAbordou]),
    });
  }

  return registros;
}

// === Helpers ===

function carregarCsvComoTabela_(url) {
  if (!url) {
    return { cabecalhos: [], dados: [] };
  }

  const resposta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const status = resposta.getResponseCode();
  if (status !== 200) {
    throw new Error('Falha ao buscar CSV: HTTP ' + status);
  }

  const texto = resposta.getContentText();
  const linhas = Utilities.parseCsv(texto);
  if (!linhas || !linhas.length) {
    return { cabecalhos: [], dados: [] };
  }

  const cabecalhos = (linhas[0] || []).map(limparTexto_);
  const dados = linhas.slice(1);
  return { cabecalhos, dados };
}

function encontrarIndiceCabecalho_(cabecalhos, alvo) {
  const normalizado = limparTexto_(alvo);
  for (let i = 0; i < cabecalhos.length; i += 1) {
    if (cabecalhos[i] === normalizado) {
      return i;
    }
  }
  return -1;
}

function encontrarIndicesRepetidos_(cabecalhos, alvo) {
  const indices = [];
  const normalizado = limparTexto_(alvo);
  cabecalhos.forEach((cabecalho, indice) => {
    if (cabecalho === normalizado) {
      indices.push(indice);
    }
  });
  return indices;
}

function assegurarCabecalhoObrigatorio_(cabecalhos, nome) {
  const indice = encontrarIndiceCabecalho_(cabecalhos, nome);
  if (indice === -1) {
    throw new Error('Cabeçalho obrigatório não encontrado: "' + nome + '".');
  }
  return indice;
}

function limparTexto_(valor) {
  return valor == null ? '' : String(valor).trim();
}

function normalizarBusca_(valor) {
  return limparTexto_(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dividirServicos_(valor) {
  const texto = limparTexto_(valor);
  if (!texto) {
    return [];
  }
  return texto
    .split(/[\n;,]/)
    .map((item) => limparTexto_(item))
    .filter((item) => item !== '');
}

function comporCampoIrmaos_(linha, indicesNome, indicesData) {
  const partes = [];
  const total = Math.max(indicesNome.length, indicesData.length);
  for (let i = 0; i < total; i += 1) {
    const nome = limparTexto_(linha[indicesNome[i]]);
    const data = limparTexto_(linha[indicesData[i]]);
    if (!nome && !data) {
      continue;
    }
    partes.push(data ? nome + ' — ' + data : nome);
  }
  return partes.join('; ');
}
