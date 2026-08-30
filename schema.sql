-- Esc(Q) Canteen - PostgreSQL Schema
-- Run against your Neon/PostgreSQL database

CREATE TABLE IF NOT EXISTS colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  banner_subtitle TEXT DEFAULT '',
  banner_features JSONB DEFAULT '[]',
  branding JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS canteens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  college_id TEXT NOT NULL REFERENCES colleges(id),
  owner_id TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  location TEXT DEFAULT '',
  logo_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS subcanteens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  canteen_id TEXT NOT NULL REFERENCES canteens(id),
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

-- Indexes for common queries
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
