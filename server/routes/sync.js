// routes/sync.js — Cloud to Local 2-Way Sync Engine
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/sync/export — Full data export snapshot
router.get('/export', async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders');
    const [orderItems] = await db.query('SELECT * FROM order_items');
    const [expenses] = await db.query('SELECT * FROM expenses');
    const [rawIngredients] = await db.query('SELECT * FROM raw_ingredients');
    const [intermediateStock] = await db.query('SELECT * FROM intermediate_stock');
    const [eggTracking] = await db.query('SELECT * FROM egg_tracking');
    const [dailyReports] = await db.query('SELECT * FROM daily_reports');

    res.json({
      timestamp: new Date().toISOString(),
      orders,
      orderItems,
      expenses,
      rawIngredients,
      intermediateStock,
      eggTracking,
      dailyReports
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/import — Import/merge data from cloud into local DB
router.post('/import', async (req, res) => {
  const { orders = [], orderItems = [], expenses = [], rawIngredients = [], eggTracking = [], dailyReports = [] } = req.body;

  try {
    let syncedOrdersCount = 0;
    let syncedExpensesCount = 0;

    // Sync Orders
    for (const o of orders) {
      await db.query(`
        INSERT INTO orders (id, customer_name, source, priority, subtotal, tax, total, commission, net_revenue, eta, fulfillment_status, payment_status, created_at, ts_active, ts_queued, ts_accepted, ts_cooking, ts_ready, ts_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          fulfillment_status = VALUES(fulfillment_status),
          payment_status = VALUES(payment_status),
          total = VALUES(total),
          ts_active = VALUES(ts_active),
          ts_completed = VALUES(ts_completed)
      `, [
        o.id, o.customer_name, o.source, o.priority, o.subtotal, o.tax, o.total, o.commission, o.net_revenue, o.eta,
        o.fulfillment_status, o.payment_status, o.created_at, o.ts_active, o.ts_queued, o.ts_accepted, o.ts_cooking, o.ts_ready, o.ts_completed
      ]);
      syncedOrdersCount++;
    }

    // Sync Order Items
    for (const it of orderItems) {
      await db.query(`
        INSERT INTO order_items (order_id, menu_item_id, menu_item_name, variant_id, variant_name, quantity, unit_price, modifiers, status, is_new, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          quantity = VALUES(quantity),
          unit_price = VALUES(unit_price)
      `, [
        it.order_id, it.menu_item_id, it.menu_item_name, it.variant_id, it.variant_name, it.quantity, it.unit_price,
        typeof it.modifiers === 'object' ? JSON.stringify(it.modifiers) : it.modifiers,
        it.status, it.is_new ? 1 : 0, it.type || 'DINE_IN'
      ]);
    }

    // Sync Expenses
    for (const exp of expenses) {
      await db.query(`
        INSERT INTO expenses (id, expense_date, item_name, quantity, unit, cost, supplier, raw_ingredient_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          cost = VALUES(cost),
          quantity = VALUES(quantity),
          supplier = VALUES(supplier)
      `, [
        exp.id, exp.expense_date, exp.item_name, exp.quantity, exp.unit, exp.cost, exp.supplier, exp.raw_ingredient_id
      ]);
      syncedExpensesCount++;
    }

    // Sync Raw Ingredients Stock
    for (const r of rawIngredients) {
      await db.query(`
        UPDATE raw_ingredients
        SET stock = ?, reserved = ?, cost_per_purchase_unit = ?
        WHERE id = ?
      `, [r.stock, r.reserved, r.cost_per_purchase_unit, r.id]);
    }

    // Sync Egg Tracking
    for (const e of eggTracking) {
      await db.query(`
        INSERT INTO egg_tracking (log_date, opening_stock, purchased_stock, rotten_count, prep_consumed, raw_sold_count, closing_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          rotten_count = VALUES(rotten_count),
          closing_stock = VALUES(closing_stock)
      `, [e.log_date, e.opening_stock, e.purchased_stock, e.rotten_count, e.prep_consumed, e.raw_sold_count, e.closing_stock]);
    }

    // Sync Daily Reports
    for (const dr of dailyReports) {
      await db.query(`
        INSERT INTO daily_reports (report_date, order_count, revenue, expenses, net_profit)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          order_count = VALUES(order_count),
          revenue = VALUES(revenue),
          expenses = VALUES(expenses),
          net_profit = VALUES(net_profit)
      `, [dr.report_date, dr.order_count, dr.revenue, dr.expenses, dr.net_profit]);
    }

    res.json({
      status: 'ok',
      message: `Successfully synced ${syncedOrdersCount} orders and ${syncedExpensesCount} expenses from cloud database!`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync Import Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
