const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

module.exports = function (passport, pool) {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passReqToCallback: true, // Habilitar acceso al objeto req
      },
      async (req, username, password, done) => {
        try {
          const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
          );

          if (result.rows.length === 0) {
            req.flash("error", "Usuario no existe. Por favor regístrate.");
            return done(null, false, { redirectTo: "/sign-up" });
          }

          const user = result.rows[0];
          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            return done(null, false, { message: "Contraseña incorrecta" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Serialización del usuario
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialización del usuario
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query(
        "SELECT id, username, membership_status, is_admin FROM users WHERE id = $1",
        [id]
      );
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  });
};
