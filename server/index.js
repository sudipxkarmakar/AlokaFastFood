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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
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
