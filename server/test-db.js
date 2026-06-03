// test-db.js — Quick DB connection check
const mysql = require('mysql2/promise');

(async () => {
  console.log('Testing MySQL connection...\n');

  // Step 1: Test credentials (no specific DB)
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'Aloka@1234',
    });
    console.log('✅ Credentials OK — root / Aloka@1234 works!');
  } catch (e) {
    console.error('❌ Credentials FAILED:', e.message);
    if (e.code === 'ECONNREFUSED') console.error('   → MySQL service is NOT running. Start MySQL80 in services.msc');
    if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('   → Wrong password. The reset may not have worked.');
    process.exit(1);
  }

  // Step 2: Check if database exists
  const [dbs] = await conn.query('SHOW DATABASES');
  const dbNames = dbs.map(r => Object.values(r)[0]);
  console.log('📦 Databases found:', dbNames.join(', '));

  const hasDb = dbNames.some(n => n.toLowerCase() === 'alokafastfood');
  if (!hasDb) {
    console.log('\n❌ Database "alokaFastFood" does NOT exist!');
    console.log('   → Creating it now...');
    await conn.query('CREATE DATABASE alokaFastFood');
    console.log('✅ Database "alokaFastFood" created!');
    console.log('   → Now run schema.sql in MySQL Workbench to create the tables.');
  } else {
    console.log('\n✅ Database "alokaFastFood" EXISTS');
    await conn.query('USE alokaFastFood');
    const [tables] = await conn.query('SHOW TABLES');
    const tNames = tables.map(r => Object.values(r)[0]);
    if (tNames.length === 0) {
      console.log('❌ No tables found! Run schema.sql in MySQL Workbench.');
    } else {
      console.log('✅ Tables:', tNames.join(', '));
      console.log('\n🎉 Everything looks good! The app should connect successfully.');
    }
  }

  await conn.end();
})();
