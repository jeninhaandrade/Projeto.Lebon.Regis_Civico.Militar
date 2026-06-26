require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const bcrypt = require('bcrypt');
const db = require('./db'); 

async function testarConexao() {
    try {
        const [linhas] = await db.query('SELECT 1 + 1 AS resultado');
        console.log('--- BANCO DE DADOS CONECTADO COM SUCESSO (XAMPP) ---');
    } catch (error) {
        console.error('--- ERRO AO CONECTAR NO BANCO DE DADOS ---');
        console.error(error.message);
    }
}
testarConexao();

const app = express();

app.get('/teste-rota', (req, res) => {
  res.send("O servidor atualizou e a rota está funcionando!");
});

const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const HORARIO_LIMITE_PRESENCA = process.env.HORARIO_LIMITE_PRESENCA || '08:00';

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
  res.render('login', { titulo: 'Login', erro: null });
});

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const [linhas] = await db.query('SELECT * FROM usuarios WHERE login = ?', [login]);
    if (linhas.length === 0) {
      return res.render('login', { titulo: 'Login', erro: 'Login ou senha inválidos' });
    }
    const usuarioEncontrado = lines[0] || linhas[0];
    const senhaValida = await bcrypt.compare(password, usuarioEncontrado.senha);
    if (!senhaValida) {
      return res.render('login', { titulo: 'Login', erro: 'Login ou senha inválidos' });
    }
    req.session.usuario = {
      id: usuarioEncontrado.id,
      login: usuarioEncontrado.login,
      nome: usuarioEncontrado.nome
    };
    req.session.save(() => {
      return res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Erro ao realizar login no banco:', error);
    return res.render('login', { titulo: 'Login', erro: 'Erro interno do servidor ao processar o login.' });
  }
});

app.get('/cadastro', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }
  res.render('cadastro', { titulo: 'Cadastro', mensagem: null });
});

app.post('/cadastro', async (req, res) => {
  const { nome, cpf, usuario, senha } = req.body;
  try {
    const [usuariosExistentes] = await db.query(
      'SELECT id FROM usuarios WHERE login = ? OR cpf = ?',
      [usuario, cpf]
    );
    if (usuariosExistentes.length > 0) {
      return res.render('cadastro', { titulo: 'Cadastro', mensagem: 'Usuário ou CPF já cadastrado.' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, SALT_ROUNDS);
    await db.query(
      'INSERT INTO usuarios (nome, cpf, login, senha) VALUES (?, ?, ?, ?)',
      [nome, cpf, usuario, senhaCriptografada]
    );
    return res.redirect('/login');
  } catch (error) {
    console.error('Erro ao cadastrar usuário no banco:', error);
    return res.render('cadastro', { titulo: 'Cadastro', mensagem: 'Erro interno do servidor ao realizar o cadastro.' });
  }
});

app.get('/dashboard', verificarLogin, async (req, res) => {
  try {
    const [alunos] = await db.query('SELECT id FROM alunos WHERE ativo = 1');
    const [registros] = await db.query('SELECT * FROM registros_qrcode ORDER BY id DESC');
    res.render('dashboard', {
      titulo: 'Dashboard',
      activePage: 'dashboard',
      usuario: req.session.usuario,
      totalAlunos: alunos.length,
      totalPresencas: registros.length,
      registros: registros
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).send('Erro ao carregar o Dashboard.');
  }
});

app.get('/leitor-qrcode', (req, res) => {
  res.render('leitor-qrcode', { titulo: 'Leitor QR Code' });
});

app.get('/alunos', verificarLogin, async (req, res) => {
  const busca = req.query.busca || '';
  const ordem = req.query.ordem || '';
  try {
    let querySQL = 'SELECT * FROM alunos WHERE 1=1';
    let parametros = [];
    if (busca) {
      querySQL += ' AND (nome LIKE ? OR cpf LIKE ? OR matricula LIKE ?)';
      const termoBusca = `%${busca}%`;
      parametros.push(termoBusca, termoBusca, termoBusca);
    }
    if (ordem === 'az') {
      querySQL += ' ORDER BY nome ASC';
    } else if (ordem === 'za') {
      querySQL += ' ORDER BY nome DESC';
    }
    const [alunos] = await db.query(querySQL, parametros);
    const alunosFormatados = alunos.map(aluno => ({
      ...aluno,
      ativo: aluno.ativo === 1
    }));
    res.render('register_alunos', {
      titulo: 'Alunos',
      activePage: 'alunos',
      usuario: req.session.usuario,
      alunos: alunosFormatados,
      busca,
      ordem
    });
  } catch (error) {
    console.error('Erro ao buscar alunos no banco:', error);
    res.status(500).send('Erro interno ao carregar a listagem de alunos.');
  }
});

app.post('/alunos/cadastrar', verificarLogin, async (req, res) => {
  const { nome, cpf, matricula } = req.body;
  try {
    const [matriculaExiste] = await db.query('SELECT id FROM alunos WHERE matricula = ?', [matricula]);
    if (matriculaExiste.length > 0) {
      return res.redirect('/alunos?erro=matricula');
    }
    const criadoEm = new Date().toLocaleString('pt-BR');
    await db.query(
      'INSERT INTO alunos (nome, cpf, matricula, turma, ativo, criadoEm) VALUES (?, ?, ?, ?, 1, ?)',
      [nome, cpf, matricula, '', criadoEm]
    );
    return res.redirect('/alunos');
  } catch (error) {
    console.error('Erro ao cadastrar aluno no banco:', error);
    return res.redirect('/alunos?erro=servidor');
  }
});

app.post('/alunos/:id/desativar', verificarLogin, async (req, res) => {
  const { id } = req.params;
  const desativadoEm = new Date().toLocaleString('pt-BR');
  try {
    await db.query('UPDATE alunos SET ativo = 0, desativadoEm = ? WHERE id = ?', [desativadoEm, id]);
    return res.redirect('/alunos');
  } catch (error) {
    console.error('Erro ao desativar aluno:', error);
    return res.redirect('/alunos?erro=status');
  }
});

app.post('/alunos/:id/ativar', verificarLogin, async (req, res) => {
  const { id } = req.params;
  const reativadoEm = new Date().toLocaleString('pt-BR');
  try {
    await db.query('UPDATE alunos SET ativo = 1, reativadoEm = ? WHERE id = ?', [reativadoEm, id]);
    return res.redirect('/alunos');
  } catch (error) {
    console.error('Erro ao ativar aluno:', error);
    return res.redirect('/alunos?erro=status');
  }
});

app.post('/registrar-qrcode', async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) {
    return res.status(400).json({ sucesso: false, message: 'Código do QR Code não enviado.' });
  }
  try {
    const [alunos] = await db.query('SELECT * FROM alunos WHERE id = ? OR matricula = ?', [codigo, codigo]);
    if (alunos.length === 0) {
      return res.status(404).json({ sucesso: false, status: 'nao_encontrado', mensagem: 'Aluno não encontrado.' });
    }
    const alunoEncontrado = alunos[0];
    if (alunoEncontrado.ativo === 0) {
      return res.status(403).json({ sucesso: false, status: 'inativo', mensagem: 'Aluno inativo. Entrada não permitida.' });
    }
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    const [resultado] = await db.query(
      'INSERT INTO registros_qrcode (alunoId, nome, turma, status, dataHora) VALUES (?, ?, ?, "presente", ?)',
      [alunoEncontrado.id, alunoEncontrado.nome, alunoEncontrado.turma || '', dataHoraAtual]
    );
    const novoRegistro = {
      id: resultado.insertId,
      alunoId: alunoEncontrado.id,
      nome: alunoEncontrado.nome,
      turma: alunoEncontrado.turma || '',
      status: 'presente',
      dataHora: dataHoraAtual
    };
    return res.json({ sucesso: true, status: 'presente', mensagem: 'Entrada registrada com sucesso.', registro: novoRegistro });
  } catch (error) {
    console.error('Erro ao registrar QR Code no banco:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor ao registrar presença.' });
  }
});

