-- ============================================================
-- AlokaFastFood Database Schema
-- Run against: alokaFastFood database
-- MySQL 8+
-- ============================================================

USE alokaFastFood;

-- ============================================================
-- STATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  base_capacity INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO stations (id, name, base_capacity, sort_order) VALUES
  ('tawa',        'Tawa',         1, 1),
  ('prep',        'Prep',         1, 2),
  ('reception',   'Reception',    1, 3),
  ('deep_fry',    'Deep Fry',     1, 4),
  ('kosha',       'Kosha',        1, 5),
  ('chilley',     'Chilley',      1, 6),
  ('moghlai',     'Moghlai',      1, 7),
  ('moghlai_tawa','Moghlai Tawa', 1, 8),
  ('cleaner',     'Cleaner',      1, 9),
  ('server',      'Server',       1, 10);

-- ============================================================
-- MENU ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  station_id VARCHAR(64),
  prep_time INT DEFAULT 3,
  active TINYINT(1) DEFAULT 1,
  image_path VARCHAR(255) DEFAULT NULL,
  food_type VARCHAR(20) DEFAULT 'non-veg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS menu_variants (
  id VARCHAR(64) PRIMARY KEY,
  menu_item_id VARCHAR(64) NOT NULL,
  name VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  recipe_multiplier DECIMAL(6,4) DEFAULT 1.0,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- ============================================================
