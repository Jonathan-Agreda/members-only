require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const passport = require("passport");
const pool = require("./config/database");
const { body, validationResult } = require("express-validator");

const app = express();

// Configuración de la sesión con connect-pg-simple
const sessionStore = new pgSession({
  pool: pool,
  tableName: "session",
  createTableIfMissing: true,
  pruneSessionInterval: 60, // 1 minuto en segundos
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 120000, // 2 minutos en milisegundos
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    rolling: true,
  })
);

// Configuración de Passport
require("./config/passport")(passport, pool);
app.use(passport.initialize());
app.use(passport.session());

// Configuración del motor de vistas EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Middleware para hacer pool disponible en las rutas
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

// Variables globales para vistas
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.errors = req.session.errors || [];
  res.locals.messages = req.session.messages || [];
  req.session.errors = [];
  req.session.messages = [];
  next();
});

// Rutas
const indexRouter = require("./routes/indexRoutes")(pool);
app.use("/", indexRouter);

// Manejador de errores
app.use((err, req, res, next) => {
  console.error("⚠️ Error:", err.stack);
  res.status(500).render("error", {
    error: {
      message: "Error interno del servidor",
      stack: process.env.NODE_ENV === "development" ? err.stack : null,
    },
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔑 Entorno: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
