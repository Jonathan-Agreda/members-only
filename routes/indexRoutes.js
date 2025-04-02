const express = require("express");
const { body, validationResult } = require("express-validator");
const passport = require("passport");
const bcrypt = require("bcryptjs");

module.exports = (pool) => {
  const router = express.Router();

  // Home page
  router.get("/", async (req, res) => {
    try {
      const messages = await pool.query(`
        SELECT messages.*, users.username, users.membership_status, users.is_admin 
        FROM messages 
        JOIN users ON messages.user_id = users.id 
        ORDER BY messages.created_at DESC
      `);

      res.render("index", {
        messages: messages.rows,
        user: req.user,
      });
    } catch (err) {
      console.error("Error al obtener mensajes:", err);
      req.session.errors = [{ msg: "Error al cargar mensajes" }];
      res.redirect("/");
    }
  });

  // Registro
  router.get("/sign-up", (req, res) => {
    res.render("sign-up");
  });

  router.post(
    "/sign-up",
    [
      body("username").trim().isLength({ min: 3 }).escape(),
      body("password").isLength({ min: 6 }),
      body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password)
          throw new Error("Las contraseñas no coinciden");
        return true;
      }),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.session.errors = errors.array();
        return res.redirect("/sign-up");
      }

      try {
        const userExists = await pool.query(
          "SELECT * FROM users WHERE username = $1",
          [req.body.username]
        );

        if (userExists.rows.length > 0) {
          req.session.errors = [{ msg: "El usuario ya existe" }];
          return res.redirect("/sign-up");
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await pool.query(
          "INSERT INTO users (username, password) VALUES ($1, $2)",
          [req.body.username, hashedPassword]
        );

        req.session.messages = [
          { msg: "Registro exitoso. Por favor inicia sesión." },
        ];
        res.redirect("/log-in");
      } catch (err) {
        console.error("Error en registro:", err);
        req.session.errors = [{ msg: "Error en el registro" }];
        res.redirect("/sign-up");
      }
    }
  );

  // Inicio de sesión
  router.get("/log-in", (req, res) => {
    res.render("log-in");
  });

  router.post(
    "/log-in",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/log-in",
      failureFlash: true,
    })
  );

  // Cerrar sesión
  router.get("/log-out", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });

  // Unirse al club
  router.get("/join-club", (req, res) => {
    if (!req.user) return res.redirect("/log-in");
    res.render("join-club");
  });

  router.post(
    "/join-club",
    [body("secret").trim().escape()],
    async (req, res) => {
      if (!req.user) return res.redirect("/log-in");

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.session.errors = errors.array();
        return res.redirect("/join-club");
      }

      try {
        if (req.body.secret === process.env.MEMBERSHIP_SECRET) {
          await pool.query(
            "UPDATE users SET membership_status = $1 WHERE id = $2",
            ["member", req.user.id]
          );
          req.session.messages = [{ msg: "¡Ahora eres miembro!" }];
          return res.redirect("/");
        } else {
          req.session.errors = [{ msg: "Código incorrecto" }];
          return res.redirect("/join-club");
        }
      } catch (err) {
        console.error("Error al unirse al club:", err);
        req.session.errors = [{ msg: "Error al procesar la solicitud" }];
        res.redirect("/join-club");
      }
    }
  );

  // Convertirse en admin
  router.get("/become-admin", (req, res) => {
    if (!req.user) return res.redirect("/log-in");
    res.render("become-admin");
  });

  // Resto de rutas...

  return router;
};
