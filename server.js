require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();

app.get('/teste-rota', (req, res) => {
  res.send("O servidor atualizou e a rota está funcionando!");
});

const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

const usersFilePath = path.join(__dirname, 'data', 'users.json');
const alunosPath = path.join(__dirname, 'data', 'alunos.json');
const registrosPath = path.join(__dirname, 'data', 'registros-qrcode.json');
const pontuacoesPath = path.join(__dirname, 'data', 'pontuacoes.json');
const advertenciasPath = path.join(__dirname, 'data', 'advertencias.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'minha_sessao_secreta',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function lerJSON(caminho) {
  try {
    if (!fs.existsSync(caminho)) {
      fs.writeFileSync(caminho, '[]', 'utf8');
    }

    const dados = fs.readFileSync(caminho, 'utf8');
    return JSON.parse(dados);
  } catch (error) {
    console.error('Erro ao ler JSON:', error);
    return [];
  }
}

function salvarJSON(caminho, dados) {
  try {
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar JSON:', error);
  }
}

function lerUsuarios() {
  return lerJSON(usersFilePath);
}

function salvarUsuarios(usuarios) {
  salvarJSON(usersFilePath, usuarios);
}

function senhaEstaComHash(senha) {
  return typeof senha === 'string' && senha.startsWith('$2');
}

function lerAlunos() {
  return lerJSON(alunosPath);
}

function salvarAlunos(alunos) {
  salvarJSON(alunosPath, alunos);
}

function obterDataAdvertencia(advertencia) {
  return advertencia.data || advertencia.dataHora || advertencia.criadoEm || '';
}

function converterDataFiltro(data) {
  if (!data) {
    return null;
  }

  const dataConvertida = new Date(`${data}T00:00:00`);
  return Number.isNaN(dataConvertida.getTime()) ? null : dataConvertida;
}

function converterDataAdvertencia(data) {
  if (!data) {
    return null;
  }

  const [dataParte] = String(data).split(/[,\s]/);
  const partes = dataParte.split('/');

  if (partes.length === 3) {
    const [dia, mes, ano] = partes;
    const dataConvertida = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    return Number.isNaN(dataConvertida.getTime()) ? null : dataConvertida;
  }

  const dataConvertida = new Date(data);
  return Number.isNaN(dataConvertida.getTime()) ? null : dataConvertida;
}

function verificarLogin(req, res, next) {
  if (req.session.usuario) {
    return next();
  }

  return res.redirect('/login');
}


app.get('/', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  res.render('login', {
    titulo: 'Login',
    erro: null
  });
});

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const usuarios = lerUsuarios();

  const usuarioEncontrado = usuarios.find(usuario => usuario.login === login);
  let senhaValida = false;

  if (usuarioEncontrado) {
    if (senhaEstaComHash(usuarioEncontrado.password)) {
      senhaValida = await bcrypt.compare(password, usuarioEncontrado.password);
    } else {
      senhaValida = usuarioEncontrado.password === password;

      if (senhaValida) {
        usuarioEncontrado.password = await bcrypt.hash(password, SALT_ROUNDS);
        salvarUsuarios(usuarios);
      }
    }
  }

  if (!usuarioEncontrado || !senhaValida) {
    return res.render('login', {
      titulo: 'Login',
      erro: 'Login ou senha inválidos'
    });
  }

  req.session.usuario = {
    login: usuarioEncontrado.login,
    nome: usuarioEncontrado.nome
  };

  req.session.save(() => {
    return res.redirect('/dashboard');
  });
});

//user
app.get('/cadastro', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  res.render('cadastro', {
    titulo: 'Cadastro',
    mensagem: null
  });
});

app.post('/cadastro', async (req, res) => {
  const { nome, cpf, usuario, senha } = req.body;
  const usuarios = lerUsuarios();

  const loginExistente = usuarios.find(
    item => item.login === usuario || item.cpf === cpf
  );

  if (loginExistente) {
    return res.render('cadastro', {
      titulo: 'Cadastro',
      mensagem: 'Usuário ou CPF já cadastrado.'
    });
  }

  const novoUsuario = {
    nome,
    cpf,
    login: usuario,
    password: await bcrypt.hash(senha, SALT_ROUNDS)
  };

  usuarios.push(novoUsuario);
  salvarUsuarios(usuarios);

  return res.redirect('/login');
});


