-- ============================================================
-- RLS POLICIES FOR ALL CORE TABLES
-- ============================================================
-- Run this in Supabase SQL Editor AFTER chef_migration.sql

-- ============================================================
-- USERS TABLE
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid()::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Superadmins can view all users
CREATE POLICY "Superadmins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin'
    )
  );

-- Superadmins can manage all users
CREATE POLICY "Superadmins can manage all users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin'
    )
  );

-- College admins can view users in their college
CREATE POLICY "College admins can view college users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = users.college_id
    )
  );

-- College admins can manage users in their college
CREATE POLICY "College admins can manage college users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = users.college_id
    )
  );

-- ============================================================
-- CANTEENS TABLE
-- ============================================================
ALTER TABLE canteens ENABLE ROW LEVEL SECURITY;

-- Superadmins can view all canteens
CREATE POLICY "Superadmins can view all canteens" ON canteens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- Superadmins can manage all canteens
CREATE POLICY "Superadmins can manage all canteens" ON canteens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- College admins can view canteens in their college
CREATE POLICY "College admins can view college canteens" ON canteens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = canteens.college_id
    )
  );

-- College admins can manage canteens in their college
CREATE POLICY "College admins can manage college canteens" ON canteens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = canteens.college_id
    )
  );

-- Canteen owners can view their own canteen
CREATE POLICY "Canteen owners can view own canteen" ON canteens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = canteens.id
    )
  );

-- Canteen owners can update their own canteen
CREATE POLICY "Canteen owners can update own canteen" ON canteens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = canteens.id
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = canteens.id
    )
  );

-- ============================================================
-- COLLEGES TABLE
-- ============================================================
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

-- Superadmins can view all colleges
CREATE POLICY "Superadmins can view all colleges" ON colleges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- Superadmins can manage all colleges
CREATE POLICY "Superadmins can manage all colleges" ON colleges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- College admins can view their own college
CREATE POLICY "College admins can view own college" ON colleges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = colleges.id
    )
  );

-- ============================================================
-- SUBCANTEENS TABLE
-- ============================================================
ALTER TABLE subcanteens ENABLE ROW LEVEL SECURITY;

-- Superadmins can view all subcanteens
CREATE POLICY "Superadmins can view all subcanteens" ON subcanteens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- Superadmins can manage all subcanteens
CREATE POLICY "Superadmins can manage all subcanteens" ON subcanteens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- College admins can view subcanteens in their college
CREATE POLICY "College admins can view college subcanteens" ON subcanteens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = subcanteens.college_id
    )
  );

-- College admins can manage subcanteens in their college
CREATE POLICY "College admins can manage college subcanteens" ON subcanteens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'admin'
      AND u.college_id = subcanteens.college_id
    )
  );

-- Canteen owners can view subcanteens in their canteen
CREATE POLICY "Canteen owners can view canteen subcanteens" ON subcanteens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = subcanteens.canteen_id
    )
  );

-- Canteen owners can manage subcanteens in their canteen
CREATE POLICY "Canteen owners can manage canteen subcanteens" ON subcanteens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = subcanteens.canteen_id
    )
  );

-- ============================================================
-- ITEMS (MENU ITEMS) TABLE
-- ============================================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Everyone can view active items in their canteen
CREATE POLICY "Anyone can view active items in canteen" ON items
  FOR SELECT USING (
    is_paused = false 
    AND available = true
    AND canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
      UNION
      SELECT canteen_id FROM subcanteens WHERE id IN (
        SELECT subcanteen_id FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- Canteen owners can view all items in their canteen
CREATE POLICY "Canteen owners can view all items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = items.canteen_id
    )
  );

-- Canteen owners can manage items in their canteen
CREATE POLICY "Canteen owners can manage items" ON items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = items.canteen_id
    )
  );

-- Staff can view items in their canteen
CREATE POLICY "Staff can view canteen items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'staff'
      AND u.canteen_id = items.canteen_id
    )
  );

