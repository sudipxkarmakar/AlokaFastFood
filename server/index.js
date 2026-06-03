// index.js — AlokaFastFood Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded images as static files
app.use('/uploads', express.static(uploadsDir));

// Serve the frontend from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// Health check — also verifies DB connectivity
const db = require('./db');

// Auto-migration: ensure worker_stations and workers have required columns
(async () => {
  try {
    await db.query('ALTER TABLE worker_stations ADD COLUMN prep_time INT DEFAULT 3');
    console.log('[Auto-Migration] Added COLUMN prep_time to worker_stations');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE workers ADD COLUMN daily_salary INT DEFAULT 0');
    console.log('[Auto-Migration] Added COLUMN daily_salary to workers');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
})();

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// Routes
app.use('/api/stations',  require('./routes/stations'));
app.use('/api/menu',      require('./routes/menu'));
app.use('/api/workers',   require('./routes/workers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/expenses',  require('./routes/expenses'));
app.use('/api/orders',    require('./routes/orders'));

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start
app.listen(PORT, () => {
  console.log(`\n🍴 AlokaFastFood Server running at http://localhost:${PORT}`);
  console.log(`📊 API Base: http://localhost:${PORT}/api`);
  console.log(`🖼️  Uploads: http://localhost:${PORT}/uploads`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET/POST/DELETE  /api/stations`);
  console.log(`  GET/POST/PATCH/DELETE  /api/menu`);
  console.log(`  GET/POST/PATCH/DELETE  /api/workers`);
  console.log(`  GET/POST/PATCH  /api/inventory`);
  console.log(`  GET/POST  /api/expenses`);
  console.log(`  GET/POST/PATCH  /api/orders\n`);
});
