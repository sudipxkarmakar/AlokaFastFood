// routes/workers.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all workers with their stations
router.get('/', async (req, res) => {
  try {
    const [workers] = await db.query('SELECT * FROM workers ORDER BY name');
    const [wStations] = await db.query('SELECT * FROM worker_stations');
    const result = workers.map(w => ({
      ...w,
      stations: wStations.filter(ws => ws.worker_id === w.id).map(ws => ws.station_id)
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add worker
router.post('/', async (req, res) => {
  const { name, stations = [], prep_time_per_item = 3 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = 'w_' + Date.now();
  try {
    await db.query('INSERT INTO workers (id, name, prep_time_per_item, active) VALUES (?,?,?,1)',
      [id, name, parseInt(prep_time_per_item)]);
    for (const stId of stations) {
      await db.query('INSERT IGNORE INTO worker_stations (worker_id, station_id) VALUES (?,?)', [id, stId]);
    }
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Add Worker', ?)", [`Added: ${name}`]);
    res.json({ id, name, prep_time_per_item, stations, active: 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update worker
router.patch('/:id', async (req, res) => {
  const { name, active, prep_time_per_item, stations } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (active !== undefined) { updates.push('active=?'); vals.push(active ? 1 : 0); }
    if (prep_time_per_item !== undefined) { updates.push('prep_time_per_item=?'); vals.push(parseInt(prep_time_per_item)); }
    if (name !== undefined) { updates.push('name=?'); vals.push(name.trim()); }
    if (updates.length) {
      vals.push(req.params.id);
      await db.query(`UPDATE workers SET ${updates.join(',')} WHERE id=?`, vals);
    }
    if (stations !== undefined) {
      await db.query('DELETE FROM worker_stations WHERE worker_id=?', [req.params.id]);
      for (const stId of stations) {
        await db.query('INSERT IGNORE INTO worker_stations (worker_id, station_id) VALUES (?,?)', [req.params.id, stId]);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE worker
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM workers WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
