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

// Health check — also verifies DB connectivity
const db = require('./db');

// Auto-migration: ensure worker_stations and workers have required columns
(async () => {
  try {
    await db.query('ALTER TABLE orders ADD COLUMN ts_active DATETIME NULL DEFAULT NULL');
    console.log('[Auto-Migration] Added COLUMN ts_active to orders');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE orders MODIFY COLUMN ts_active DATETIME NULL DEFAULT NULL');
    console.log('[Auto-Migration] Modified ts_active to DATETIME to prevent implicit ON UPDATE updates');
  } catch (e) {
    console.warn('[Auto-Migration] ts_active DATETIME alter notice:', e.message);
  }
  try {
    await db.query('ALTER TABLE orders ADD COLUMN ts_queued DATETIME NULL DEFAULT NULL AFTER ts_active');
    console.log('[Auto-Migration] Added COLUMN ts_queued to orders');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('UPDATE orders SET ts_queued=COALESCE(ts_queued, ts_active, ts_accepted, created_at) WHERE fulfillment_status IN (\'ACCEPTED\', \'COOKING\', \'READY\')');
    console.log('[Auto-Migration] Backfilled ts_queued for active orders');
  } catch (e) {
    console.warn('[Auto-Migration] ts_queued backfill notice:', e.message);
  }
  try {
    await db.query("ALTER TABLE order_items ADD COLUMN type VARCHAR(32) DEFAULT 'DINE_IN'");
    console.log('[Auto-Migration] Added COLUMN type to order_items');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE order_items ADD COLUMN is_new TINYINT DEFAULT 0');
    console.log('[Auto-Migration] Added COLUMN is_new to order_items');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE stations ADD COLUMN current_worker_id VARCHAR(64) DEFAULT NULL');
    console.log('[Auto-Migration] Added COLUMN current_worker_id to stations');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE stations ADD CONSTRAINT fk_stations_current_worker FOREIGN KEY (current_worker_id) REFERENCES workers(id) ON DELETE SET NULL');
    console.log('[Auto-Migration] Added foreign key fk_stations_current_worker to stations');
  } catch (e) {
    if (e.code !== 'ER_FK_DUP_NAME' && e.code !== 'ER_DUP_KEYNAME' && !e.message.includes('already exists')) {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE menu_variants MODIFY COLUMN recipe_multiplier DECIMAL(10,4) DEFAULT 1.0');
    console.log('[Auto-Migration] Modified recipe_multiplier to DECIMAL(10,4) on menu_variants');
  } catch (e) {
    console.warn('[Auto-Migration] recipe_multiplier alter failed:', e.message);
  }
  try {
    await db.query('ALTER TABLE worker_stations ADD COLUMN prep_time INT DEFAULT 3');
    console.log('[Auto-Migration] Added COLUMN prep_time to worker_stations');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query('ALTER TABLE workers ADD COLUMN daily_salary INT DEFAULT 0');
    console.log('[Auto-Migration] Added COLUMN daily_salary to workers');
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query("UPDATE menu_variants SET name = 'Half' WHERE name = 'Half Portion'");
    await db.query("UPDATE menu_variants SET name = 'Full' WHERE name = 'Full Portion'");
    console.log("[Auto-Migration] Updated menu_variants names to Half/Full");
  } catch (e) {
    console.warn('[Auto-Migration] Notice:', e.message);
  }
  try {
    await db.query("ALTER TABLE menu_items ADD COLUMN food_type VARCHAR(20) DEFAULT 'non-veg'");
    console.log("[Auto-Migration] Added COLUMN food_type to menu_items");
    await db.query("UPDATE menu_items SET food_type = 'veg' WHERE id = 'veg_chowmein'");
    await db.query("UPDATE menu_items SET food_type = 'egg' WHERE id = 'egg_roll'");
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query("ALTER TABLE menu_items ADD COLUMN sort_order INT DEFAULT 0");
    console.log("[Auto-Migration] Added COLUMN sort_order to menu_items");
  } catch (e) {
    if (e.code !== 'ER_DUP_COLUMN_NAME') {
      console.warn('[Auto-Migration] Notice:', e.message);
    }
  }
  try {
    await db.query(
      `INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier)
       VALUES ('egg_roll_double_egg', 'egg_roll', 'Double Egg', 80.00, 1.0)`
    );
    console.log("[Auto-Migration] Added Double Egg variant for Egg Roll");
  } catch (e) {
    console.warn('[Auto-Migration] Egg Roll variant:', e.message);
  }

  try {
    // 1. Double Egg Chowmein
    await db.query("INSERT IGNORE INTO menu_items (id, name, station_id, prep_time, active, food_type, sort_order) VALUES ('double_egg_chowmein', 'Double Egg Chowmein', 'chilley', 4, 1, 'egg', 7)");
    await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES ('double_egg_chowmein_half', 'double_egg_chowmein', 'Half', 40.00, 1.0)");
    await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES ('double_egg_chowmein_full', 'double_egg_chowmein', 'Full', 55.00, 1.8)");
    
    // Seed recipe for Double Egg Chowmein
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_chowmein', 'chowmein_base', 'prepared', 1.0, 'portions')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_chowmein', 'egg', 'raw', 2.0, 'pcs')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_chowmein', 'onion', 'raw', 20.0, 'g')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_chowmein', 'capsicum', 'raw', 20.0, 'g')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_chowmein', 'sauce', 'raw', 10.0, 'g')");
    console.log("[Auto-Migration] Added Double Egg Chowmein with recipe");
  } catch (e) {
    console.warn('[Auto-Migration] Double Egg Chowmein:', e.message);
  }

  try {
    // 2. Double Egg Pasta
    await db.query("INSERT IGNORE INTO menu_items (id, name, station_id, prep_time, active, food_type, sort_order) VALUES ('double_egg_pasta', 'Double Egg Pasta', 'chilley', 4, 1, 'egg', 1)");
    await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES ('double_egg_pasta_half', 'double_egg_pasta', 'Half', 40.00, 1.0)");
    await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES ('double_egg_pasta_full', 'double_egg_pasta', 'Full', 60.00, 1.8)");
    
    // Seed recipe for Double Egg Pasta
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_pasta', 'pasta_base', 'prepared', 1.0, 'portions')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_pasta', 'egg', 'raw', 2.0, 'pcs')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_pasta', 'onion', 'raw', 10.0, 'g')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_pasta', 'capsicum', 'raw', 10.0, 'g')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_pasta', 'sauce', 'raw', 10.0, 'g')");
    console.log("[Auto-Migration] Added Double Egg Pasta with recipe");
  } catch (e) {
    console.warn('[Auto-Migration] Double Egg Pasta:', e.message);
  }

  try {
    // 3. Double Egg Roll
    await db.query("INSERT IGNORE INTO menu_items (id, name, station_id, prep_time, active, food_type, sort_order) VALUES ('double_egg_roll', 'Double Egg Roll', 'tawa', 3, 1, 'egg', 13)");
    await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES ('double_egg_roll_single', 'double_egg_roll', 'Single', 80.00, 1.0)");
    
    // Seed recipe for Double Egg Roll
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_roll', 'paratha_base', 'prepared', 1.0, 'pcs')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_roll', 'egg', 'raw', 2.0, 'pcs')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_roll', 'onion', 'raw', 20.0, 'g')");
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('double_egg_roll', 'sauce', 'raw', 10.0, 'g')");
    console.log("[Auto-Migration] Added Double Egg Roll with recipe");
  } catch (e) {
    console.warn('[Auto-Migration] Double Egg Roll:', e.message);
  }

  try {
    // Seed new raw/intermediate items
    await db.query("INSERT IGNORE INTO raw_ingredients (id, name, stock, reserved, min_stock, purchase_unit, stock_unit, conversion_factor, cost_per_purchase_unit, supplier) VALUES ('ghugni_peas', 'Ghugni Peas', 10000, 0, 2000, 'kg', 'g', 1000, 60, 'Sabji Mandi')");
    await db.query("INSERT IGNORE INTO raw_ingredients (id, name, stock, reserved, min_stock, purchase_unit, stock_unit, conversion_factor, cost_per_purchase_unit, supplier) VALUES ('chole_chana', 'Chole Chana', 10000, 0, 2000, 'kg', 'g', 1000, 80, 'Sabji Mandi')");
    await db.query("INSERT IGNORE INTO intermediate_stock (id, name, stock, reserved, min_stock, unit, item_type) VALUES ('ghugni_gravy', 'Ghugni Gravy', 5000, 0, 1000, 'g', 'intermediate')");
    await db.query("INSERT IGNORE INTO intermediate_stock (id, name, stock, reserved, min_stock, unit, item_type) VALUES ('chole_gravy', 'Chole Gravy', 5000, 0, 1000, 'g', 'intermediate')");
    await db.query("INSERT IGNORE INTO batch_recipes (id, name, unit, expected_yield_ratio, processing_type) VALUES ('ghugni_gravy', 'Ghugni Gravy', 'g', 1.0, 'direct')");
    await db.query("INSERT IGNORE INTO batch_recipes (id, name, unit, expected_yield_ratio, processing_type) VALUES ('chole_gravy', 'Chole Gravy', 'g', 1.0, 'direct')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('ghugni_gravy', 'ghugni_peas', 0.5, 'g')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('ghugni_gravy', 'onion', 0.1, 'g')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('ghugni_gravy', 'oil', 0.05, 'ml')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('ghugni_gravy', 'spices', 0.02, 'g')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('chole_gravy', 'chole_chana', 0.5, 'g')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('chole_gravy', 'onion', 0.1, 'g')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('chole_gravy', 'oil', 0.05, 'ml')");
    await db.query("INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES ('chole_gravy', 'spices', 0.02, 'g')");

    const newItems = [
      {
        id: 'veg_pasta', name: 'Veg Pasta', station: 'chilley', prep: 4, type: 'veg', order: 25,
        variants: [{ name: 'Half', price: 50.00, mult: 1.0 }, { name: 'Full', price: 90.00, mult: 1.8 }],
        recipe: [{ ing: 'pasta_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'onion', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_pasta', name: 'Egg Pasta', station: 'chilley', prep: 4, type: 'egg', order: 26,
        variants: [{ name: 'Half', price: 60.00, mult: 1.0 }, { name: 'Full', price: 100.00, mult: 1.8 }],
        recipe: [{ ing: 'pasta_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'onion', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'paneer_pasta', name: 'Paneer Pasta', station: 'chilley', prep: 4, type: 'veg', order: 27,
        variants: [{ name: 'Half', price: 80.00, mult: 1.0 }, { name: 'Full', price: 140.00, mult: 1.8 }],
        recipe: [{ ing: 'pasta_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'paneer_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_chicken_pasta', name: 'Egg Chicken Pasta', station: 'chilley', prep: 4, type: 'non-veg', order: 28,
        variants: [{ name: 'Half', price: 90.00, mult: 1.0 }, { name: 'Full', price: 150.00, mult: 1.8 }],
        recipe: [{ ing: 'pasta_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'chicken_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_paneer_pasta', name: 'Egg Paneer Pasta', station: 'chilley', prep: 4, type: 'non-veg', order: 29,
        variants: [{ name: 'Half', price: 90.00, mult: 1.0 }, { name: 'Full', price: 150.00, mult: 1.8 }],
        recipe: [{ ing: 'pasta_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'paneer_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 10.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_chowmein', name: 'Egg Chowmein', station: 'chilley', prep: 4, type: 'egg', order: 30,
        variants: [{ name: 'Half', price: 60.00, mult: 1.0 }, { name: 'Full', price: 100.00, mult: 1.8 }],
        recipe: [{ ing: 'chowmein_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'paneer_chowmein', name: 'Paneer Chowmein', station: 'chilley', prep: 4, type: 'veg', order: 31,
        variants: [{ name: 'Half', price: 80.00, mult: 1.0 }, { name: 'Full', price: 140.00, mult: 1.8 }],
        recipe: [{ ing: 'chowmein_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'paneer_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_chicken_chowmein', name: 'Egg Chicken Chowmein', station: 'chilley', prep: 4, type: 'non-veg', order: 32,
        variants: [{ name: 'Half', price: 80.00, mult: 1.0 }, { name: 'Full', price: 130.00, mult: 1.8 }],
        recipe: [{ ing: 'chowmein_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'chicken_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_paneer_chowmein', name: 'Egg Paneer Chowmein', station: 'chilley', prep: 4, type: 'non-veg', order: 33,
        variants: [{ name: 'Half', price: 90.00, mult: 1.0 }, { name: 'Full', price: 150.00, mult: 1.8 }],
        recipe: [{ ing: 'chowmein_base', qty: 1.0, type: 'prepared', unit: 'portions' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'paneer_keema', qty: 60.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'capsicum', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'veg_roll', name: 'Veg Roll', station: 'tawa', prep: 3, type: 'veg', order: 34,
        variants: [{ name: 'Single', price: 50.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'paneer_roll', name: 'Paneer Roll', station: 'tawa', prep: 3, type: 'veg', order: 35,
        variants: [{ name: 'Single', price: 80.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'paneer_keema', qty: 80.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_chicken_roll', name: 'Egg Chicken Roll', station: 'tawa', prep: 3, type: 'non-veg', order: 36,
        variants: [{ name: 'Single', price: 100.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'chicken_keema', qty: 80.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'egg_paneer_roll', name: 'Egg Paneer Roll', station: 'tawa', prep: 3, type: 'non-veg', order: 37,
        variants: [{ name: 'Single', price: 90.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'egg', qty: 1.0, type: 'raw', unit: 'pcs' }, { ing: 'paneer_keema', qty: 80.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }, { ing: 'sauce', qty: 10.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'chicken_paratha', name: 'Chicken Paratha', station: 'tawa', prep: 4, type: 'non-veg', order: 38,
        variants: [{ name: 'Single', price: 100.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'chicken_keema', qty: 80.0, type: 'intermediate', unit: 'g' }, { ing: 'onion', qty: 20.0, type: 'raw', unit: 'g' }]
      },
      {
        id: 'gogni_paratha', name: 'Gogni Paratha', station: 'tawa', prep: 4, type: 'veg', order: 39,
        variants: [{ name: 'Single', price: 60.00, mult: 1.0 }],
        recipe: [{ ing: 'paratha_base', qty: 1.0, type: 'prepared', unit: 'pcs' }, { ing: 'ghugni_gravy', qty: 150.0, type: 'intermediate', unit: 'g' }]
      },
      {
        id: 'chola_bhatura', name: 'Chola Bhatura', station: 'moghlai', prep: 4, type: 'veg', order: 40,
        variants: [{ name: 'Single', price: 80.00, mult: 1.0 }],
        recipe: [{ ing: 'flour', qty: 100.0, type: 'raw', unit: 'g' }, { ing: 'oil', qty: 30.0, type: 'raw', unit: 'ml' }, { ing: 'chole_gravy', qty: 150.0, type: 'intermediate', unit: 'g' }]
      }
    ];

    for (const item of newItems) {
      await db.query("INSERT IGNORE INTO menu_items (id, name, station_id, prep_time, active, food_type, sort_order) VALUES (?, ?, ?, ?, 1, ?, ?)", [item.id, item.name, item.station, item.prep, item.type, item.order]);
      for (const variant of item.variants) {
        const variantId = `${item.id}_${variant.name.toLowerCase()}`;
        await db.query("INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES (?, ?, ?, ?, ?)", [variantId, item.id, variant.name, variant.price, variant.mult]);
      }
      for (const ingredient of item.recipe) {
        await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES (?, ?, ?, ?, ?)", [item.id, ingredient.ing, ingredient.type, ingredient.qty, ingredient.unit]);
      }
    }
    console.log("[Auto-Migration] Seeded all new combinations and paratha varieties");
  } catch (e) {
    console.warn('[Auto-Migration] Error seeding new combinations:', e.message);
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS egg_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tracking_date DATE UNIQUE NOT NULL,
        opening_stock INT DEFAULT 0,
        purchased INT DEFAULT 0,
        rotten INT DEFAULT 0,
        used_in_prep INT DEFAULT 0,
        used_in_menu INT DEFAULT 0,
        closing_stock INT DEFAULT 0,
        recommended_price DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[Auto-Migration] Created egg_tracking table');
  } catch (e) {
    console.warn('[Auto-Migration] Error creating egg_tracking table:', e.message);
  }

  try {
    const [existingEgg] = await db.query("SELECT id FROM menu_items WHERE id='egg'");
    if (existingEgg.length === 0) {
      await db.query("INSERT INTO menu_items (id, name, station_id, prep_time, active, food_type, sort_order) VALUES ('egg', 'Egg', 'reception', 1, 1, 'egg', 50)");
      console.log('[Auto-Migration] Created menu item: Egg');
    }
    await db.query("INSERT IGNORE INTO menu_recipes (menu_item_id, ingredient_id, ingredient_type, quantity, unit) VALUES ('egg', 'egg', 'raw', 1.0, 'pcs')");

    const eggVariants = [
      { id: 'egg_1pc', name: '1 pc', price: 7.00, mult: 1.0 },
      { id: 'egg_12pc', name: '12 pc', price: 80.00, mult: 12.0 },
      { id: 'egg_15pc', name: '15 pc', price: 100.00, mult: 15.0 },
      { id: 'egg_tray', name: '1 Tray (30 pcs)', price: 190.00, mult: 30.0 },
      { id: 'egg_2tray', name: '2 Trays (60 pcs)', price: 370.00, mult: 60.0 },
      { id: 'egg_carton', name: '1 Carton (210 pcs)', price: 1250.00, mult: 210.0 }
    ];
    for (const ev of eggVariants) {
      await db.query(`
        INSERT INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier)
        VALUES (?, 'egg', ?, ?, ?)
        ON DUPLICATE KEY UPDATE recipe_multiplier=?
      `, [ev.id, ev.name, ev.price, ev.mult, ev.mult, ev.mult]);
    }
    console.log("[Auto-Migration] Seeded egg menu variants");
  } catch (e) {
    console.warn('[Auto-Migration] Error seeding egg menu variants:', e.message);
  }

  try {
    // Clean up unwanted chicken/paneer double egg items if they exist
    await db.query("DELETE FROM menu_items WHERE id IN ('double_egg_paneer_chowmein', 'double_egg_chicken_chowmein', 'double_egg_paneer_pasta', 'double_egg_chicken_pasta', 'double_egg_paneer_roll', 'double_egg_chicken_roll')");
  } catch (e) {
    console.warn('[Auto-Migration] Cleanup Double Egg Combos:', e.message);
  }
})();

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
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
