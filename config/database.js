const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Verificar conexión a la base de datos
pool
  .query("SELECT NOW()")
  .then(() => console.log("✅ Conexión a PostgreSQL establecida"))
  .catch((err) => console.error("❌ Error de conexión a PostgreSQL:", err));

module.exports = pool;