-- RAW INGREDIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_ingredients (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  stock DECIMAL(12,4) DEFAULT 0,
  reserved DECIMAL(12,4) DEFAULT 0,
  min_stock DECIMAL(12,4) DEFAULT 0,
  purchase_unit VARCHAR(20) DEFAULT 'kg',
  stock_unit VARCHAR(20) DEFAULT 'g',
  conversion_factor DECIMAL(10,4) DEFAULT 1000,
  cost_per_purchase_unit DECIMAL(10,4) DEFAULT 0,
  supplier VARCHAR(120) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO raw_ingredients (id, name, stock, reserved, min_stock, purchase_unit, stock_unit, conversion_factor, cost_per_purchase_unit, supplier) VALUES
  ('raw_chicken', 'Raw Chicken',         0, 0, 5000,  'kg', 'g',   1000, 220,  'Apex Poultry'),
  ('paneer',      'Paneer',              0, 0, 2000,  'kg', 'g',   1000, 350,  'Maa Dairy'),
  ('flour',       'Flour',               0, 0, 10000, 'kg', 'g',   1000, 40,   'Ganesh Flour Mill'),
  ('egg',         'Egg',                 0, 0, 30,    'pcs','pcs', 1,    6,    'Egg Vendor'),
  ('oil',         'Cooking Oil',         0, 0, 3000,  'L',  'ml',  1000, 140,  'Fortune Retail'),
  ('onion',       'Onions',              0, 0, 3000,  'kg', 'g',   1000, 40,   'Sabji Mandi'),
  ('capsicum',    'Capsicum',            0, 0, 1500,  'kg', 'g',   1000, 80,   'Sabji Mandi'),
  ('noodles',     'Raw Noodles',         0, 0, 2000,  'kg', 'g',   1000, 60,   'Chong noodles'),
  ('pasta',       'Raw Pasta',           0, 0, 2000,  'kg', 'g',   1000, 80,   'Fortune Retail'),
  ('cheese',      'Cheese Block',        0, 0, 1000,  'kg', 'g',   1000, 400,  'Amul Store'),
  ('spices',      'Mix Spices',          0, 0, 500,   'kg', 'g',   1000, 300,  'Sunrise Spices'),
  ('sauce',       'Sauces & Condiments', 0, 0, 1000,  'kg', 'g',   1000, 80,   'Kissan Depot'),
  ('ghugni_peas', 'Ghugni Peas',         0, 0, 2000,  'kg', 'g',   1000, 60,   'Sabji Mandi'),
  ('chole_chana', 'Chole Chana',         0, 0, 2000,  'kg', 'g',   1000, 80,   'Sabji Mandi');

-- ============================================================
-- INTERMEDIATE & PREPARED STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS intermediate_stock (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  stock DECIMAL(12,4) DEFAULT 0,
  reserved DECIMAL(12,4) DEFAULT 0,
  min_stock DECIMAL(12,4) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'g',
  item_type ENUM('intermediate','prepared') DEFAULT 'intermediate',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO intermediate_stock (id, name, stock, reserved, min_stock, unit, item_type) VALUES
  ('chicken_keema',       'Chicken Keema',          0, 0, 1500, 'g',       'intermediate'),
  ('paneer_keema',        'Paneer Keema',            0, 0, 1000, 'g',       'intermediate'),
  ('chicken_kosha_gravy', 'Chicken Kosha Gravy',     0,   0, 5,    'portions','intermediate'),
  ('pakora_mixture',      'Chicken Pakora Mixture',  0, 0, 1000, 'g',       'intermediate'),
  ('paratha_base',        'Paratha Base',            0,  0, 30,   'pcs',     'prepared'),
  ('mughlai_dough',       'Mughlai Dough',           0,  0, 10,   'pcs',     'prepared'),
  ('chowmein_base',       'Chowmein Base',           0,  0, 10,   'portions','prepared'),
  ('pasta_base',          'Pasta Base',              0,  0, 10,   'portions','prepared'),
  ('ghugni_gravy',        'Ghugni Gravy',            0, 0, 1000, 'g',       'intermediate'),
  ('chole_gravy',         'Chole Gravy',             0, 0, 1000, 'g',       'intermediate');

-- ============================================================
-- BATCH RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_recipes (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  unit VARCHAR(20) DEFAULT 'g',
  expected_yield_ratio DECIMAL(6,4) DEFAULT 1.0,
  processing_type ENUM('direct','staged') DEFAULT 'direct',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_recipe_id VARCHAR(64) NOT NULL,
  raw_ingredient_id VARCHAR(64) NOT NULL,
  ratio_per_unit DECIMAL(10,6) NOT NULL,
  unit VARCHAR(20) DEFAULT 'g',
  FOREIGN KEY (batch_recipe_id) REFERENCES batch_recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batch_processing_stages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_recipe_id VARCHAR(64) NOT NULL,
  stage_order INT NOT NULL,
  stage_name VARCHAR(80) NOT NULL,
  station_id VARCHAR(64),
  duration_min INT DEFAULT 0,
  FOREIGN KEY (batch_recipe_id) REFERENCES batch_recipes(id) ON DELETE CASCADE
);

INSERT IGNORE INTO batch_recipes (id, name, unit, expected_yield_ratio, processing_type) VALUES
  ('chicken_keema',       'Chicken Keema',          'g',       0.80, 'direct'),
  ('paneer_keema',        'Paneer Keema',            'g',       0.95, 'direct'),
  ('chicken_kosha_gravy', 'Chicken Kosha Gravy',     'portions',1.00, 'direct'),
  ('pakora_mixture',      'Chicken Pakora Mixture',  'g',       0.90, 'staged'),
  ('paratha_base',        'Paratha Base',            'pcs',     1.00, 'direct'),
  ('mughlai_dough',       'Mughlai Dough',           'pcs',     1.00, 'direct'),
  ('chowmein_base',       'Chowmein Base',           'portions',1.00, 'direct'),
  ('pasta_base',          'Pasta Base',              'portions',1.00, 'direct'),
  ('ghugni_gravy',        'Ghugni Gravy',            'g',       1.00, 'direct'),
  ('chole_gravy',         'Chole Gravy',             'g',       1.00, 'direct');

INSERT IGNORE INTO batch_recipe_ingredients (batch_recipe_id, raw_ingredient_id, ratio_per_unit, unit) VALUES
  ('chicken_keema',       'raw_chicken', 1.25,  'g'),
  ('chicken_keema',       'onion',       0.10,  'g'),
  ('chicken_keema',       'oil',         0.05,  'ml'),
  ('chicken_keema',       'spices',      0.02,  'g'),
  ('paneer_keema',        'paneer',      1.00,  'g'),
  ('paneer_keema',        'onion',       0.10,  'g'),
  ('paneer_keema',        'oil',         0.05,  'ml'),
  ('paneer_keema',        'spices',      0.02,  'g'),
  ('chicken_kosha_gravy', 'raw_chicken', 250.0, 'g'),
  ('chicken_kosha_gravy', 'onion',       50.0,  'g'),
  ('chicken_kosha_gravy', 'oil',         20.0,  'ml'),
  ('chicken_kosha_gravy', 'spices',      20.0,  'g'),
  ('pakora_mixture',      'raw_chicken', 1.10,  'g'),
  ('pakora_mixture',      'oil',         0.05,  'ml'),
  ('pakora_mixture',      'spices',      0.02,  'g'),
  ('paratha_base',        'flour',       50.0,  'g'),
  ('paratha_base',        'oil',         10.0,  'ml'),
  ('mughlai_dough',       'flour',       80.0,  'g'),
  ('mughlai_dough',       'oil',         10.0,  'ml'),
  ('chowmein_base',       'noodles',     80.0,  'g'),
  ('chowmein_base',       'oil',         10.0,  'ml'),
  ('pasta_base',          'pasta',       80.0,  'g'),
  ('pasta_base',          'oil',         10.0,  'ml'),
  ('ghugni_gravy',        'ghugni_peas', 0.5,   'g'),
  ('ghugni_gravy',        'onion',       0.1,   'g'),
  ('ghugni_gravy',        'oil',         0.05,  'ml'),
  ('ghugni_gravy',        'spices',      0.02,  'g'),
  ('chole_gravy',         'chole_chana', 0.5,   'g'),
  ('chole_gravy',         'onion',       0.1,   'g'),
  ('chole_gravy',         'oil',         0.05,  'ml'),
  ('chole_gravy',         'spices',      0.02,  'g');

INSERT IGNORE INTO batch_processing_stages (batch_recipe_id, stage_order, stage_name, station_id, duration_min) VALUES
  ('pakora_mixture', 1, 'Marination', 'prep',     30),
  ('pakora_mixture', 2, 'Frying',     'deep_fry', 10);

-- ============================================================
-- MENU RECIPES (which ingredients go into each menu item)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  ingredient_type ENUM('raw','intermediate','prepared') DEFAULT 'intermediate',
  quantity DECIMAL(10,4) NOT NULL,
  unit VARCHAR(20) DEFAULT 'g',
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- ============================================================
-- WORKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  prep_time_per_item INT DEFAULT 3,
  daily_salary INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many workers can handle many stations
CREATE TABLE IF NOT EXISTS worker_stations (
  worker_id VARCHAR(64) NOT NULL,
  station_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (worker_id, station_id),
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

INSERT IGNORE INTO workers (id, name, prep_time_per_item, active) VALUES
  ('w1', 'Raju',   3, 1),
  ('w2', 'Sanjay', 4, 1),
  ('w3', 'Amit',   3, 1),
  ('w4', 'Bikram', 4, 1),
  ('w5', 'Joy',    3, 1),
  ('w6', 'Kunal',  5, 1),
  ('w7', 'Debu',   5, 1);

INSERT IGNORE INTO worker_stations (worker_id, station_id) VALUES
  ('w1', 'tawa'),
  ('w2', 'tawa'), ('w2', 'prep'),
  ('w3', 'prep'),
  ('w4', 'moghlai'), ('w4', 'moghlai_tawa'),
  ('w5', 'deep_fry'),
  ('w6', 'kosha'), ('w6', 'chilley'),
  ('w7', 'server'), ('w7', 'reception');

-- ============================================================
-- MENU ITEMS SEED (with station references)
-- ============================================================
INSERT IGNORE INTO menu_items (id, name, station_id, prep_time, active, food_type) VALUES
  ('chicken_roll',    'Chicken Roll',    'tawa',       3, 1, 'non-veg'),
  ('egg_roll',        'Egg Roll',        'tawa',       3, 1, 'egg'),
  ('chicken_chowmein','Chicken Chowmein','chilley',    4, 1, 'non-veg'),
  ('chicken_pasta',   'Chicken Pasta',   'chilley',    4, 1, 'non-veg'),
  ('mughlai_paratha', 'Mughlai Paratha', 'moghlai',    5, 1, 'non-veg'),
  ('chicken_pakora',  'Chicken Pakora',  'deep_fry',   4, 1, 'non-veg'),
  ('chicken_kosha',   'Chicken Kosha',   'kosha',      5, 1, 'non-veg'),
  ('veg_chowmein',    'Veg Chowmein',    'chilley',    4, 1, 'veg'),
  ('veg_pasta',       'Veg Pasta',       'chilley',    4, 1, 'veg'),
  ('egg_pasta',       'Egg Pasta',       'chilley',    4, 1, 'egg'),
  ('paneer_pasta',    'Paneer Pasta',    'chilley',    4, 1, 'veg'),
  ('egg_chicken_pasta','Egg Chicken Pasta','chilley',  4, 1, 'non-veg'),
  ('egg_paneer_pasta','Egg Paneer Pasta','chilley',    4, 1, 'non-veg'),
  ('egg_chowmein',    'Egg Chowmein',    'chilley',    4, 1, 'egg'),
  ('paneer_chowmein', 'Paneer Chowmein', 'chilley',    4, 1, 'veg'),
  ('egg_chicken_chowmein','Egg Chicken Chowmein','chilley',4, 1, 'non-veg'),
  ('egg_paneer_chowmein','Egg Paneer Chowmein','chilley',4, 1, 'non-veg'),
  ('veg_roll',        'Veg Roll',        'tawa',       3, 1, 'veg'),
  ('paneer_roll',     'Paneer Roll',     'tawa',       3, 1, 'veg'),
  ('egg_chicken_roll','Egg Chicken Roll','tawa',       3, 1, 'non-veg'),
  ('egg_paneer_roll', 'Egg Paneer Roll', 'tawa',       3, 1, 'non-veg'),
  ('chicken_paratha', 'Chicken Paratha', 'tawa',       4, 1, 'non-veg'),
  ('gogni_paratha',   'Gogni Paratha',   'tawa',       4, 1, 'veg'),
  ('chola_bhatura',   'Chola Bhatura',   'moghlai',    4, 1, 'veg');

INSERT IGNORE INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES
  ('chicken_roll_single',      'chicken_roll',     'Single',       90,  1.0),
  ('egg_roll_single',          'egg_roll',         'Single',       60,  1.0),
  ('chicken_chowmein_half',    'chicken_chowmein', 'Half',         70,  1.0),
  ('chicken_chowmein_full',    'chicken_chowmein', 'Full',         120, 1.8),
  ('chicken_pasta_half',       'chicken_pasta',    'Half',         80,  1.0),
  ('chicken_pasta_full',       'chicken_pasta',    'Full',         140, 1.8),
  ('mughlai_paratha_single',   'mughlai_paratha',  'Single',       120, 1.0),
  ('chicken_pakora_single',    'chicken_pakora',   'Single',       100,  1.0),
  ('chicken_kosha_half',       'chicken_kosha',    'Half', 100, 1.0),
  ('chicken_kosha_full',       'chicken_kosha',    'Full', 180, 1.8),
  ('veg_chowmein_half',        'veg_chowmein',     'Half',         50,  1.0),
  ('veg_chowmein_full',        'veg_chowmein',     'Full',         90,  1.8),
  ('veg_pasta_half',           'veg_pasta',        'Half',         50,  1.0),
  ('veg_pasta_full',           'veg_pasta',        'Full',         90,  1.8),
  ('egg_pasta_half',           'egg_pasta',        'Half',         60,  1.0),
  ('egg_pasta_full',           'egg_pasta',        'Full',         100, 1.8),
  ('paneer_pasta_half',        'paneer_pasta',     'Half',         80,  1.0),
  ('paneer_pasta_full',        'paneer_pasta',     'Full',         140, 1.8),
  ('egg_chicken_pasta_half',   'egg_chicken_pasta','Half',         90,  1.0),
  ('egg_chicken_pasta_full',   'egg_chicken_pasta','Full',         150, 1.8),
  ('egg_paneer_pasta_half',    'egg_paneer_pasta', 'Half',         90,  1.0),
  ('egg_paneer_pasta_full',    'egg_paneer_pasta', 'Full',         150, 1.8),
  ('egg_chowmein_half',        'egg_chowmein',     'Half',         60,  1.0),
  ('egg_chowmein_full',        'egg_chowmein',     'Full',         100, 1.8),
  ('paneer_chowmein_half',     'paneer_chowmein',  'Half',         80,  1.0),
  ('paneer_chowmein_full',     'paneer_chowmein',  'Full',         140, 1.8),
  ('egg_chicken_chowmein_half','egg_chicken_chowmein','Half',      80,  1.0),
  ('egg_chicken_chowmein_full','egg_chicken_chowmein','Full',      130, 1.8),
  ('egg_paneer_chowmein_half', 'egg_paneer_chowmein','Half',       90,  1.0),
  ('egg_paneer_chowmein_full', 'egg_paneer_chowmein','Full',       150, 1.8),
  ('veg_roll_single',          'veg_roll',         'Single',       50,  1.0),
  ('paneer_roll_single',       'paneer_roll',      'Single',       80,  1.0),
  ('egg_chicken_roll_single',  'egg_chicken_roll', 'Single',       100, 1.0),
  ('egg_paneer_roll_single',   'egg_paneer_roll',  'Single',       90,  1.0),
  ('chicken_paratha_single',   'chicken_paratha',  'Single',       100, 1.0),
  ('gogni_paratha_single',     'gogni_paratha',    'Single',       60,  1.0),
  ('chola_bhatura_single',     'chola_bhatura',    'Single',       80,  1.0);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY,
  customer_name VARCHAR(120) DEFAULT 'Walk-In',
  source VARCHAR(32) DEFAULT 'DINE_IN',
  priority VARCHAR(16) DEFAULT 'NORMAL',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  commission DECIMAL(10,2) DEFAULT 0,
  net_revenue DECIMAL(10,2) DEFAULT 0,
  eta INT DEFAULT 0,
  fulfillment_status VARCHAR(20) DEFAULT 'ACCEPTED',
  payment_status VARCHAR(20) DEFAULT 'UNPAID',
  ts_accepted DATETIME,
  ts_cooking DATETIME,
  ts_ready DATETIME,
  ts_completed DATETIME,
  ts_active DATETIME,
  ts_queued DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  menu_item_id VARCHAR(64) NOT NULL,
  menu_item_name VARCHAR(120),
  variant_id VARCHAR(64),
  variant_name VARCHAR(80),
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  modifiers JSON,
  status VARCHAR(20) DEFAULT 'PENDING',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- EXPENSES / PURCHASE LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(32) PRIMARY KEY,
  expense_date DATE NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  quantity DECIMAL(10,4) DEFAULT 1,
  unit VARCHAR(30) DEFAULT 'pcs',
  cost DECIMAL(10,2) NOT NULL,
  supplier VARCHAR(120) DEFAULT '',
  raw_ingredient_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Persistent custom item and supplier lists
CREATE TABLE IF NOT EXISTS custom_expense_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(120) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(120) UNIQUE NOT NULL
);

-- Seed known suppliers
INSERT IGNORE INTO custom_suppliers (supplier_name) VALUES
  ('Apex Poultry'), ('Maa Dairy'), ('Ganesh Flour Mill'), ('Egg Vendor'),
  ('Fortune Retail'), ('Sabji Mandi'), ('Chong noodles'), ('Amul Store'),
  ('Sunrise Spices'), ('Kissan Depot');

-- ============================================================
-- DAY HISTORY (closing reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS day_history (
  id VARCHAR(32) PRIMARY KEY,
  report_date DATE NOT NULL,
  order_count INT DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  expenses DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) DEFAULT 0,
  source_breakdown JSON,
  item_sales JSON,
  inventory_snapshot JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actor VARCHAR(80) DEFAULT 'System Admin',
  action VARCHAR(80) NOT NULL,
  payload TEXT,
  INDEX idx_timestamp (log_timestamp)
);

-- ============================================================
-- EGG STOCK TRACKING
-- ============================================================
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
);