app.get('/registros-qrcode', verificarLogin, async (req, res) => {
  try {
    const [registros] = await db.query('SELECT * FROM registros_qrcode ORDER BY id DESC');
    return res.json(registros);
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    return res.status(500).json([]);
  }
});

app.get('/presencas', verificarLogin, async (req, res) => {
  try {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const [alunosAtivos] = await db.query('SELECT * FROM alunos WHERE ativo = 1');
    const [todosRegistros] = await db.query('SELECT * FROM registros_qrcode ORDER BY id DESC');
    const presentesHoje = todosRegistros.filter(reg => reg.dataHora && reg.dataHora.startsWith(hoje));
    const idsPresentesHoje = presentesHoje.map(reg => String(reg.alunoId));
    const faltantesHoje = alunosAtivos.filter(aluno => !idsPresentesHoje.includes(String(aluno.id)));

    res.render('presencas', {
      titulo: 'Presenças',
      activePage: 'presencas',
      usuario: req.session.usuario,
      totalPresencas: todosRegistros.length,
      totalAlunos: alunosAtivos.length,
      totalPresentesHoje: presentesHoje.length,
      totalFaltantesHoje: faltantesHoje.length,
      registros: todosRegistros,
      faltantesHoje
    });
  } catch (error) {
    console.error('Erro ao carregar tela de presenças:', error);
    res.status(500).send('Erro interno ao carregar a página de presenças.');
  }
});

app.get('/pontuacoes', verificarLogin, async (req, res) => {
  try {
    const [alunos] = await db.query('SELECT id, nome, turma FROM alunos WHERE ativo = 1 ORDER BY nome ASC');
    const [pontuacoes] = await db.query(`
      SELECT p.*, a.nome AS nomeAluno, a.turma 
      FROM pontuacoes p
      INNER JOIN alunos a ON p.alunoId = a.id
      ORDER BY p.id DESC
    `);
    res.render('pontuacao', {
      titulo: 'Controle de Pontuação',
      activePage: 'pontuacoes',
      usuario: req.session.usuario,
      alunos,
      pontuacoes
    });
  } catch (error) {
    console.error('Erro ao carregar pontuacoes:', error);
    res.status(500).send('Erro interno ao carregar a página de pontuacoes.');
  }
});

