const express = require("express");
const { body, validationResult } = require("express-validator");
const passport = require("passport");
const bcrypt = require("bcryptjs");

module.exports = (pool) => {
  const router = express.Router();

  // Middleware para verificar autenticación
  const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.flash("error", "Por favor inicia sesión");
    res.redirect("/log-in");
  };

  // Middleware para verificar membresía
  const checkMembership = (req, res, next) => {
    if (req.user?.membership_status === "member" || req.user?.is_admin) {
      return next();
    }
    req.flash("error", "Debes ser miembro para ver esta información");
    res.redirect("/join-club");
  };

  // Home Page
  router.get("/", async (req, res) => {
    try {
      let query;
      let queryParams = [];

      if (req.user?.membership_status === "member" || req.user?.is_admin) {
        query = `
          SELECT m.*, u.username, u.membership_status, u.is_admin
          FROM messages m
          JOIN users u ON m.user_id = u.id
          ORDER BY m.created_at DESC
        `;
      } else {
        query =
          "SELECT id, content, created_at FROM messages ORDER BY created_at DESC";
      }

      const messages = await pool.query(query, queryParams);

      res.render("index", {
        messages: messages.rows,
        user: req.user,
        showAuthor:
          req.user?.membership_status === "member" || req.user?.is_admin,
        isAdmin: req.user?.is_admin,
      });
    } catch (err) {
      console.error("Error al cargar mensajes:", err);
      req.flash("error", "Error al cargar los mensajes");
      res.redirect("/");
    }
  });

  // Registro - GET
  router.get("/sign-up", (req, res) => {
    res.render("sign-up", {
      errors: req.flash("errors"),
      messages: req.flash("messages"),
    });
  });

  // Registro - POST
  // Registro - POST (versión optimizada)
  router.post(
    "/sign-up",
    [
      body("username")
        .trim()
        .isLength({ min: 3 })
        .withMessage("Usuario debe tener al menos 3 caracteres")
        .escape(),
      body("password")
        .isLength({ min: 6 })
        .withMessage("Contraseña debe tener al menos 6 caracteres"),
      body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Las contraseñas no coinciden");
        }
        return true;
      }),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/sign-up");
      }

      try {
        // Verificar si el usuario ya existe
        const userExists = await pool.query(
          "SELECT id FROM users WHERE username = $1",
          [req.body.username]
        );

        if (userExists.rows.length > 0) {
          req.flash("error", "El usuario ya existe");
          return res.redirect("/sign-up");
        }

        // Crear nuevo usuario
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await pool.query(
          "INSERT INTO users (username, password) VALUES ($1, $2)",
          [req.body.username, hashedPassword]
        );

        req.flash("success", "Registro exitoso. Por favor inicia sesión.");
        res.redirect("/log-in");
      } catch (err) {
        console.error("Error en registro:", err);
        req.flash("error", "Error al registrar usuario");
        res.redirect("/sign-up");
      }
    }
  );

  // Login - GET
  router.get("/log-in", (req, res) => {
    res.render("log-in", {
      error: req.flash("error")[0],
      messages: req.flash("messages"),
    });
  });

  // Login - POST (versión corregida)
  router.post("/log-in", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);

      if (!user) {
        // Redirección especial cuando el usuario no existe
        if (info.redirectTo) {
          return res.redirect(info.redirectTo);
        }
        // Para otros errores (como contraseña incorrecta)
        req.flash("error", info.message);
        return res.redirect("/log-in");
      }

      // Login exitoso
      req.logIn(user, (err) => {
        if (err) return next(err);

        // Verificar si el usuario es miembro o admin para redirección especial
        if (user.membership_status === "member" || user.is_admin) {
          return res.redirect("/");
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  // Logout
  router.get("/log-out", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Error al cerrar sesión:", err);
        return res.redirect("/");
      }
      req.flash("success", "Sesión cerrada correctamente");
      res.redirect("/");
    });
  });

  // Unirse al club - GET
  router.get("/join-club", ensureAuthenticated, (req, res) => {
    res.render("join-club", { error: req.flash("error")[0] });
  });

  // Unirse al club - POST
  router.post(
    "/join-club",
    [body("secret").trim().escape()],
    ensureAuthenticated,
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", "Código inválido");
        return res.redirect("/join-club");
      }

      try {
        if (req.body.secret === process.env.MEMBERSHIP_SECRET) {
          await pool.query(
            "UPDATE users SET membership_status = $1 WHERE id = $2",
            ["member", req.user.id]
          );
          req.flash("success", "¡Ahora eres miembro del club!");
        } else {
          req.flash("error", "Código secreto incorrecto");
        }
        res.redirect("/");
      } catch (err) {
        console.error("Error al unirse al club:", err);
        req.flash("error", "Error al procesar la solicitud");
        res.redirect("/join-club");
      }
    }
  );

  // Convertirse en admin - GET
  router.get("/become-admin", ensureAuthenticated, (req, res) => {
    res.render("become-admin", { error: req.flash("error")[0] });
  });

  // Convertirse en admin - POST
  router.post(
    "/become-admin",
    [body("adminSecret").trim().escape()],
    ensureAuthenticated,
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", "Código inválido");
        return res.redirect("/become-admin");
      }

      try {
        if (req.body.adminSecret === process.env.ADMIN_SECRET) {
          await pool.query("UPDATE users SET is_admin = true WHERE id = $1", [
            req.user.id,
          ]);
          req.flash("success", "¡Ahora eres administrador!");
        } else {
          req.flash("error", "Código de administrador incorrecto");
        }
        res.redirect("/");
      } catch (err) {
        console.error("Error al convertirse en admin:", err);
        req.flash("error", "Error al procesar la solicitud");
        res.redirect("/become-admin");
      }
    }
  );

  // Crear mensaje - POST
  router.post(
    "/create-message",
    [
      body("message")
        .trim()
        .isLength({ min: 1 })
        .withMessage("El mensaje no puede estar vacío")
        .escape(),
    ],
    ensureAuthenticated,
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect("/");
      }

      try {
        await pool.query(
          "INSERT INTO messages (user_id, content) VALUES ($1, $2)",
          [req.user.id, req.body.message]
        );
        res.redirect("/");
      } catch (err) {
        console.error("Error al crear mensaje:", err);
        req.flash("error", "Error al publicar el mensaje");
        res.redirect("/");
      }
    }
  );

  // Eliminar mensaje - POST (solo admin)
  router.post("/delete-message/:id", ensureAuthenticated, async (req, res) => {
    if (!req.user.is_admin) {
      req.flash("error", "No tienes permisos para esta acción");
      return res.redirect("/");
    }

    try {
      await pool.query("DELETE FROM messages WHERE id = $1", [req.params.id]);
      req.flash("success", "Mensaje eliminado");
      res.redirect("/");
    } catch (err) {
      console.error("Error al eliminar mensaje:", err);
      req.flash("error", "Error al eliminar el mensaje");
      res.redirect("/");
    }
  });

  return router;
};
