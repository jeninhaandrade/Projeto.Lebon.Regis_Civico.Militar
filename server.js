require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

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

// user teste
const usuarioMock = {
  email: 'admin@admin.com',
  senha: '123456',
  nome: 'admin'
};

// middleware protection
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


// tela de login
app.get('/login', (req, res) => {
  if (req.session.usuario) {
    return res.redirect('/dashboard');
  }

  res.render('login', {
    titulo: 'Login',
    erro: null
  });
});

// processamento de login
app.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (email === usuarioMock.email && senha === usuarioMock.senha) {
    req.session.usuario = {
      email: usuarioMock.email,
      nome: usuarioMock.nome
    };

    return res.redirect('/dashboard');
  }

  return res.render('login', {
    titulo: 'Login',
    erro: 'Email ou senha inválidos'
  });
});

// proteçao dahs
app.get('/dashboard', verificarLogin, (req, res) => {
  res.render('dashboard', {
    titulo: 'Dashboard',
    usuario: req.session.usuario
  });
});

// login
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});