-- ============================================================
-- ORDERS TABLE
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id = auth.uid()::text);

-- Canteen owners can view all orders in their canteen
CREATE POLICY "Canteen owners can view canteen orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = orders.canteen_id
    )
  );

-- Canteen staff can view orders in their canteen
CREATE POLICY "Staff can view canteen orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'staff'
      AND u.canteen_id = orders.canteen_id
    )
  );

-- Chefs can view orders with their assigned items
CREATE POLICY "Chefs can view assigned orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chefs c
      JOIN order_items oi ON oi.item_id IN (
        SELECT item_id FROM items WHERE primary_chef_id = c.id OR backup_chef_id = c.id
      )
      WHERE c.user_id = auth.uid()::text
      AND oi.order_id = orders.id
    )
  );

-- Superadmins/Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role IN ('superadmin', 'admin'))
  );

-- ============================================================
-- ORDER_ITEMS TABLE
-- ============================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own order items
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND user_id = auth.uid()::text)
  );

-- Canteen owners can view all order items in their canteen
CREATE POLICY "Canteen owners can view order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN users u ON u.canteen_id = o.canteen_id
      WHERE o.id = order_items.order_id
      AND u.id = auth.uid()::text
      AND u.role = 'owner'
    )
  );

-- ============================================================
-- INGREDIENTS TABLE
-- ============================================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Canteen owners can view all ingredients in their canteen
CREATE POLICY "Canteen owners can view ingredients" ON ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = ingredients.canteen_id
    )
  );

-- Canteen owners can manage ingredients in their canteen
CREATE POLICY "Canteen owners can manage ingredients" ON ingredients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = ingredients.canteen_id
    )
  );

-- Staff can view ingredients in their canteen
CREATE POLICY "Staff can view ingredients" ON ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'staff'
      AND u.canteen_id = ingredients.canteen_id
    )
  );

-- ============================================================
-- WALLET TABLE
-- ============================================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (user_id = auth.uid()::text);

-- ============================================================
-- WALLET_TRANSACTIONS TABLE
-- ============================================================
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet transactions
CREATE POLICY "Users can view own wallet transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wallets WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid()::text
    )
  );

-- ============================================================
-- REVIEWS TABLE
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews for items in their canteen
CREATE POLICY "Anyone can view canteen reviews" ON reviews
  FOR SELECT USING (
    canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
      UNION
      SELECT canteen_id FROM subcanteens WHERE id IN (
        SELECT subcanteen_id FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- Users can create reviews for orders they placed
CREATE POLICY "Users can create reviews for own orders" ON reviews
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders WHERE id = reviews.order_id AND user_id = auth.uid()::text
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- SUPPORT_TICKETS TABLE
-- ============================================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT USING (user_id = auth.uid()::text);

-- Users can create tickets
CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Admins/Owners can view tickets in their canteen
CREATE POLICY "Admins can view canteen tickets" ON support_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role IN ('superadmin', 'admin', 'owner')
      AND u.canteen_id = support_tickets.canteen_id
    )
  );

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Only superadmins can view settings
CREATE POLICY "Superadmins can view settings" ON settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- Only superadmins can manage settings
CREATE POLICY "Superadmins can manage settings" ON settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'superadmin')
  );

-- ============================================================
-- CHEF_AVAILABILITY TABLE
-- ============================================================
ALTER TABLE chef_availability ENABLE ROW LEVEL SECURITY;

-- Chefs can view their own availability
CREATE POLICY "Chefs can view own availability" ON chef_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chefs WHERE id = chef_availability.chef_id AND user_id = auth.uid()::text
    )
  );

-- Chefs can manage their own availability
CREATE POLICY "Chefs can manage own availability" ON chef_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chefs WHERE id = chef_availability.chef_id AND user_id = auth.uid()::text
    )
  );

