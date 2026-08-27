-- Run this in Supabase SQL Editor (after the colleges table)

CREATE TABLE IF NOT EXISTS canteens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  college_id TEXT NOT NULL,
  owner_id TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  location TEXT DEFAULT '',
  logo_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS subcanteens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  canteen_id TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'customer',
  phone TEXT DEFAULT '',
  register_number TEXT DEFAULT '',
  college_id TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  sub_canteen_id TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  posting TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stock_grams REAL DEFAULT 0,
  unit TEXT DEFAULT 'g',
  canteen_id TEXT DEFAULT '',
  sub_canteen_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  tags JSONB DEFAULT '[]',
  prep_time INTEGER DEFAULT 15,
  daily_limit INTEGER DEFAULT 100,
  booked_today INTEGER DEFAULT 0,
  is_paused BOOLEAN DEFAULT false,
  recipe JSONB DEFAULT '[]',
  sub_canteen_id TEXT DEFAULT '',
  college_id TEXT DEFAULT '',
  requires_chef BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  items JSONB DEFAULT '[]',
  total_price REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  qr_code TEXT DEFAULT '',
  qr_payload TEXT DEFAULT '',
  timestamp TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  pickup_time_text TEXT DEFAULT '',
  pickup_slot TEXT DEFAULT '',
  prep_start_time BIGINT DEFAULT 0,
  expiry_time BIGINT DEFAULT 0,
  canteen_id TEXT DEFAULT '',
  sub_canteen_id TEXT DEFAULT '',
  college_id TEXT DEFAULT '',
  razorpay_order_id TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  razorpay_signature TEXT DEFAULT '',
  vyapar_txn_id TEXT DEFAULT '',
  upi_qr_url TEXT DEFAULT '',
  upi_string TEXT DEFAULT '',
  type TEXT DEFAULT '',
  bill_number TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  customer_reg_no TEXT DEFAULT '',
  grand_total REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  rating INTEGER DEFAULT 0,
  comment TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'neutral',
  timestamp TEXT DEFAULT '',
  menu_item_id TEXT DEFAULT '',
  menu_item_name TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  sub_canteen_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  canteen_id TEXT PRIMARY KEY,
  no_show_minutes INTEGER DEFAULT 30,
  default_slot_capacity INTEGER DEFAULT 30
);

CREATE TABLE IF NOT EXISTS otp_store (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  subject TEXT DEFAULT '',
  description TEXT DEFAULT '',
  order_id TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0,
  admin_reply TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  college_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS walkin_bills (
  id TEXT PRIMARY KEY,
  bill_number TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  customer_reg_no TEXT DEFAULT '',
  customer_dept TEXT DEFAULT '',
  customer_notes TEXT DEFAULT '',
  pending_reason TEXT DEFAULT '',
  pending_expected_time TEXT DEFAULT '',
  cashier_name TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  sub_canteen_id TEXT DEFAULT '',
  college_id TEXT DEFAULT '',
  timestamp TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  synced BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'walkin',
  status TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_items_canteen ON items(canteen_id);
CREATE INDEX IF NOT EXISTS idx_orders_canteen ON orders(canteen_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_canteen ON reviews(canteen_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_canteen ON ingredients(canteen_id);
CREATE INDEX IF NOT EXISTS idx_users_canteen ON users(canteen_id);
CREATE INDEX IF NOT EXISTS idx_users_college ON users(college_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_canteens_college ON canteens(college_id);
CREATE INDEX IF NOT EXISTS idx_subcanteens_canteen ON subcanteens(canteen_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_walkin_bills_canteen ON walkin_bills(canteen_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_items_subcanteen ON items(sub_canteen_id);

-- ============================================================================
-- PHASE 3: Smart Canteen Operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS kitchen_operations (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  sub_canteen_id TEXT DEFAULT '',
  active_orders INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 20,
  assigned_chef_id TEXT DEFAULT '',
  status TEXT DEFAULT 'normal',
  avg_prep_time REAL DEFAULT 0,
  last_updated BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS queue_snapshots (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  total_waiting INTEGER DEFAULT 0,
  avg_wait_time REAL DEFAULT 0,
  orders_by_status JSONB DEFAULT '{}',
  peak_slot TEXT DEFAULT '',
  recorded_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preparation_metrics (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  order_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  prep_start_time BIGINT DEFAULT 0,
  prep_end_time BIGINT DEFAULT 0,
  actual_prep_time INTEGER DEFAULT 0,
  estimated_prep_time INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS counter_workload (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  counter_name TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  avg_service_time REAL DEFAULT 0,
  status TEXT DEFAULT 'idle',
  last_updated BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_kitchen_ops_canteen ON kitchen_operations(canteen_id);
CREATE INDEX IF NOT EXISTS idx_queue_snapshots_canteen ON queue_snapshots(canteen_id);
CREATE INDEX IF NOT EXISTS idx_prep_metrics_canteen ON preparation_metrics(canteen_id);
CREATE INDEX IF NOT EXISTS idx_prep_metrics_order ON preparation_metrics(order_id);
CREATE INDEX IF NOT EXISTS idx_counter_workload_canteen ON counter_workload(canteen_id);

-- ============================================================================
-- PHASE 4: AI Demand & Waste Intelligence
-- ============================================================================

CREATE TABLE IF NOT EXISTS demand_predictions (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  prediction_date TEXT DEFAULT '',
  predicted_demand JSONB DEFAULT '{}',
  confidence REAL DEFAULT 0,
  based_on_days INTEGER DEFAULT 7,
  generated_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS demand_prediction_items (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  predicted_quantity INTEGER DEFAULT 0,
  actual_quantity INTEGER DEFAULT 0,
  error_margin REAL DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS waste_records (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  quantity_wasted INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  estimated_cost REAL DEFAULT 0,
  recorded_by TEXT DEFAULT '',
  recorded_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  canteen_id TEXT NOT NULL,
  type TEXT DEFAULT 'suggestion',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  generated_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_demand_predictions_canteen ON demand_predictions(canteen_id);
CREATE INDEX IF NOT EXISTS idx_demand_predictions_date ON demand_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_demand_pred_items_pred ON demand_prediction_items(prediction_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_canteen ON waste_records(canteen_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_item ON waste_records(item_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_canteen ON ai_recommendations(canteen_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);

-- ============================================================================
-- PHASE 6: Offline & Network Resilience
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  operation TEXT DEFAULT '',
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS synchronization_events (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  canteen_id TEXT DEFAULT '',
  direction TEXT DEFAULT 'up',
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  conflict_detected BOOLEAN DEFAULT false,
  synced_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conflict_records (
  id TEXT PRIMARY KEY,
  sync_event_id TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  local_version JSONB DEFAULT '{}',
  remote_version JSONB DEFAULT '{}',
  resolution TEXT DEFAULT 'pending',
  resolved_by TEXT DEFAULT '',
  resolved_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_events_user ON synchronization_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON synchronization_events(status);
CREATE INDEX IF NOT EXISTS idx_conflict_records_event ON conflict_records(sync_event_id);
CREATE INDEX IF NOT EXISTS idx_conflict_records_resolution ON conflict_records(resolution);
