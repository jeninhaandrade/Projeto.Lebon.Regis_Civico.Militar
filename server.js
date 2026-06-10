require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const usersFilePath = path.join(__dirname, 'data', 'users.json');
const alunosPath = path.join(__dirname, 'data', 'alunos.json');
const registrosPath = path.join(__dirname,'data', 'registros-qrcode.json');
const pontuacoesPath = path.join(__dirname, 'data', 'pontuacoes.json');

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

function lerAlunos() {
  return lerJSON(alunosPath);
}

function salvarAlunos(alunos) {
  salvarJSON(alunosPath, alunos);
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

app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const usuarios = lerUsuarios();

  const usuarioEncontrado = usuarios.find(
    usuario => usuario.login === login && usuario.password === password
  );

  if (!usuarioEncontrado) {
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

app.post('/cadastro', (req, res) => {
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
    password: senha
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
    dataHora: new Date().toLocaleString('pt-BR')
  };

  registros.push(novoRegistro);
  salvarJSON(registrosPath, registros);

  return res.json({
    sucesso: true,
    status: 'concluido',
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
    usuario: req.session.usuario,
    alunos,
    pontuacoes
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