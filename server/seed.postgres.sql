-- Default AlokaFastFood data. Run after schema.postgres.sql.

INSERT INTO stations (id, name, base_capacity, sort_order) VALUES
  ('tawa', 'Tawa', 1, 1), ('prep', 'Prep', 1, 2), ('reception', 'Reception', 1, 3),
  ('deep_fry', 'Deep Fry', 1, 4), ('kosha', 'Kosha', 1, 5), ('chilley', 'Chilley', 1, 6),
  ('moghlai', 'Moghlai', 1, 7), ('moghlai_tawa', 'Moghlai Tawa', 1, 8),
  ('cleaner', 'Cleaner', 1, 9), ('server', 'Server', 1, 10)
ON CONFLICT DO NOTHING;

INSERT INTO raw_ingredients (id, name, stock, reserved, min_stock, purchase_unit, stock_unit, conversion_factor, cost_per_purchase_unit, supplier) VALUES
  ('raw_chicken', 'Raw Chicken', 0, 0, 5000, 'kg', 'g', 1000, 220, 'Apex Poultry'),
  ('paneer', 'Paneer', 0, 0, 2000, 'kg', 'g', 1000, 350, 'Maa Dairy'),
  ('flour', 'Flour', 0, 0, 10000, 'kg', 'g', 1000, 40, 'Ganesh Flour Mill'),
  ('egg', 'Egg', 0, 0, 30, 'pcs', 'pcs', 1, 6, 'Egg Vendor'),
  ('oil', 'Cooking Oil', 0, 0, 3000, 'L', 'ml', 1000, 140, 'Fortune Retail'),
  ('onion', 'Onions', 0, 0, 3000, 'kg', 'g', 1000, 40, 'Sabji Mandi'),
  ('capsicum', 'Capsicum', 0, 0, 1500, 'kg', 'g', 1000, 80, 'Sabji Mandi'),
  ('noodles', 'Raw Noodles', 0, 0, 2000, 'kg', 'g', 1000, 60, 'Chong noodles'),
  ('pasta', 'Raw Pasta', 0, 0, 2000, 'kg', 'g', 1000, 80, 'Fortune Retail'),
  ('cheese', 'Cheese Block', 0, 0, 1000, 'kg', 'g', 1000, 400, 'Amul Store'),
  ('spices', 'Mix Spices', 0, 0, 500, 'kg', 'g', 1000, 300, 'Sunrise Spices'),
  ('sauce', 'Sauces & Condiments', 0, 0, 1000, 'kg', 'g', 1000, 80, 'Kissan Depot'),
  ('ghugni_peas', 'Ghugni Peas', 0, 0, 2000, 'kg', 'g', 1000, 60, 'Sabji Mandi'),
  ('chole_chana', 'Chole Chana', 0, 0, 2000, 'kg', 'g', 1000, 80, 'Sabji Mandi')
ON CONFLICT DO NOTHING;

INSERT INTO intermediate_stock (id, name, stock, reserved, min_stock, unit, item_type) VALUES
  ('chicken_keema', 'Chicken Keema', 0, 0, 1500, 'g', 'intermediate'),
  ('paneer_keema', 'Paneer Keema', 0, 0, 1000, 'g', 'intermediate'),
  ('chicken_kosha_gravy', 'Chicken Kosha Gravy', 0, 0, 5, 'portions', 'intermediate'),
  ('pakora_mixture', 'Chicken Pakora Mixture', 0, 0, 1000, 'g', 'intermediate'),
  ('paratha_base', 'Paratha Base', 0, 0, 30, 'pcs', 'prepared'),
  ('mughlai_dough', 'Mughlai Dough', 0, 0, 10, 'pcs', 'prepared'),
  ('chowmein_base', 'Chowmein Base', 0, 0, 10, 'portions', 'prepared'),
  ('pasta_base', 'Pasta Base', 0, 0, 10, 'portions', 'prepared'),
  ('ghugni_gravy', 'Ghugni Gravy', 0, 0, 1000, 'g', 'intermediate'),
  ('chole_gravy', 'Chole Gravy', 0, 0, 1000, 'g', 'intermediate')
ON CONFLICT DO NOTHING;

