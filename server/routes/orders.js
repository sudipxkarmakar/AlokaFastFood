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
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Calculate staff wages for active workers
    const [activeWorkers] = await db.query('SELECT SUM(daily_salary) as total_wages FROM workers WHERE active=1');
    const staffWages = activeWorkers[0].total_wages || 0;
    
    // 2. Automatically log the staff wages as an expense for today
    if (staffWages > 0) {
      const expId = 'EXP-WAGE-' + Math.floor(1000 + Math.random() * 9000);
      await db.query(
        `INSERT INTO expenses (id, expense_date, item, quantity, unit, supplier, cost)
         VALUES (?,?,?,1,'day','Employee Payroll',?)`,
        [expId, today, 'Staff Wages (Checked-in)', staffWages]
      );
      await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Log Expense', ?)", [`Auto-logged checked-in staff wages: ₹${staffWages}`]);
    }

    // 3. Calculate completed orders revenue and count
    const [orders] = await db.query(
      "SELECT * FROM orders WHERE fulfillment_status='COMPLETED' OR payment_status='PAID'"
    );
    let revenue = 0;
    let orderCount = orders.length;
    let sourceBreakdown = { DINE_IN: 0, TAKEAWAY: 0, SWIGGY: 0, ZOMATO: 0, PHONE_ORDER: 0 };
    let itemSales = {};

    orders.forEach(o => {
      revenue += parseFloat(o.total || 0);
      sourceBreakdown[o.source] = (sourceBreakdown[o.source] || 0) + parseFloat(o.total || 0);
    });

    const [items] = await db.query(
      `SELECT oi.* FROM order_items oi 
       JOIN orders o ON oi.order_id=o.id 
       WHERE o.fulfillment_status='COMPLETED' OR o.payment_status='PAID'`
    );
    items.forEach(it => {
      itemSales[it.menu_item_id] = (itemSales[it.menu_item_id] || 0) + it.quantity;
    });

    // 4. Calculate total expenses for today (including the staff wages we just logged)
    const [expensesRow] = await db.query("SELECT SUM(cost) as total FROM expenses WHERE expense_date=?", [today]);
    const expenses = expensesRow[0].total || 0;
    const netProfit = revenue - expenses;

    // 5. Get inventory snapshots (current stock levels)
    const [rawInv] = await db.query("SELECT id, name, stock, reserved FROM raw_ingredients");
    const [interInv] = await db.query("SELECT id, name, stock, reserved, item_type FROM intermediate_stock");
    
    const inventorySnapshot = { raw: {}, intermediate: {}, prepared: {} };
    rawInv.forEach(r => { inventorySnapshot.raw[r.id] = { name: r.name, stock: r.stock }; });
    interInv.forEach(i => {
      const target = i.item_type === 'prepared' ? inventorySnapshot.prepared : inventorySnapshot.intermediate;
      target[i.id] = { name: i.name, stock: i.stock };
    });

    // 6. Insert day history
    const reportId = 'REP-' + today;
    await db.query(
      `INSERT INTO day_history (id, report_date, order_count, revenue, expenses, net_profit, source_breakdown, item_sales, inventory_snapshot)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE order_count=?, revenue=?, expenses=?, net_profit=?`,
      [reportId, today, orderCount, revenue, expenses, netProfit,
       JSON.stringify(sourceBreakdown), JSON.stringify(itemSales), JSON.stringify(inventorySnapshot),
       orderCount, revenue, expenses, netProfit]
    );

    // 7. Archive completed orders
    await db.query("UPDATE orders SET fulfillment_status='ARCHIVED' WHERE fulfillment_status='COMPLETED' OR payment_status='PAID'");
    
    res.json({ success: true, reportId, revenue, expenses, net_profit: netProfit });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
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

// PATCH update order item status
router.patch('/:id/items/:itemIndex/status', async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;
  const itemIndex = parseInt(req.params.itemIndex);
  try {
    const [items] = await db.query('SELECT id FROM order_items WHERE order_id=? ORDER BY id', [orderId]);
    if (items[itemIndex]) {
      await db.query('UPDATE order_items SET status=? WHERE id=?', [status, items[itemIndex].id]);
      
      if (status === 'COOKING') {
        await db.query('UPDATE orders SET fulfillment_status=?, ts_cooking=COALESCE(ts_cooking, NOW()) WHERE id=?', ['COOKING', orderId]);
      }
      
      const [allReadyRows] = await db.query(
        'SELECT COUNT(*) as unready FROM order_items WHERE order_id=? AND status!=?',
        [orderId, 'READY']
      );
      if (allReadyRows[0].unready === 0) {
        await db.query('UPDATE orders SET fulfillment_status=?, ts_ready=COALESCE(ts_ready, NOW()) WHERE id=?', ['READY', orderId]);
        await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Order Ready', ?)", [`All items in Order #${orderId} are ready to serve.`]);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Order Deleted', ?)", [`Order #${req.params.id} has been deleted.`]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
