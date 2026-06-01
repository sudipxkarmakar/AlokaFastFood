// routes/orders.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET orders (active by default)
router.get('/', async (req, res) => {
  try {
    const status = req.query.status;
    let query = 'SELECT * FROM orders';
    const params = [];
    if (status) { query += ' WHERE fulfillment_status=?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT 200';
    const [orders] = await db.query(query, params);
    const [items] = await db.query('SELECT * FROM order_items');
    const result = orders.map(o => ({
      ...o,
      items: items.filter(i => i.order_id === o.id)
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create order
router.post('/', async (req, res) => {
  const { id, customer_name, source, priority, subtotal, tax, total, commission, net_revenue, eta, items = [], payment_status } = req.body;
  try {
    await db.query(
      `INSERT INTO orders (id, customer_name, source, priority, subtotal, tax, total, commission, net_revenue, eta, fulfillment_status, payment_status, ts_accepted)
       VALUES (?,?,?,?,?,?,?,?,?,?,'ACCEPTED',?,NOW())`,
      [id, customer_name || 'Walk-In', source || 'DINE_IN', priority || 'NORMAL',
       subtotal, tax, total, commission || 0, net_revenue, eta, payment_status || 'UNPAID']
    );
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, variant_id, variant_name, quantity, unit_price, modifiers, status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, item.id, item.name, item.variant || null, item.variantName || null,
         item.quantity, item.unitPrice || 0, JSON.stringify(item.modifiers || []), 'PENDING']
      );
    }
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update order status
router.patch('/:id/status', async (req, res) => {
  const { fulfillment_status, payment_status } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (fulfillment_status) {
      updates.push('fulfillment_status=?'); vals.push(fulfillment_status);
      if (fulfillment_status === 'COOKING') { updates.push('ts_cooking=NOW()'); }
      if (fulfillment_status === 'READY') { updates.push('ts_ready=NOW()'); }
      if (fulfillment_status === 'COMPLETED') { updates.push('ts_completed=NOW()'); }
    }
    if (payment_status) { updates.push('payment_status=?'); vals.push(payment_status); }
    if (updates.length) {
      vals.push(req.params.id);
      await db.query(`UPDATE orders SET ${updates.join(',')} WHERE id=?`, vals);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET day closing report data
router.get('/day-close', async (req, res) => {
  try {
    const [completedOrders] = await db.query(
      "SELECT * FROM orders WHERE fulfillment_status='COMPLETED' OR payment_status='PAID'");
    const [allItems] = await db.query('SELECT oi.* FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE o.fulfillment_status=\'COMPLETED\' OR o.payment_status=\'PAID\'');
    const [expenses] = await db.query("SELECT SUM(cost) as total FROM expenses WHERE expense_date=CURDATE()");
    res.json({ orders: completedOrders, items: allItems, totalExpenses: expenses[0].total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST close the day
router.post('/day-close', async (req, res) => {
  const { date, order_count, revenue, expenses, net_profit, source_breakdown, item_sales, inventory_snapshot } = req.body;
  const reportId = 'REP-' + date;
  try {
    await db.query(
      `INSERT INTO day_history (id, report_date, order_count, revenue, expenses, net_profit, source_breakdown, item_sales, inventory_snapshot)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE order_count=?, revenue=?, expenses=?, net_profit=?`,
      [reportId, date, order_count, revenue, expenses, net_profit,
       JSON.stringify(source_breakdown), JSON.stringify(item_sales), JSON.stringify(inventory_snapshot),
       order_count, revenue, expenses, net_profit]
    );
    // Archive completed orders
    await db.query("UPDATE orders SET fulfillment_status='ARCHIVED' WHERE fulfillment_status='COMPLETED' OR payment_status='PAID'");
    res.json({ success: true, reportId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET day history
router.get('/day-history', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM day_history ORDER BY report_date DESC LIMIT 30');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY log_timestamp DESC LIMIT 200');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