-- Canteen owners can view chef availability
CREATE POLICY "Canteen owners can view chef availability" ON chef_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chefs c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = chef_availability.chef_id
      AND u.id = auth.uid()::text
      AND u.role = 'owner'
      AND u.canteen_id = c.canteen_id
    )
  );

-- ============================================================
-- OFFERS TABLE
-- ============================================================
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active offers in their canteen
CREATE POLICY "Anyone can view active offers" ON offers
  FOR SELECT USING (
    is_active = true
    AND canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
      UNION
      SELECT canteen_id FROM subcanteens WHERE id IN (
        SELECT subcanteen_id FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- Canteen owners can view all offers
CREATE POLICY "Canteen owners can view all offers" ON offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = offers.canteen_id
    )
  );

-- Canteen owners can manage offers
CREATE POLICY "Canteen owners can manage offers" ON offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'owner'
      AND u.canteen_id = offers.canteen_id
    )
  );

-- ============================================================
-- COLLEGE BRANDING / SETTINGS
-- ============================================================
-- Assuming there's a college_branding or similar table
-- ALTER TABLE college_branding ENABLE ROW LEVEL SECURITY;
-- Similar policies as colleges table

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON users TO anon;
GRANT SELECT ON canteens TO authenticated;
GRANT SELECT ON canteens TO anon;
GRANT SELECT ON colleges TO authenticated;
GRANT SELECT ON colleges TO anon;
GRANT SELECT ON subcanteens TO authenticated;
GRANT SELECT ON subcanteens TO anon;
GRANT SELECT ON items TO authenticated;
GRANT SELECT ON items TO anon;
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON ingredients TO authenticated;
GRANT SELECT ON ingredients TO anon;
GRANT SELECT ON reviews TO authenticated;
GRANT SELECT ON reviews TO anon;
GRANT SELECT ON offers TO authenticated;
GRANT SELECT ON offers TO anon;
GRANT SELECT ON wallets TO authenticated;
GRANT SELECT ON wallet_transactions TO authenticated;
GRANT SELECT ON support_tickets TO authenticated;
GRANT SELECT ON offers TO authenticated;
GRANT SELECT ON offers TO anon;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_canteen ON users(canteen_id);
CREATE INDEX IF NOT EXISTS idx_users_college ON users(college_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Canteens
CREATE INDEX IF NOT EXISTS idx_canteens_college ON canteens(college_id);
CREATE INDEX IF NOT EXISTS idx_canteens_owner ON canteens(owner_id);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_canteen ON orders(canteen_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items(item_id);

-- Items
CREATE INDEX IF NOT EXISTS idx_items_canteen ON items(canteen_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_available ON items(available, is_paused);

-- Ingredients
CREATE INDEX IF NOT EXISTS idx_ingredients_canteen ON ingredients(canteen_id);

-- Wallet
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- Wallet Transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_canteen ON reviews(canteen_id);
CREATE INDEX IF NOT EXISTS idx_reviews_item ON reviews(item_id);

-- Support Tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_canteen ON support_tickets(canteen_id);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_canteen ON offers(canteen_id);
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active);

-- Settings
CREATE INDEX IF NOT EXISTS idx_settings_canteen ON settings(canteen_id);

-- Chef Availability
CREATE INDEX IF NOT EXISTS idx_chef_availability_chef ON chef_availability(chef_id);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_canteen ON offers(canteen_id);

-- ============================================================
-- NOTES
-- ============================================================
-- 1. Run this AFTER chef_migration.sql
-- 2. Test with different user roles before deploying to production
-- 3. Some policies use auth.uid()::text - ensure auth is properly configured
-- 4. Test with different user roles: customer, owner, staff, chef, admin, superadmin
-- 5. Monitor query performance after enabling RLS
-- 6. Consider adding pg_stats_clear() after creating indexes

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Check which tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Test RLS with different users:
-- SET ROLE authenticated; SET request.jwt.claims = '{"sub": "user-id", "role": "customer"}';
-- SELECT * FROM items; -- Should only show items in user's canteen