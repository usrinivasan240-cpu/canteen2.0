-- Smart Chef Assignment & Item-Based Kitchen Routing - Database Migration
-- Run this in Supabase SQL Editor

-- ============================================================
-- CHEF TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id TEXT NOT NULL REFERENCES canteens(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  specialization TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'UNAVAILABLE', 'ON_LEAVE', 'INACTIVE')),
  is_available BOOLEAN DEFAULT true,
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CHEF LEAVE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chef_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  reason TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- KITCHEN TASK TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS kitchen_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  canteen_id TEXT NOT NULL REFERENCES canteens(id) ON DELETE CASCADE,
  chef_id UUID REFERENCES chefs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'CANCELLED', 'COMPLETED')),
  priority INTEGER DEFAULT 0,
  assigned_at BIGINT DEFAULT 0,
  started_at BIGINT DEFAULT 0,
  completed_at BIGINT DEFAULT 0,
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0
);

-- ============================================================
-- CHEF LEAVE
-- ============================================================
CREATE TABLE IF NOT EXISTS chef_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  reason TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CHEF ASSIGNMENT FOR MENU ITEMS
-- ============================================================
ALTER TABLE items ADD COLUMN IF NOT EXISTS primary_chef_id UUID REFERENCES chefs(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS backup_chef_id UUID REFERENCES chefs(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS preparation_type TEXT DEFAULT 'READY_TO_SERVE' CHECK (preparation_type IN ('COOKABLE', 'READY_TO_SERVE'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS requires_chef BOOLEAN DEFAULT true;

-- ============================================================
-- CHEF AVAILABILITY / LEAVE
-- ============================================================
CREATE TABLE IF NOT EXISTS chef_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  reason TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CHEF AVAILABILITY (for future smart load balancing)
-- ============================================================
CREATE TABLE IF NOT EXISTS chef_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at BIGINT DEFAULT 0
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chefs_canteen ON chefs(canteen_id);
CREATE INDEX IF NOT EXISTS idx_chefs_user ON chefs(user_id);
CREATE INDEX IF NOT EXISTS idx_chefs_status ON chefs(status);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen ON kitchen_tasks(canteen_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef ON kitchen_tasks(chef_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_status ON kitchen_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_order ON kitchen_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_item ON kitchen_tasks(item_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status ON kitchen_tasks(canteen_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);
CREATE INDEX IF NOT EXISTS idx_items_primary_chef ON items(primary_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_backup_chef ON items(backup_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_preparation_type ON items(preparation_type);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status ON kitchen_tasks(canteen_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Chefs
ALTER TABLE chefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view chefs in their canteen" ON chefs
  FOR SELECT USING (
    canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
    )
  );
CREATE POLICY "Canteen owners can manage chefs" ON chefs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = chefs.canteen_id
      AND u.role IN ('owner', 'admin', 'superadmin')
    )
  );

-- Kitchen Tasks policies
ALTER TABLE kitchen_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view kitchen tasks in their canteen" ON kitchen_tasks
  FOR SELECT USING (
    canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
    )
  );
CREATE POLICY "Chefs can view their assigned tasks" ON kitchen_tasks
  FOR SELECT USING (
    chef_id IN (
      SELECT id FROM chefs WHERE user_id = auth.uid()::text
    )
  );
CREATE POLICY "Chefs can update their assigned tasks" ON kitchen_tasks
  FOR UPDATE USING (
    chef_id IN (
      SELECT id FROM chefs WHERE user_id = auth.uid()::text
    )
  ) WITH CHECK (
    chef_id IN (
      SELECT id FROM chefs WHERE user_id = auth.uid()::text
    )
  );
CREATE POLICY "Canteen owners can manage tasks" ON kitchen_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chefs c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = kitchen_tasks.chef_id
      AND u.id = auth.uid()::text
      AND u.canteen_id = kitchen_tasks.canteen_id
    )
  );

-- Chef leave policies
ALTER TABLE chef_leave ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Canteen owners can manage chef leave" ON chef_leave
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chefs c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = chef_leave.chef_id
      AND u.id = auth.uid()::text
      AND u.canteen_id = (SELECT canteen_id FROM chefs WHERE id = chef_leave.chef_id)
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chefs_canteen ON chefs(canteen_id);
CREATE INDEX IF NOT EXISTS idx_chefs_user ON chefs(user_id);
CREATE INDEX IF NOT EXISTS idx_chefs_status ON chefs(status);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen ON kitchen_tasks(canteen_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef ON kitchen_tasks(chef_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_status ON kitchen_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_order ON kitchen_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_item ON kitchen_tasks(item_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status ON kitchen_tasks(canteen_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);
CREATE INDEX IF NOT EXISTS idx_items_primary_chef ON items(primary_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_backup_chef ON items(backup_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_preparation_type ON items(preparation_type);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status ON kitchen_tasks(canteen_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_items_primary_chef ON items(primary_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_backup_chef ON items(backup_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_preparation_type ON items(preparation_type);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status ON kitchen_tasks(canteen_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);
CREATE INDEX IF NOT EXISTS idx_chef_leave_dates ON chef_leave(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_chef_leave_chef ON chef_leave(chef_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);
CREATE INDEX IF NOT EXISTS idx_items_primary_chef ON items(primary_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_backup_chef ON items(backup_chef_id);
CREATE INDEX IF NOT EXISTS idx_items_preparation_type ON items(preparation_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_chefs_updated_at BEFORE UPDATE ON chefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kitchen_tasks_updated_at BEFORE UPDATE ON kitchen_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7 MISSING COMPOSITE INDEXES (from performance audit)
-- ============================================================
-- 1. orders: canteen_id + status + created_at (for order listing by canteen)
CREATE INDEX IF NOT EXISTS idx_orders_canteen_status_created ON orders(canteen_id, status, created_at);

-- 2. kitchen_tasks: canteen_id + status + assigned_at (for kitchen task queries)
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_canteen_status_assigned ON kitchen_tasks(canteen_id, status, assigned_at);

-- 3. items: canteen_id + available + is_paused (for menu loading)
CREATE INDEX IF NOT EXISTS idx_items_canteen_avail_paused ON items(canteen_id, available, is_paused);

-- 4. wallet_transactions: wallet_id + created_at (for transaction history)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created ON wallet_transactions(wallet_id, created_at);

-- 5. kitchen_tasks: chef_id + status (for chef task queries)
CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_chef_status ON kitchen_tasks(chef_id, status);

-- 6. orders: user_id + status + created_at (for user order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created ON orders(user_id, status, created_at);

-- 7. wallet_transactions: wallet_id + status + created_at (for transaction filtering)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_status_created ON wallet_transactions(wallet_id, status, created_at);