// db.js — MySQL2 connection pool
const mysql = require('mysql2/promise');

const connectionString = process.env.MYSQL_URL || process.env.DATABASE_URL;

let pool;
if (connectionString) {
  pool = mysql.createPool(connectionString);
} else {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Aloka@1234',
    database: process.env.DB_NAME || 'AlokaFastFood',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30'
  });
}

module.exports = pool;
