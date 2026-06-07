// routes/expenses.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET expenses (supports ?date=YYYY-MM-DD, ?month=YYYY-MM, ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD, ?all=true, defaults to today)
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM expenses';
    const params = [];
    if (req.query.all === 'true') {
      // return all
    } else if (req.query.start_date && req.query.end_date) {
      query += ' WHERE expense_date BETWEEN ? AND ?';
      params.push(req.query.start_date, req.query.end_date);
    } else if (req.query.month) {
      query += ' WHERE expense_date LIKE ?';
      params.push(`${req.query.month}%`);
    } else {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      query += ' WHERE expense_date = ?';
      params.push(date);
    }
    query += ' ORDER BY expense_date DESC, created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all custom expense items (for dropdown)
router.get('/custom-items', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT item_name FROM custom_expense_items ORDER BY item_name');
    res.json(rows.map(r => r.item_name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all suppliers (for dropdown)
router.get('/suppliers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT supplier_name FROM custom_suppliers ORDER BY supplier_name');
    res.json(rows.map(r => r.supplier_name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add expense
router.post('/', async (req, res) => {
  const { expense_date, item_name, quantity = 1, unit = 'pcs', cost, supplier = '', raw_ingredient_id } = req.body;
  if (!item_name || !cost) return res.status(400).json({ error: 'item_name and cost required' });

  const expId = 'EXP-' + Math.floor(1000 + Math.random() * 9000) + '-' + Date.now();

  try {
    await db.query(
      'INSERT INTO expenses (id, expense_date, item_name, quantity, unit, cost, supplier, raw_ingredient_id) VALUES (?,?,?,?,?,?,?,?)',
      [expId, expense_date || new Date().toISOString().split('T')[0],
       item_name, parseFloat(quantity), unit, parseFloat(cost), supplier, raw_ingredient_id || null]
    );

    // If linked to raw ingredient, update its stock and price
    if (raw_ingredient_id) {
      const [[raw]] = await db.query('SELECT * FROM raw_ingredients WHERE id=?', [raw_ingredient_id]);
      if (raw) {
        let addedStock = parseFloat(quantity) * raw.conversion_factor;
        let newPrice = parseFloat(cost) / parseFloat(quantity);
        // Carton conversion for eggs
        if (raw_ingredient_id === 'egg' && unit === 'cartons') {
          addedStock = parseFloat(quantity) * 210;
          newPrice = parseFloat(cost) / (parseFloat(quantity) * 210);
        }
        await db.query(
          'UPDATE raw_ingredients SET stock=stock+?, cost_per_purchase_unit=? WHERE id=?',
          [addedStock, newPrice, raw_ingredient_id]
        );
        await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Inventory Purchase', ?)",
          [`Restocked ${item_name} +${quantity}${unit} at ₹${newPrice.toFixed(2)}/${raw.purchase_unit}`]);
      }
    } else {
      await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Log Expense', ?)",
        [`${item_name}: ₹${cost} from ${supplier}`]);
    }

    // Persist custom item name for future dropdown
    await db.query('INSERT IGNORE INTO custom_expense_items (item_name) VALUES (?)', [item_name]);
    // Persist supplier name
    if (supplier) {
      await db.query('INSERT IGNORE INTO custom_suppliers (supplier_name) VALUES (?)', [supplier]);
    }

    res.json({ success: true, id: expId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM expenses WHERE id=?', [id]);
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Delete Expense', ?)", [`Deleted expense log: ${id}`]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