INSERT INTO batch_recipes (id, name, unit, expected_yield_ratio, processing_type) VALUES
  ('chicken_keema', 'Chicken Keema', 'g', 0.80, 'direct'), ('paneer_keema', 'Paneer Keema', 'g', 0.95, 'direct'),
  ('chicken_kosha_gravy', 'Chicken Kosha Gravy', 'portions', 1, 'direct'), ('pakora_mixture', 'Chicken Pakora Mixture', 'g', 0.90, 'staged'),
  ('paratha_base', 'Paratha Base', 'pcs', 1, 'direct'), ('mughlai_dough', 'Mughlai Dough', 'pcs', 1, 'direct'),
  ('chowmein_base', 'Chowmein Base', 'portions', 1, 'direct'), ('pasta_base', 'Pasta Base', 'portions', 1, 'direct'),
  ('ghugni_gravy', 'Ghugni Gravy', 'g', 1, 'direct'), ('chole_gravy', 'Chole Gravy', 'g', 1, 'direct')
ON CONFLICT DO NOTHING;

INSERT INTO batch_processing_stages (batch_recipe_id, stage_order, stage_name, station_id, duration_min)
VALUES ('pakora_mixture', 1, 'Marination', 'prep', 30), ('pakora_mixture', 2, 'Frying', 'deep_fry', 10)
ON CONFLICT DO NOTHING;

INSERT INTO workers (id, name, prep_time_per_item, active) VALUES
  ('w1', 'Raju', 3, 1), ('w2', 'Sanjay', 4, 1), ('w3', 'Amit', 3, 1), ('w4', 'Bikram', 4, 1),
  ('w5', 'Joy', 3, 1), ('w6', 'Kunal', 5, 1), ('w7', 'Debu', 5, 1)
ON CONFLICT DO NOTHING;

INSERT INTO worker_stations (worker_id, station_id) VALUES
  ('w1', 'tawa'), ('w2', 'tawa'), ('w2', 'prep'), ('w3', 'prep'), ('w4', 'moghlai'),
  ('w4', 'moghlai_tawa'), ('w5', 'deep_fry'), ('w6', 'kosha'), ('w6', 'chilley'),
  ('w7', 'server'), ('w7', 'reception')
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (id, name, station_id, prep_time, active, food_type) VALUES
  ('chicken_roll', 'Chicken Roll', 'tawa', 3, 1, 'non-veg'), ('egg_roll', 'Egg Roll', 'tawa', 3, 1, 'egg'),
  ('chicken_chowmein', 'Chicken Chowmein', 'chilley', 4, 1, 'non-veg'), ('chicken_pasta', 'Chicken Pasta', 'chilley', 4, 1, 'non-veg'),
  ('mughlai_paratha', 'Mughlai Paratha', 'moghlai', 5, 1, 'non-veg'), ('chicken_pakora', 'Chicken Pakora', 'deep_fry', 4, 1, 'non-veg'),
  ('chicken_kosha', 'Chicken Kosha', 'kosha', 5, 1, 'non-veg'), ('veg_chowmein', 'Veg Chowmein', 'chilley', 4, 1, 'veg'),
  ('veg_pasta', 'Veg Pasta', 'chilley', 4, 1, 'veg'), ('egg_pasta', 'Egg Pasta', 'chilley', 4, 1, 'egg'),
  ('paneer_pasta', 'Paneer Pasta', 'chilley', 4, 1, 'veg'), ('egg_chicken_pasta', 'Egg Chicken Pasta', 'chilley', 4, 1, 'non-veg'),
  ('egg_paneer_pasta', 'Egg Paneer Pasta', 'chilley', 4, 1, 'non-veg'), ('egg_chowmein', 'Egg Chowmein', 'chilley', 4, 1, 'egg'),
  ('paneer_chowmein', 'Paneer Chowmein', 'chilley', 4, 1, 'veg'), ('egg_chicken_chowmein', 'Egg Chicken Chowmein', 'chilley', 4, 1, 'non-veg'),
  ('egg_paneer_chowmein', 'Egg Paneer Chowmein', 'chilley', 4, 1, 'non-veg'), ('veg_roll', 'Veg Roll', 'tawa', 3, 1, 'veg'),
  ('paneer_roll', 'Paneer Roll', 'tawa', 3, 1, 'veg'), ('egg_chicken_roll', 'Egg Chicken Roll', 'tawa', 3, 1, 'non-veg'),
  ('egg_paneer_roll', 'Egg Paneer Roll', 'tawa', 3, 1, 'non-veg'), ('chicken_paratha', 'Chicken Paratha', 'tawa', 4, 1, 'non-veg'),
  ('gogni_paratha', 'Gogni Paratha', 'tawa', 4, 1, 'veg'), ('chola_bhatura', 'Chola Bhatura', 'moghlai', 4, 1, 'veg')
