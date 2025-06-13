// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

// 使用 DATABASE_URL 字串連線（Render 推薦）
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Render 要加這行，否則連線會失敗
    },
});

module.exports = pool;
