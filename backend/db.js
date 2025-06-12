// backend/db.js - 新的 Postgres 版本

const { Pool } = require('pg'); // 從 pg 套件中引入 Pool，注意是大寫 P
require('dotenv').config();

// 建立 PostgreSQL 連線池
// Render 會自動提供一個 DATABASE_URL 環境變數，pg 套件可以直接使用它
// 在本地開發時，我們需要自己組合這個字串
const isProduction = process.env.NODE_ENV === 'production';

const connectionString = isProduction 
    ? process.env.DATABASE_URL 
    : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
    connectionString: connectionString,
    // 在 Render 上部署時，通常需要啟用 SSL
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

module.exports = pool;