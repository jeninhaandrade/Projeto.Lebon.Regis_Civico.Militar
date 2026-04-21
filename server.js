require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// Usuário fixo para teste
const USER = {
  email: "admin@admin.com",
  password: "123456"
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo_padrao",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function authMiddleware(req, res, next) {
  if (req.session.usuarioLogado) {
    return next();
  }
  return res.redirect("/");
}

// Tela inicial de login
app.get("/", (req, res) => {
  if (req.session.usuarioLogado) {
    return res.redirect("/dashboard");
  }

  res.render("login", { erro: null });
});

// Processa login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === USER.email && password === USER.password) {
    req.session.usuarioLogado = true;
    req.session.email = email;
    return res.redirect("/dashboard");
  }


  return res.send(`
    <script>
      alert("Email ou senha inválidos!");
      window.location.href = "/";
    </script>
  `);
});

// Dashboard protegida
app.get("/dashboard", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

app.get("/cadastro", (req, res) => {
  res.render("cadastro", { mensagem: null });
});