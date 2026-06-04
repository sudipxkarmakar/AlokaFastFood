// routes/menu.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `menu_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET all menu items with variants and recipes
router.get('/', async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM menu_items ORDER BY sort_order, id');
    const [variants] = await db.query('SELECT * FROM menu_variants');
    const [recipes] = await db.query('SELECT * FROM menu_recipes');

    const result = items.map(item => ({
      ...item,
      variants: variants.filter(v => v.menu_item_id === item.id),
      recipe: recipes.filter(r => r.menu_item_id === item.id)
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create new menu item
router.post('/', upload.single('image'), async (req, res) => {
  const { id, name, station_id, prep_time = 3, active = 1 } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    await db.query(
      'INSERT INTO menu_items (id, name, station_id, prep_time, active, image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, station_id || null, parseInt(prep_time), active ? 1 : 0, image_path]
    );
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Add Menu Item', ?)", [`Added: ${name}`]);
    res.json({ id, name, station_id, prep_time, active, image_path });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update menu item fields (price, station, prepTime, active)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { station_id, prep_time, active, food_type } = req.body;
  try {
    const updates = [];
    const vals = [];
    if (station_id !== undefined) { updates.push('station_id=?'); vals.push(station_id); }
    if (prep_time !== undefined) { updates.push('prep_time=?'); vals.push(parseInt(prep_time)); }
    if (active !== undefined) { updates.push('active=?'); vals.push(active ? 1 : 0); }
    if (food_type !== undefined) { updates.push('food_type=?'); vals.push(food_type); }
    if (updates.length) {
      vals.push(id);
      await db.query(`UPDATE menu_items SET ${updates.join(',')} WHERE id=?`, vals);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH upload/replace image for item
router.patch('/:id/image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const image_path = `/uploads/${req.file.filename}`;
  try {
    await db.query('UPDATE menu_items SET image_path=? WHERE id=?', [image_path, req.params.id]);
    res.json({ image_path });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST reorder menu items
router.post('/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  try {
    for (let i = 0; i < order.length; i++) {
      await db.query('UPDATE menu_items SET sort_order=? WHERE id=?', [i, order[i]]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE menu item
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM menu_items WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Variants ---
// POST add variant to item
router.post('/:id/variants', async (req, res) => {
  const { variantId, name, price, recipe_multiplier = 1.0 } = req.body;
  try {
    await db.query(
      'INSERT INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES (?,?,?,?,?)',
      [variantId, req.params.id, name, parseFloat(price), parseFloat(recipe_multiplier)]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update variant price
router.patch('/:id/variants/:vid', async (req, res) => {
  const { price } = req.body;
  try {
    await db.query('UPDATE menu_variants SET price=? WHERE id=? AND menu_item_id=?',
      [parseFloat(price), req.params.vid, req.params.id]);
    await db.query("INSERT INTO audit_logs (action, payload) VALUES ('Price Change', ?)",
      [`Item ${req.params.id} variant ${req.params.vid} -> ₹${price}`]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Recipe ---
// GET item recipe
router.get('/:id/recipe', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_recipes WHERE menu_item_id=?', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update/add ingredient in recipe
router.put('/:id/recipe/:ingredientId', async (req, res) => {
  const { quantity, ingredient_type = 'intermediate', unit = 'g' } = req.body;
  const qty = parseFloat(quantity);
  try {
    if (qty <= 0) {
      await db.query('DELETE FROM menu_recipes WHERE menu_item_id=? AND ingredient_id=?',
        [req.params.id, req.params.ingredientId]);
    } else {
      await db.query(
        `INSERT INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE quantity=?, unit=?`,
        [req.params.id, req.params.ingredientId, ingredient_type, qty, unit, qty, unit]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
