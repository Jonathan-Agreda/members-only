const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

module.exports = function (passport, pool) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const result = await pool.query(
          "SELECT * FROM users WHERE username = $1",
          [username]
        );
        const user = result.rows[0];

        if (!user)
          return done(null, false, { message: "Usuario no encontrado" });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid)
          return done(null, false, { message: "Contraseña incorrecta" });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [
        id,
      ]);
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  });
};
