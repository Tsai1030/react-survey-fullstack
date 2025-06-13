// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Create a PostgreSQL connection pool. Use DATABASE_URL if provided (e.g. on
// Render) and enable SSL in production.
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl:
                  process.env.NODE_ENV === 'production'
                      ? { rejectUnauthorized: false }
                      : false,
          }
        : {
              host: process.env.DB_HOST,
              port: process.env.DB_PORT || 5432,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
          }
);
module.exports = pool;
