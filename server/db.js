// PostgreSQL connection pool with a small mysql2-compatible query interface.
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[Database] DATABASE_URL is not configured.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
    ? { rejectUnauthorized: false }
    : undefined,
  max: Number.parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 5,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000
});

function toPostgresSql(sql) {
  let parameterIndex = 0;

  return sql
    .replace(/\?/g, () => `$${++parameterIndex}`)
    .replace(/\bIFNULL\s*\(/gi, 'COALESCE(')
    .replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE')
    .replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/gi, 'ON CONFLICT DO UPDATE SET')
    .replace(/\bVALUES\s*\(\s*([a-z_][a-z0-9_]*)\s*\)/gi, 'EXCLUDED.$1');
}

async function query(sql, values = []) {
  const postgresSql = toPostgresSql(sql);
  const wasInsertIgnore = /\bINSERT\s+IGNORE\s+INTO\b/i.test(sql);
  const hasUpsert = /\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.test(sql);
  const finalSql = wasInsertIgnore && !hasUpsert
    ? `${postgresSql} ON CONFLICT DO NOTHING`
    : postgresSql;
  const result = await pool.query(finalSql, values);

  // Existing routes expect mysql2's [rows, metadata] tuple.
  if (Array.isArray(result)) {
    return [result.map(entry => entry.rows), result];
  }
  return [result.rows, result];
}

module.exports = { query, end: () => pool.end() };