app.get('/dashboard', verificarLogin, (req, res) => {
  const alunos = lerAlunos();
  const registros = lerJSON(registrosPath);

  const alunosAtivos = alunos.filter(aluno => aluno.ativo !== false);

  res.render('dashboard', {
    titulo: 'Dashboard',
    activePage: 'dashboard',
    usuario: req.session.usuario,
    totalAlunos: alunosAtivos.length,
    totalPresencas: registros.length,
    registros: registros.reverse()
  });
});


app.get('/leitor-qrcode', (req, res) => {
  res.render('leitor-qrcode', {
    titulo: 'Leitor QR Code'
  });
});


app.post('/registrar-qrcode', (req, res) => {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({
      sucesso: false,
      status: 'erro',
      mensagem: 'Código do QR Code não enviado.'
    });
  }

  const alunos = lerAlunos();

  const alunoEncontrado = alunos.find(
    aluno => String(aluno.id) === String(codigo) || aluno.matricula === codigo
  );

  if (!alunoEncontrado) {
    return res.status(404).json({
      sucesso: false,
      status: 'nao_encontrado',
      mensagem: 'Aluno não encontrado.'
    });
  }

  if (alunoEncontrado.ativo === false) {
    return res.status(403).json({
      sucesso: false,
      status: 'inativo',
      mensagem: 'Aluno inativo. Entrada não permitida.'
    });
  }

  const registros = lerJSON(registrosPath);

  const novoRegistro = {
    id: Date.now(),
    alunoId: alunoEncontrado.id,
    nome: alunoEncontrado.nome,
    turma: alunoEncontrado.turma || '',
    status: 'concluido',
    status: 'presente',

    dataHora: new Date().toLocaleString('pt-BR')
  };

  registros.push(novoRegistro);
  salvarJSON(registrosPath, registros);

  return res.json({
    sucesso: true,
    status: 'concluido',
    status: 'presente',
    mensagem: 'Entrada registrada com sucesso.',
    registro: novoRegistro
  });
});


app.get('/registros-qrcode', verificarLogin, (req, res) => {
  const registros = lerJSON(registrosPath);
  return res.json(registros);
});


app.get('/alunos', verificarLogin, (req, res) => {
  const busca = req.query.busca || '';
  const ordem = req.query.ordem || '';

  let alunos = lerAlunos();

  if (busca) {
    alunos = alunos.filter(aluno => {
      const nome = aluno.nome || '';
      const cpf = aluno.cpf || '';
      const matricula = aluno.matricula || '';

      return (
        nome.toLowerCase().includes(busca.toLowerCase()) ||
        cpf.includes(busca) ||
        matricula.toLowerCase().includes(busca.toLowerCase())
      );
    });
  }

  if (ordem === 'az') {
    alunos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }

  if (ordem === 'za') {
    alunos.sort((a, b) => (b.nome || '').localeCompare(a.nome || ''));
  }

  res.render('register_alunos', {
    titulo: 'Alunos',
    activePage: 'alunos',
    usuario: req.session.usuario,
    alunos,
    busca,
    ordem
  });
});


app.post('/alunos/cadastrar', verificarLogin, (req, res) => {
  const { nome, cpf, matricula } = req.body;

  const alunos = lerAlunos();

  const matriculaExiste = alunos.find(
    aluno => aluno.matricula === matricula
  );

  if (matriculaExiste) {
    return res.redirect('/alunos?erro=matricula');
  }

  const novoAluno = {
    id: String(Date.now()),
    nome,
    cpf,
    matricula,
    turma: '',
    ativo: true,
    criadoEm: new Date().toLocaleString('pt-BR')
  };

  alunos.push(novoAluno);
  salvarAlunos(alunos);

  return res.redirect('/alunos');
});


app.post('/alunos/:id/desativar', verificarLogin, (req, res) => {
  const { id } = req.params;
  const alunos = lerAlunos();

  const aluno = alunos.find(aluno => String(aluno.id) === String(id));

  if (aluno) {
    aluno.ativo = false;
    aluno.desativadoEm = new Date().toLocaleString('pt-BR');
  }

  salvarAlunos(alunos);
  return res.redirect('/alunos');
});


app.post('/alunos/:id/ativar', verificarLogin, (req, res) => {
  const { id } = req.params;
  const alunos = lerAlunos();

  const aluno = alunos.find(aluno => String(aluno.id) === String(id));

  if (aluno) {
    aluno.ativo = true;
    aluno.reativadoEm = new Date().toLocaleString('pt-BR');
  }

  salvarAlunos(alunos);
  return res.redirect('/alunos');
});