app.post('/pontuacoes/salvar', verificarLogin, async (req, res) => {
  const { alunoId, pontos, motivo, tipo } = req.body;
  if (!alunoId || !pontos || !motivo || !tipo) {
    return res.redirect('/pontuacoes?erro=campos_obrigatorios');
  }
  try {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    const responsavel = req.session.usuario.nome || req.session.usuario.login;
    await db.query(
      'INSERT INTO pontuacoes (alunoId, pontos, motivo, tipo, responsavel, dataHora) VALUES (?, ?, ?, ?, ?, ?)',
      [alunoId, pontos, motivo, tipo, responsavel, dataHoraAtual]
    );
    return res.redirect('/pontuacoes');
  } catch (error) {
    console.error('Erro ao salvar pontuação no banco:', error);
    return res.redirect('/pontuacoes?erro=servidor');
  }
});

app.get('/advertencias', verificarLogin, async (req, res) => {
  try {
    const [advertencias] = await db.query(`
      SELECT adv.*, a.nome AS nomeAluno, a.turma 
      FROM advertencias adv
      INNER JOIN alunos a ON adv.alunoId = a.id
      ORDER BY adv.id DESC
    `);
    res.render('advertencias', {
      titulo: 'Advertências',
      activePage: 'advertencias',
      usuario: req.session.usuario,
      advertencias
    });
  } catch (error) {
    console.error('Erro ao carregar advertências:', error);
    res.status(500).send('Erro interno ao carregar a página de advertências.');
  }
});

app.get('/advertencias/nova', verificarLogin, async (req, res) => {
  try {
    const [alunos] = await db.query('SELECT id, nome, turma FROM alunos WHERE ativo = 1 ORDER BY nome ASC');
    res.render('cadastro-advertencia', { 
      titulo: 'Cadastrar Advertência', 
      activePage: 'advertencias', 
      usuario: req.session.usuario, 
      alunos 
    });
  } catch (error) {
    console.error('Erro ao abrir tela de nova advertência:', error);
    res.status(500).send('Erro ao abrir a tela de cadastro.');
  }
});

app.post('/advertencias/salvar', verificarLogin, async (req, res) => {
  const { alunoId, motivo } = req.body;
  if (!alunoId || !motivo) {
    return res.redirect('/advertencias/nova?erro=campos_obrigatorios');
  }
  try {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    const responsavel = req.session.usuario.nome || req.session.usuario.login;

    await db.query(
      'INSERT INTO advertencias (alunoId, motivo, responsavel, dataHora) VALUES (?, ?, ?, ?)',
      [alunoId, motivo, responsavel, dataHoraAtual]
    );
    return res.redirect('/advertencias');
  } catch (error) {
    console.error('Erro ao salvar advertência no banco:', error);
    return res.redirect('/advertencias/nova?erro=servidor');
  }
});

app.get('/advertencias/relatorio', verificarLogin, async (req, res) => {
  const { aluno, dataInicio, dataFim } = req.query;
  try {
    const [alunos] = await db.query('SELECT id, nome FROM alunos ORDER BY nome ASC');
    let querySQL = `
      SELECT adv.*, a.nome AS nomeAluno, a.turma 
      FROM advertencias adv
      INNER JOIN alunos a ON adv.alunoId = a.id
      WHERE 1=1
    `;
    let parametros = [];
    if (aluno) {
      querySQL += ' AND adv.alunoId = ?';
      parametros.push(aluno);
    }
    querySQL += ' ORDER BY adv.id DESC';
    const [advertencias] = await db.query(querySQL, parametros);

    res.render('relatorio_advertencias', {
      titulo: 'Relatório de Advertências',
      activePage: 'advertencias',
      usuario: req.session.usuario,
      alunos,
      advertencias,
      filtros: { aluno: aluno || '', dataInicio: dataInicio || '', dataFim: dataFim || '' },
      dataEmissao: new Date().toLocaleString('pt-BR')
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de advertências:', error);
    res.status(500).send('Erro ao processar o relatório.');
  }
});

app.get('/ocorrencias', verificarLogin, (req, res) => {
  res.render('ocorrencias', { titulo: 'Ocorrências', activePage: 'ocorrencias', usuario: req.session.usuario });
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
      rg: registro.rg || alunoEncontrado?.rg || '',
      turma: alunoEncontrado?.turma || '',
      dataHora: registro.dataHora || ''
    };
  });

  if (aluno) {
    relatorio = relatorio.filter(item =>
      item.nome.toLowerCase().includes(aluno.toLowerCase()) ||
      item.matricula.includes(aluno) ||
      String(item.rg || '').toLowerCase().includes(aluno.toLowerCase())
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