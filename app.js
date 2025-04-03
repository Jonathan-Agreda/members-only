require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const passport = require("passport");
const flash = require("connect-flash");
const pool = require("./config/database");

process.removeAllListeners("warning");

const app = express();

// Configuración de la sesión
const sessionStore = new pgSession({
  pool: pool,
  tableName: "session",
  createTableIfMissing: true,
  pruneSessionInterval: 60,
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 120000,
      httpOnly: true,
      secure: true, // Solo HTTPS
      sameSite: "none", // Necesario si usas otro dominio frontend
    },
    rolling: true,
  })
);

// Configuración de Passport
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport, pool);

// Middleware para flash messages
app.use(flash());

// Middleware para variables globales
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error")[0];
  res.locals.success = req.flash("success")[0];
  res.locals.errors = req.flash("errors") || [];
  next();
});

// Configuración del motor de vistas
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Rutas
const indexRouter = require("./routes/indexRoutes")(pool);
app.use("/", indexRouter);

// Manejador de errores
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
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
