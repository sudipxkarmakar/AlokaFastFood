// Quick Supabase/PostgreSQL connection check. Requires DATABASE_URL.
const db = require('./db');

(async () => {
  try {
    const [rows] = await db.query('SELECT current_database() AS database, now() AS connected_at');
    console.log('PostgreSQL connection OK:', rows[0]);
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