ON CONFLICT DO NOTHING;

INSERT INTO menu_variants (id, menu_item_id, name, price, recipe_multiplier) VALUES
  ('chicken_roll_single', 'chicken_roll', 'Single', 90, 1), ('egg_roll_single', 'egg_roll', 'Single', 60, 1),
  ('chicken_chowmein_half', 'chicken_chowmein', 'Half', 70, 1), ('chicken_chowmein_full', 'chicken_chowmein', 'Full', 120, 1.8),
  ('chicken_pasta_half', 'chicken_pasta', 'Half', 80, 1), ('chicken_pasta_full', 'chicken_pasta', 'Full', 140, 1.8),
  ('mughlai_paratha_single', 'mughlai_paratha', 'Single', 120, 1), ('chicken_pakora_single', 'chicken_pakora', 'Single', 100, 1),
  ('chicken_kosha_half', 'chicken_kosha', 'Half', 100, 1), ('chicken_kosha_full', 'chicken_kosha', 'Full', 180, 1.8),
  ('veg_chowmein_half', 'veg_chowmein', 'Half', 50, 1), ('veg_chowmein_full', 'veg_chowmein', 'Full', 90, 1.8),
  ('veg_pasta_half', 'veg_pasta', 'Half', 50, 1), ('veg_pasta_full', 'veg_pasta', 'Full', 90, 1.8),
  ('egg_pasta_half', 'egg_pasta', 'Half', 60, 1), ('egg_pasta_full', 'egg_pasta', 'Full', 100, 1.8),
  ('paneer_pasta_half', 'paneer_pasta', 'Half', 80, 1), ('paneer_pasta_full', 'paneer_pasta', 'Full', 140, 1.8),
  ('egg_chicken_pasta_half', 'egg_chicken_pasta', 'Half', 90, 1), ('egg_chicken_pasta_full', 'egg_chicken_pasta', 'Full', 150, 1.8),
  ('egg_paneer_pasta_half', 'egg_paneer_pasta', 'Half', 90, 1), ('egg_paneer_pasta_full', 'egg_paneer_pasta', 'Full', 150, 1.8),
  ('egg_chowmein_half', 'egg_chowmein', 'Half', 60, 1), ('egg_chowmein_full', 'egg_chowmein', 'Full', 100, 1.8),
  ('paneer_chowmein_half', 'paneer_chowmein', 'Half', 80, 1), ('paneer_chowmein_full', 'paneer_chowmein', 'Full', 140, 1.8),
  ('egg_chicken_chowmein_half', 'egg_chicken_chowmein', 'Half', 80, 1), ('egg_chicken_chowmein_full', 'egg_chicken_chowmein', 'Full', 130, 1.8),
  ('egg_paneer_chowmein_half', 'egg_paneer_chowmein', 'Half', 90, 1), ('egg_paneer_chowmein_full', 'egg_paneer_chowmein', 'Full', 150, 1.8),
  ('veg_roll_single', 'veg_roll', 'Single', 50, 1), ('paneer_roll_single', 'paneer_roll', 'Single', 80, 1),
  ('egg_chicken_roll_single', 'egg_chicken_roll', 'Single', 100, 1), ('egg_paneer_roll_single', 'egg_paneer_roll', 'Single', 90, 1),
  ('chicken_paratha_single', 'chicken_paratha', 'Single', 100, 1), ('gogni_paratha_single', 'gogni_paratha', 'Single', 60, 1),
  ('chola_bhatura_single', 'chola_bhatura', 'Single', 80, 1)
ON CONFLICT DO NOTHING;

INSERT INTO custom_suppliers (supplier_name) VALUES
  ('Apex Poultry'), ('Maa Dairy'), ('Ganesh Flour Mill'), ('Egg Vendor'), ('Fortune Retail'),
  ('Sabji Mandi'), ('Chong noodles'), ('Amul Store'), ('Sunrise Spices'), ('Kissan Depot')
ON CONFLICT DO NOTHING;
