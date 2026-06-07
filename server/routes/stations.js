// routes/stations.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all stations
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM stations ORDER BY sort_order');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add station
router.post('/', async (req, res) => {
  const { id, name, base_capacity = 1 } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  try {
    const [result] = await db.query(
      'INSERT INTO stations (id, name, base_capacity) VALUES (?, ?, ?)',
      [id, name, base_capacity]
    );
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Add Station', ?)", [`Added station: ${name}`]);
    res.json({ id, name, base_capacity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE station
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM stations WHERE id = ?', [req.params.id]);
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Delete Station', ?)", [`Deleted station: ${req.params.id}`]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT assign staff to station
router.put('/:id/assign', async (req, res) => {
  const { worker_id } = req.body;
  const station_id = req.params.id;
  try {
    await db.query('UPDATE stations SET current_worker_id = ? WHERE id = ?', [worker_id || null, station_id]);
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Assign Station', ?)",
      [`Assigned worker ${worker_id || 'None'} to station ${station_id}`]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