app.get('/pontuacoes', verificarLogin, (req, res) => {
  const alunos = lerAlunos();
  const pontuacoes = lerJSON(pontuacoesPath);

  res.render('pontuacao', {
    titulo: 'Controle de Pontuação',
    activePage: 'pontuacoes',
    usuario: req.session.usuario,
    alunos,
    pontuacoes
  });
});

let ocorrencias = [];

app.get('/ocorrencias', verificarLogin, (req, res) => {
  res.render('ocorrencias', {
    titulo: 'Ocorrências',
    activePage: 'ocorrencias',
    usuario: req.session.usuario,
    ocorrencias
  });
});


// Salvar ocorrência
app.post('/ocorrencias', (req, res) => {
  const { nomeAluno, tipo, descricao } = req.body;

  const novaOcorrencia = {
    id: Date.now(),
    nomeAluno,
    tipo,
    descricao,
    data: new Date().toLocaleDateString('pt-BR')
  };

  ocorrencias.push(novaOcorrencia);

  res.redirect('/ocorrencias');
});

// 1. Listagem de Advertências (Atualizada para ler os dados reais)
app.get('/advertencias', verificarLogin, (req, res) => {
  const advertencias = lerJSON(advertenciasPath);
  const alunos = lerAlunos();

  const listaAdvertencias = advertencias.map(adv => {
    const alunoEncontrado = alunos.find(a => String(a.id) === String(adv.alunoId));
    return {
      ...adv,
      nomeAluno: alunoEncontrado ? alunoEncontrado.nome : 'Aluno não encontrado',
      turma: alunoEncontrado ? alunoEncontrado.turma : ''
    };
  }).reverse();

  res.render('advertencias', {
    titulo: 'Advertências',
    activePage: 'advertencias',
    usuario: req.session.usuario,
    advertencias: listaAdvertencias
  });
});

// 2. Tela do Formulário de Cadastro de Advertência
app.get('/advertencias/nova', verificarLogin, (req, res) => {
  const alunos = lerAlunos();
  const alunosAtivos = alunos.filter(aluno => aluno.ativo !== false);

  res.render('cadastro-advertencia', {
    titulo: 'Cadastrar Advertência',
    activePage: 'advertencias',
    usuario: req.session.usuario,
    alunos: alunosAtivos
  });
});

// 3. Processamento do Formulário (Salvar no JSON)
app.post('/advertencias/salvar', verificarLogin, (req, res) => {
  const { alunoId, motivo } = req.body;

  if (!alunoId || !motivo) {
    return res.redirect('/advertencias/nova?erro=campos_obrigatorios');
  }

  const advertencias = lerJSON(advertenciasPath);

  const novaAdvertencia = {
    id: String(Date.now()),
    alunoId: alunoId,
    motivo: motivo,
    responsavel: req.session.usuario.nome || req.session.usuario.login,
    data: new Date().toLocaleString('pt-BR')
  };

  advertencias.push(novaAdvertencia);
  salvarJSON(advertenciasPath, advertencias);

  return res.redirect('/advertencias');
});

app.get('/advertencias/relatorio', verificarLogin, (req, res) => {
  const { aluno, dataInicio, dataFim } = req.query;
  const alunos = lerAlunos();
  const advertencias = lerJSON(advertenciasPath);
  const inicio = converterDataFiltro(dataInicio);
  const fim = converterDataFiltro(dataFim);

  if (fim) {
    fim.setHours(23, 59, 59, 999);
  }

  const advertenciasFormatadas = advertencias
    .map(advertencia => {
      const alunoReferencia = advertencia.alunoId || advertencia.idAluno || advertencia.aluno_id || advertencia.aluno;
      const alunoEncontrado = alunos.find(item =>
        String(item.id) === String(alunoReferencia) || item.nome === advertencia.aluno
      );

      return {
        ...advertencia,
        alunoId: alunoEncontrado?.id || alunoReferencia,
        data: obterDataAdvertencia(advertencia),
        nomeAluno: advertencia.nomeAluno || advertencia.aluno || alunoEncontrado?.nome || 'Aluno não informado',
        turma: advertencia.turma || alunoEncontrado?.turma || '',
        motivo: advertencia.motivo || advertencia.descricao || advertencia.observacao || '',
        responsavel: advertencia.responsavel || advertencia.professor || advertencia.usuario || ''
      };
    })
    .filter(advertencia => {
      const dataAdvertencia = converterDataAdvertencia(advertencia.data);
      const alunoCorresponde = !aluno || String(advertencia.alunoId) === String(aluno);
      const inicioCorresponde = !inicio || (dataAdvertencia && dataAdvertencia >= inicio);
      const fimCorresponde = !fim || (dataAdvertencia && dataAdvertencia <= fim);

      return alunoCorresponde && inicioCorresponde && fimCorresponde;
    });

  res.render('relatorio_advertencias', {
    titulo: 'Relatório de Advertências',
    activePage: 'advertencias',
    usuario: req.session.usuario,
    alunos,
    advertencias: advertenciasFormatadas,
    filtros: {
      aluno: aluno || '',
      dataInicio: dataInicio || '',
      dataFim: dataFim || ''
    },
    dataEmissao: new Date().toLocaleString('pt-BR')
  });
});

