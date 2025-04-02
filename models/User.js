const pool = require("../config/database");

module.exports = {
  async findById(id) {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
  },
  async findByUsername(username) {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    return result.rows[0];
  },
  async createUser(
    username,
    password,
    membership_status = "non-member",
    is_admin = false
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password, membership_status, is_admin) VALUES ($1, $2, $3, $4) RETURNING *",
      [username, hashedPassword, membership_status, is_admin]
    );
    return result.rows[0];
  },
};
