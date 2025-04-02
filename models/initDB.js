const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Obligatorio para Render
});

async function initDB() {
  try {
    // 1. Crear tabla 'users' (nueva, independiente de 'usuarios')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        membership_status VARCHAR(20) DEFAULT 'non-member',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Crear tabla 'messages' (nueva)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. La tabla 'session' será creada automáticamente por connect-pg-simple
    console.log("✅ Tablas nuevas (users, messages) creadas exitosamente");
  } catch (err) {
    console.error("❌ Error al crear tablas:", err.message);
  } finally {
    await pool.end(); // Cierra la conexión
  }
}

initDB();