app.get('/presencas', verificarLogin, (req, res) => {
  const alunos = lerAlunos();
  const registros = lerJSON(registrosPath);

  const hoje = new Date().toLocaleDateString('pt-BR');


  const alunosAtivos = alunos.filter(
    aluno => aluno.ativo !== false
  );

  const presentesHoje = registros.filter(
    registro =>
      registro.dataHora &&
      registro.dataHora.startsWith(hoje)
  );

  const idsPresentesHoje = presentesHoje.map(
    registro => String(registro.alunoId)
  );

  const faltantesHoje = alunosAtivos.filter(
    aluno => !idsPresentesHoje.includes(String(aluno.id))
  );

  res.render('presencas', {
    titulo: 'Presenças',
    activePage: 'presencas',
    usuario: req.session.usuario,

    totalPresencas: registros.length,

    totalAlunos: alunosAtivos.length,
    totalPresentesHoje: presentesHoje.length,
    totalFaltantesHoje: faltantesHoje.length,

    registros: registros.reverse(),
    faltantesHoje
  });
});

app.get('/presencas/relatorio', verificarLogin, (req, res) => {
  const { aluno, dataInicio, dataFim, quantidadeFaltas } = req.query;
  const alunos = lerAlunos();
  const registros = lerJSON(registrosPath);

  const hoje = new Date().toLocaleDateString('pt-BR');

  const alunosAtivos = alunos.filter(aluno => aluno.ativo !== false);

  const faltasPorAluno = alunosAtivos.map(aluno => {
    const presencasAluno = registros.filter(
      registro =>
        String(registro.alunoId) === String(aluno.id)
    );

    return {
      ...aluno,
      quantidadeFaltas: presencasAluno.length === 0 ? 1 : 0
    };
  });

  let relatorio = registros.map(registro => {
    const alunoEncontrado = alunos.find(a => String(a.id) === String(registro.alunoId));

    return {
      ...registro,
      nome: registro.nome || alunoEncontrado?.nome || 'Aluno não encontrado',
      matricula: alunoEncontrado?.matricula || '',
      cpf: alunoEncontrado?.cpf || '',
      turma: alunoEncontrado?.turma || '',
      dataHora: registro.dataHora || ''
    };
  });

  if (aluno) {
    relatorio = relatorio.filter(item =>
      item.nome.toLowerCase().includes(aluno.toLowerCase()) ||
      item.matricula.includes(aluno) ||
      item.cpf.includes(aluno)
    );
  }

  if (dataInicio) {
    relatorio = relatorio.filter(item => {
      const dataRegistro = item.dataHora.split(',')[0];
      const [dia, mes, ano] = dataRegistro.split('/');
      return new Date(`${ano}-${mes}-${dia}`) >= new Date(`${dataInicio}T00:00:00`);
    });
  }

  if (dataFim) {
    relatorio = relatorio.filter(item => {
      const dataRegistro = item.dataHora.split(',')[0];
      const [dia, mes, ano] = dataRegistro.split('/');
      return new Date(`${ano}-${mes}-${dia}`) <= new Date(`${dataFim}T23:59:59`);
    });
  }

  if (quantidadeFaltas) {
    relatorio = relatorio.filter(item => {
      const alunoFalta = faltasPorAluno.find(
        aluno => String(aluno.id) === String(item.alunoId)
      );

      return (
        alunoFalta &&
        alunoFalta.quantidadeFaltas >= Number(quantidadeFaltas)
      );
    });
  }

  res.render('relatorio_presencas', {
    titulo: 'Relatório de Presenças',
    activePage: 'presencas',
    usuario: req.session.usuario,
    relatorio,
    filtros: {
      aluno: aluno || '',
      dataInicio: dataInicio || '',
      dataFim: dataFim || ''
    },
    dataEmissao: new Date().toLocaleString('pt-BR')
  });
});


app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
