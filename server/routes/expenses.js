// routes/expenses.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all expenses (today by default, or ?date=YYYY-MM-DD)
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(
      'SELECT * FROM expenses WHERE expense_date=? ORDER BY created_at DESC', [date]);
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
        const addedStock = parseFloat(quantity) * raw.conversion_factor;
        const newPrice = parseFloat(cost) / parseFloat(quantity);
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

module.exports = router;
