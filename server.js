require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const usersFilePath = path.join(__dirname, 'data', 'users.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'minha_sessao_secreta',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2
    }
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function lerUsuarios() {
  try {
    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(usersFilePath, '[]', 'utf8');
    }

    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler usuários:', error);
    return [];
  }
}

function salvarUsuarios(usuarios) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(usuarios, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar usuários:', error);
  }
}


function verificarLogin(req, res, next) {
  if (req.session.usuario) {
    return next();
  }
  return res.redirect('/login');
}

// rota inicial
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
    (usuario) => usuario.login === login && usuario.password === password
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

  return res.redirect('/dashboard');
});


app.get('/cadastro', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  res.render('cadastro', {
    titulo: 'Cadastro',
    mensagem: null
  });
});

//cadastro

app.post('/cadastro', (req, res) => {
  const { nome, cpf, usuario, senha } = req.body;

  const usuarios = lerUsuarios();

  const loginExistente = usuarios.find(
    (item) => item.login === usuario || item.cpf === cpf
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

  return res.redirect('/login'); // apos cadastro retorna pro login
});


app.get('/dashboard', verificarLogin, (req, res) => {
  res.render('dashboard', {
    titulo: 'Dashboard',
    usuario: req.session.usuario
  });
});

// logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});