// routes/inventory.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all raw ingredients
router.get('/raw', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM raw_ingredients ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add raw ingredient
router.post('/raw', async (req, res) => {
  const { id, name, stock = 0, min_stock = 0, purchase_unit = 'kg', stock_unit = 'g',
          conversion_factor = 1000, cost_per_purchase_unit = 0, supplier = '' } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  try {
    await db.query(
      `INSERT INTO raw_ingredients
       (id, name, stock, reserved, min_stock, purchase_unit, stock_unit, conversion_factor, cost_per_purchase_unit, supplier)
       VALUES (?,?,?,0,?,?,?,?,?,?)`,
      [id, name, parseFloat(stock), parseFloat(min_stock), purchase_unit, stock_unit,
       parseFloat(conversion_factor), parseFloat(cost_per_purchase_unit), supplier]
    );
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Add Raw Ingredient', ?)", [`Added: ${name}`]);
    res.json({ success: true, id, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update raw ingredient price / unit / stock
router.patch('/raw/:id', async (req, res) => {
  const { cost_per_purchase_unit, stock, min_stock, purchase_unit, stock_unit, conversion_factor, supplier } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (cost_per_purchase_unit !== undefined) { updates.push('cost_per_purchase_unit=?'); vals.push(parseFloat(cost_per_purchase_unit)); }
    if (stock !== undefined) { updates.push('stock=?'); vals.push(parseFloat(stock)); }
    if (min_stock !== undefined) { updates.push('min_stock=?'); vals.push(parseFloat(min_stock)); }
    if (purchase_unit !== undefined) { updates.push('purchase_unit=?'); vals.push(purchase_unit); }
    if (stock_unit !== undefined) { updates.push('stock_unit=?'); vals.push(stock_unit); }
    if (conversion_factor !== undefined) { updates.push('conversion_factor=?'); vals.push(parseFloat(conversion_factor)); }
    if (supplier !== undefined) { updates.push('supplier=?'); vals.push(supplier); }
    if (updates.length) {
      vals.push(req.params.id);
      await db.query(`UPDATE raw_ingredients SET ${updates.join(',')} WHERE id=?`, vals);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET intermediate/prepared stock
router.get('/intermediate', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM intermediate_stock ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update intermediate stock
router.patch('/intermediate/:id', async (req, res) => {
  const { stock, unit } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (stock !== undefined) { updates.push('stock=?'); vals.push(parseFloat(stock)); }
    if (unit !== undefined) { updates.push('unit=?'); vals.push(unit); }
    if (updates.length) {
      vals.push(req.params.id);
      await db.query(`UPDATE intermediate_stock SET ${updates.join(',')} WHERE id=?`, vals);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET batch recipes with their ingredients and stages
router.get('/batch-recipes', async (req, res) => {
  try {
    const [recipes] = await db.query('SELECT * FROM batch_recipes ORDER BY name');
    const [ingredients] = await db.query('SELECT * FROM batch_recipe_ingredients');
    const [stages] = await db.query('SELECT * FROM batch_processing_stages ORDER BY stage_order');

    const result = recipes.map(r => ({
      ...r,
      ingredients: ingredients.filter(i => i.batch_recipe_id === r.id),
      stages: stages.filter(s => s.batch_recipe_id === r.id)
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add batch recipe
router.post('/batch-recipes', async (req, res) => {
  const { id, name, unit = 'g', expected_yield_ratio = 1.0, processing_type = 'direct', ingredients = [], stages = [] } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  try {
    await db.query(
      'INSERT INTO batch_recipes (id, name, unit, expected_yield_ratio, processing_type) VALUES (?,?,?,?,?)',
      [id, name, unit, parseFloat(expected_yield_ratio), processing_type]
    );
    for (const ing of ingredients) {
      await db.query(
        'INSERT INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES (?,?,?,?)',
        [id, ing.raw_ingredient_id, parseFloat(ing.ratio_per_unit), ing.unit || 'g']
      );
    }
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await db.query(
        'INSERT INTO batch_processing_stages (batch_recipe_id, stage_order, stage_name, station_id, duration_min) VALUES (?,?,?,?,?)',
        [id, i + 1, s.stage_name, s.station_id || null, parseInt(s.duration_min || 0)]
      );
    }
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update batch recipe details (processing_type, stages)
router.patch('/batch-recipes/:id', async (req, res) => {
  const { processing_type, stages, fuel_type, fuel_cost } = req.body;
  try {
    if (processing_type !== undefined) {
      await db.query('UPDATE batch_recipes SET processing_type=? WHERE id=?', [processing_type, req.params.id]);
    }
    if (fuel_type !== undefined) {
      await db.query('UPDATE batch_recipes SET fuel_type=? WHERE id=?', [fuel_type, req.params.id]);
    }
    if (fuel_cost !== undefined) {
      await db.query('UPDATE batch_recipes SET fuel_cost=? WHERE id=?', [parseFloat(fuel_cost), req.params.id]);
    }
    if (stages !== undefined) {
      await db.query('DELETE FROM batch_processing_stages WHERE batch_recipe_id=?', [req.params.id]);
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await db.query(
          'INSERT INTO batch_processing_stages (batch_recipe_id, stage_order, stage_name, station_id, duration_min) VALUES (?,?,?,?,?)',
          [req.params.id, i + 1, s.stage_name, s.station_id || null, parseInt(s.duration_min || 0)]
        );
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update batch recipe ingredient
router.put('/batch-recipes/:id/ingredients/:rawId', async (req, res) => {
  const { ratio_per_unit, unit = 'g' } = req.body;
  const ratio = parseFloat(ratio_per_unit);
  try {
    if (ratio <= 0) {
      await db.query('DELETE FROM batch_recipe_ingredients WHERE batch_recipe_id=? AND raw_ingredient_id=?',
        [req.params.id, req.params.rawId]);
    } else {
      await db.query(
        `INSERT INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE ratio_per_unit=?, unit=?`,
        [req.params.id, req.params.rawId, ratio, unit, ratio, unit]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST log a batch production
router.post('/batch-produce', async (req, res) => {
  const { recipe_id, input_qty, actual_yield } = req.body;
  try {
    const [[recipe]] = await db.query('SELECT * FROM batch_recipes WHERE id=?', [recipe_id]);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const [ingredients] = await db.query(
      'SELECT * FROM batch_recipe_ingredients WHERE batch_recipe_id=?', [recipe_id]);
    if (!ingredients.length) return res.status(400).json({ error: 'No ingredients defined' });

    const primaryIng = ingredients[0];
    const expectedYield = parseFloat(input_qty) / primaryIng.ratio_per_unit;
    const actualY = parseFloat(actual_yield);

    // Deduct raw stock
    const scaledOutput = expectedYield;
    for (const ing of ingredients) {
      await db.query(
        'UPDATE raw_ingredients SET stock = GREATEST(0, stock - ?) WHERE id=?',
        [ing.ratio_per_unit * scaledOutput, ing.raw_ingredient_id]
      );
    }

    // Add to intermediate/prepared
    await db.query(
      'UPDATE intermediate_stock SET stock = stock + ? WHERE id=?',
      [actualY, recipe_id]
    );

    const yieldPct = expectedYield > 0 ? (actualY / expectedYield) * 100 : 0;
    const waste = Math.max(0, expectedYield - actualY);

    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Batch Production', ?)",
      [`Produced ${actualY} ${recipe.unit} of ${recipe.name}. Yield: ${yieldPct.toFixed(1)}%, Waste: ${waste.toFixed(1)}`]);

    res.json({ expected: expectedYield, actual: actualY, yieldPct, waste });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET egg tracking logs
router.get('/egg-tracking', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM egg_tracking ORDER BY tracking_date DESC LIMIT 90');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET calculate egg metrics for a specific date
router.get('/egg-tracking/calculate/:date', async (req, res) => {
  const { date } = req.params;
  try {
    // 1. Calculate opening stock from previous day's closing stock (if any)
    const [prevDay] = await db.query(
      'SELECT closing_stock FROM egg_tracking WHERE tracking_date < ? ORDER BY tracking_date DESC LIMIT 1',
      [date]
    );
    let openingStock = 0;
    if (prevDay.length > 0) {
      openingStock = prevDay[0].closing_stock;
    } else {
      // Fallback: get current stock if it's today
      const todayDate = new Date().toISOString().split('T')[0];
      if (date === todayDate) {
        const [[eggRaw]] = await db.query("SELECT stock FROM raw_ingredients WHERE id='egg'");
        openingStock = eggRaw ? Math.round(eggRaw.stock) : 120;
      } else {
        openingStock = 120; // default seed fallback
      }
    }

    // 2. Sum purchased eggs from expenses on this date
    const [purchaseRow] = await db.query(
      "SELECT SUM(cost) as total_cost, SUM(quantity) as qty, unit FROM expenses WHERE expense_date=? AND raw_ingredient_id='egg' GROUP BY unit",
      [date]
    );
    let purchasedEggs = 0;
    let purchaseCost = 0;
    purchaseRow.forEach(p => {
      if (p.unit === 'cartons') {
        purchasedEggs += p.qty * 210;
      } else if (p.unit === 'dozens') {
        purchasedEggs += p.qty * 12;
      } else {
        purchasedEggs += p.qty;
      }
      purchaseCost += p.total_cost || 0;
    });

    // 3. Calculate eggs used in menu items (direct egg variant sales + other menu items)
    // Note: mr.quantity is the ratio of eggs needed per unit item
    const [menuUsageRow] = await db.query(`
      SELECT SUM(oi.quantity * mr.quantity * IFNULL(mv.recipe_multiplier, 1.0)) AS eggs_used
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_recipes mr ON oi.menu_item_id = mr.menu_item_id
      LEFT JOIN menu_variants mv ON oi.variant_id = mv.id
      WHERE DATE(o.created_at) = ? 
        AND mr.ingredient_id = 'egg'
        AND oi.menu_item_id != 'egg'
        AND (o.fulfillment_status='COMPLETED' OR o.payment_status='PAID' OR o.fulfillment_status='ARCHIVED')
    `, [date]);

    const [directEggRow] = await db.query(`
      SELECT SUM(oi.quantity * IFNULL(mv.recipe_multiplier, 1.0)) AS eggs_used
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_variants mv ON oi.variant_id = mv.id
      WHERE DATE(o.created_at) = ? 
        AND oi.menu_item_id = 'egg'
        AND (o.fulfillment_status='COMPLETED' OR o.payment_status='PAID' OR o.fulfillment_status='ARCHIVED')
    `, [date]);

    const usedInMenu = directEggRow[0].eggs_used ? Math.round(directEggRow[0].eggs_used) : 0;
    const usedInPrep = menuUsageRow[0].eggs_used ? Math.round(menuUsageRow[0].eggs_used) : 0;

    // Get rotten count if logged already
    const [existingLog] = await db.query('SELECT * FROM egg_tracking WHERE tracking_date = ?', [date]);
    const rotten = existingLog.length > 0 ? existingLog[0].rotten : 0;

    const closingStock = Math.max(0, openingStock + purchasedEggs - rotten - usedInPrep - usedInMenu);

    res.json({
      tracking_date: date,
      opening_stock: openingStock,
      purchased: purchasedEggs,
      purchase_cost: purchaseCost,
      rotten: rotten,
      used_in_prep: usedInPrep,
      used_in_menu: usedInMenu,
      closing_stock: closingStock
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST save/upsert egg tracking
router.post('/egg-tracking', async (req, res) => {
  const { tracking_date, opening_stock, purchased, rotten, used_in_prep, used_in_menu, closing_stock, recommended_price } = req.body;
  if (!tracking_date) return res.status(400).json({ error: 'tracking_date required' });
  try {
    await db.query(`
      INSERT INTO egg_tracking 
      (tracking_date, opening_stock, purchased, rotten, used_in_prep, used_in_menu, closing_stock, recommended_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        opening_stock = VALUES(opening_stock),
        purchased = VALUES(purchased),
        rotten = VALUES(rotten),
        used_in_prep = VALUES(used_in_prep),
        used_in_menu = VALUES(used_in_menu),
        closing_stock = VALUES(closing_stock),
        recommended_price = VALUES(recommended_price)
    `, [tracking_date, opening_stock || 0, purchased || 0, rotten || 0, used_in_prep || 0, used_in_menu || 0, closing_stock || 0, recommended_price || 0.00]);

    // Update raw ingredient stock for egg if it is today
    const todayStr = new Date().toISOString().split('T')[0];
    if (tracking_date === todayStr) {
      await db.query("UPDATE raw_ingredients SET stock = ? WHERE id = 'egg'", [closing_stock]);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
