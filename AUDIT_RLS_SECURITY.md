# Esc(Q) - RLS / Supabase Security Audit (Phase 6)
**Row Level Security Policy Audit**

---

## RLS STATUS SUMMARY

| Table | RLS Enabled | Policies | Coverage | Status |
|-------|-------------|----------|----------|--------|
| **colleges** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **canteens** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **users** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **items** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **orders** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **reviews** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **ingredients** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **subcanteens** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **settings** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **otp_store** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **support_tickets** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **walkin_bills** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **walkin_bills** | ❌ NO | 0 | None | 🔴 CRITICAL |
| **chefs** | ✅ YES | 2 | Partial | ⚠️ PARTIAL |
| **chef_leave** | ✅ YES | 1 | Partial | ⚠️ PARTIAL |
| **kitchen_tasks** | ✅ YES | 4 | Good | ✅ GOOD |
| **wallets** | ✅ YES | 1 | Good | ✅ GOOD |
| **wallet_transactions** | ✅ YES | 1 | Good | ✅ GOOD |
| **wallet_topups** | ✅ YES | 1 | Good | ✅ GOOD |

**Overall**: 14/20 tables without RLS = **70% unprotected**

---

## DETAILED POLICY ANALYSIS

### ✅ TABLES WITH RLS (Implemented)

#### 1. `chefs` - Partial Coverage
```sql
-- Policy 1: Users can view chefs in their canteen
CREATE POLICY "Users can view chefs in their canteen" ON chefs
  FOR SELECT USING (
    canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
    )
  );

-- Policy 2: Canteen owners can manage chefs
CREATE POLICY "Canteen owners can manage chefs" ON chefs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = chefs.canteen_id
      AND u.role IN ('owner', 'admin', 'superadmin')
    )
  );
```
**Coverage**: SELECT + ALL for owners
**Gap**: Chef users cannot see their own profile unless they're also in users table with canteen_id

#### 2. `kitchen_tasks` - Good Coverage
```sql
-- Policy 1: Users can view kitchen tasks in their canteen
CREATE POLICY "Users can view kitchen tasks in their canteen" ON kitchen_tasks
  FOR SELECT USING (
    canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
    )
  );

-- Policy 2: Chefs can view their assigned tasks
CREATE POLICY "Chefs can view their assigned tasks" ON kitchen_tasks
  FOR SELECT USING (
    chef_id IN (
      SELECT id FROM chefs WHERE user_id = auth.uid()::text
    )
  );

-- Policy 3: Chefs can update their assigned tasks
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

-- Policy 4: Canteen owners can manage tasks
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
```
**Coverage**: Good - covers chef view/update, owner view/manage, canteen-scoped access

#### 3. `chef_leave` - Partial Coverage
```sql
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
```
**Coverage**: Owner ALL operations only
**Gap**: Chef cannot view their own leave records

#### 4. `wallets` - Good Coverage
```sql
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Service role full access" ON wallets FOR ALL USING (auth.role() = 'service_role');
```

#### 4. `wallet_transactions` - Good Coverage
```sql
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid()::text)
  );

CREATE POLICY "Service role full access" ON wallet_transactions FOR ALL USING (auth.role() = 'service_role');
```

#### 4. `wallet_topups` - Good Coverage
```sql
CREATE POLICY "Users can view own topups" ON wallet_topups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets WHERE id = wallet_topups.wallet_id AND user_id = auth.uid()::text)
  );

CREATE POLICY "Service role full access" ON wallet_topups FOR ALL USING (auth.role() = 'service_role');
```

---

### ❌ TABLES WITHOUT RLS (CRITICAL)

| Table | Risk | Required Policies |
|-------|------|-------------------|
| **colleges** | Superadmin data exposed | SuperAdmin ALL, Admin own college |
| **canteens** | Owner data exposed | Owner CRUD own, SuperAdmin ALL |
| **users** | PII exposed | User own row, Admin manage, SuperAdmin ALL |
| **items** | Menu data exposed | Canteen-scoped read, Owner write |
| **orders** | Order/PII exposed | User own, Canteen-scoped for owner/staff |
| **reviews** | User content exposed | User own write, Public read for canteen |
| **ingredients** | Inventory exposed | Canteen-scoped |
| **subcanteens** | Structure exposed | Canteen-scoped |
| **settings** | Config exposed | Owner/SuperAdmin |
| **otp_store** | OTP codes exposed | User own, Service role |
| **support_tickets** | PII exposed | User own, Admin ALL |
| **walkin_bills** | Customer data exposed | Canteen-scoped |
| **subcanteens** | Structure exposed | Canteen-scoped |
| **settings** | Config exposed | Owner/SuperAdmin |

---

## RLS POLICY TEST MATRIX

| Test Case | User A (Customer) | User B (Customer) | Chef A | Chef B | Owner A | Owner B | Staff A | Admin | SuperAdmin |
|-----------|-------------------|-------------------|--------|--------|---------|---------|---------|-------|------------|
| **users** | | | | | | | | | |
| Read own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Read other | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Update own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **canteens** | | | | | | | | | |
| Read own | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Read other | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Write | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **items** | | | | | | | | | |
| Read (canteen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **orders** | | | | | | | | | |
| Read own | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Read other | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Write (create) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write (status) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **chefs** | | | | | | | | | |
| Read (canteen) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Read own (chef) | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Write | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **kitchen_tasks** | | | | | | | | | |
| Read (canteen) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Read own (chef) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Update own (chef) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Write (owner) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **wallets** | | | | | | | | | |
| Read own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **wallet_transactions** | | | | | | | | | |
| Read own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **wallet_topups** | | | | | | | | | |
| Read own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **support_tickets** | | | | | | | | | |
| Read own | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **reviews** | | | | | | | | | |
| Read (canteen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write own | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |

**Legend**: ✅ = Allow, ❌ = Deny, ⚠️ = Partial/Unclear, Empty = Not Tested

---

## SECURITY TEST CASES (Must Pass)

### Authentication Bypass Tests
| Test | Endpoint | Method | Expected | Status |
|------|----------|--------|----------|--------|
| No token | `/api/canteen/menu` | GET | 401 | 🔄 PENDING |
| Invalid token | `/api/canteen/menu` | GET | 401 | 🔄 PENDING |
| Expired token | `/api/canteen/menu` | GET | 401 | 🔄 PENDING |
| Malformed token | `/api/canteen/menu` | GET | 401 | 🔄 PENDING |

### Authorization Bypass Tests
| Test | User | Endpoint | Method | Expected | Status |
|------|------|----------|--------|----------|--------|
| Customer → Owner API | Customer | `/api/canteen/menu` | POST | 403 | 🔄 PENDING |
| Customer → Chef API | Customer | `/api/kitchen/tasks` | GET | 403 | 🔄 PENDING |
| Customer → Admin API | Customer | `/api/colleges` | POST | 403 | 🔄 PENDING |
| Staff → Owner API | Staff | `/api/canteen/menu` | POST | 403 | 🔄 PENDING |
| Chef → Owner API | Chef | `/api/canteen/menu` | POST | 403 | 🔄 PENDING |
| Owner A → Owner B data | Owner A | `/api/canteen?canteenId=B` | GET | 403 | 🔄 PENDING |
| Chef A → Chef B tasks | Chef A | `/api/kitchen/tasks` | GET | 403 (sees only own) | 🔄 PENDING |

### IDOR/BOLA Tests
| Test | Endpoint | Manipulation | Expected | Status |
|------|----------|--------------|----------|--------|
| Order ID traversal | `/api/canteen/order/status` | `id=OTHER_ORDER` | 403/404 | 🔄 PENDING |
| Chef task ID traversal | `/api/kitchen/tasks/ID/status` | `id=OTHER_CHEF_TASK` | 403 | 🔄 PENDING |
| Wallet ID traversal | `/api/wallet` | `walletId=OTHER` | 403 | 🔄 PENDING |
| Chef ID traversal | `/api/chefs/ID` | `id=OTHER_CHEF` | 403 | 🔄 PENDING |

### Input Validation Tests
| Test | Endpoint | Payload | Expected | Status |
|------|----------|---------|----------|--------|
| SQL Injection | `/api/canteen/menu` | `name=test'; DROP TABLE items;--` | 400/500 | 🔄 PENDING |
| XSS in name | `/api/canteen/menu` | `name=<script>alert(1)</script>` | Sanitized/400 | 🔄 PENDING |
| XSS in description | `/api/canteen/menu` | `description=<img src=x onerror=alert(1)>` | Sanitized/400 | 🔄 PENDING |
| Path Traversal | Image upload | `../../../etc/passwd` | 400 | 🔄 PENDING |
| Oversized request | `/api/canteen/menu` | 10MB payload | 413 | 🔄 PENDING |

---

## SUPABASE CONFIGURATION AUDIT

### Auth Settings
| Setting | Current | Recommended | Status |
|---------|---------|-------------|--------|
| Email confirm | ? | Required | 🔄 PENDING |
| Phone confirm | ? | Optional | 🔄 PENDING |
| JWT expiry | ? | 1 hour | 🔄 PENDING |
| Refresh token rotation | ? | Enabled | 🔄 PENDING |
| MFA | ? | Optional for admin | 🔄 PENDING |

### Database Settings
| Setting | Current | Recommended | Status |
|---------|---------|-------------|--------|
| RLS on all tables | 6/20 | All tables | ❌ FAIL |
| SSL enforced | ? | Required | 🔄 PENDING |
| Connection pooling | Transaction | Transaction | ✅ PASS |
| Prepared statements | ? | Enabled | 🔄 PENDING |

### API Security
| Feature | Status | Notes |
|---------|--------|-------|
| Rate limiting | ✅ In-memory | Per IP, 30/min - move to Redis for production |
| CORS | ✅ Configured | Allowlist configured |
| Security headers | ✅ Helmet | HSTS, XSS, noSniff, Referrer-Policy |
| CORS origins | 5 allowed | Restrict to production domains only |
| JWT verification | ✅ Supabase | Server-side validation |

---

## SECURITY FINDINGS SUMMARY

| Severity | Count | Category |
|----------|-------|----------|
| **CRITICAL** | 14 | Missing RLS on core tables |
| **HIGH** | 3 | Missing RLS policies, IDOR potential |
| **MEDIUM** | 5 | Partial chef policies, cache invalidation |
| **LOW** | 2 | Cache headers, security headers |
| **INFO** | 3 | Rate limiting storage, audit logging |

### CRITICAL FINDINGS

| ID | Finding | Component | Risk | Fix |
|----|---------|-----------|------|-----|
| CR-01 | No RLS on `users` table | Database | PII exposure | Enable RLS + policies |
| CR-02 | No RLS on `orders` table | Database | Order/PII exposure | Enable RLS + policies |
| CR-03 | No RLS on `items` table | Database | Menu data exposure | Enable RLS + policies |
| CR-04 | No RLS on `canteens` table | Database | Business data exposure | Enable RLS + policies |
| CR-05 | No RLS on `users` email unique | Auth | Email enumeration | Add rate limit on register |
| CR-06 | No RLS on `wallets`/`wallet_transactions` for user isolation | Wallet | Financial data leak | Verify policies work |

### HIGH FINDINGS
| ID | Finding | Component | Risk | Fix |
|----|---------|-----------|------|-----|
| HI-01 | Chef cannot view own profile via RLS | chefs table | Chef cannot self-serve | Add chef self-view policy |
| HI-02 | Chef cannot view own leave | chef_leave table | Chef unaware of leave | Add chef self-view policy |
| HI-03 | In-memory rate limiting | server.ts | Bypass in serverless | Use Redis/Upstash |
| HI-04 | Cache never invalidated | server.ts | Stale data | Add invalidation calls |
| HI-05 | No pagination on list endpoints | API | DoS via large responses | Add limit/offset |

---

## RECOMMENDED RLS POLICIES TO ADD

### 1. `users` Table
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- User can read own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- User can update own profile (not role)
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id AND role = (SELECT role FROM users WHERE id = auth.uid()::text));

-- SuperAdmin/Admin can manage all
CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role IN ('superadmin', 'admin')
    )
  );
```

### 2. `canteens` Table
```sql
ALTER TABLE canteens ENABLE ROW LEVEL SECURITY;

-- Owner can manage own canteen
CREATE POLICY "Owner can manage own canteen" ON canteens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = canteens.id
      AND u.role IN ('owner', 'superadmin')
    )
  );

-- SuperAdmin can manage all
CREATE POLICY "SuperAdmin can manage all canteens" ON canteens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role = 'superadmin'
    )
  );

-- Staff/Chef can read their canteen
CREATE POLICY "Staff can view canteen" ON canteens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = canteens.id
    )
  );
```

### 3. `items` Table
```sql
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Anyone can read available items in their canteen
CREATE POLICY "Read available items in canteen" ON items
  FOR SELECT USING (
    available = true 
    AND is_paused = false
    AND canteen_id IN (
      SELECT canteen_id FROM users WHERE id = auth.uid()::text
    )
  );

-- Owner can manage all items in their canteen
CREATE POLICY "Owner manages items" ON items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = items.canteen_id
      AND u.role IN ('owner', 'superadmin')
    )
  );
```

### 4. `orders` Table
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Customer reads own orders
CREATE POLICY "Customer reads own orders" ON orders
  FOR SELECT USING (user_id = auth.uid()::text);

-- Owner/Staff read canteen orders
CREATE POLICY "Owner reads canteen orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = orders.canteen_id
      AND u.role IN ('owner', 'staff', 'superadmin')
    )
  );

-- Customer creates own orders
CREATE POLICY "Customer creates orders" ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Owner/Staff update status
CREATE POLICY "Owner updates order status" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.canteen_id = orders.canteen_id
      AND u.role IN ('owner', 'staff', 'superadmin')
    )
  );
```

### 5. `chefs` Table - Fix Chef Self-View
```sql
-- Add chef self-view policy
CREATE POLICY "Chef can view own profile" ON chefs
  FOR SELECT USING (
    user_id = auth.uid()::text
  );
```

### 6. `chef_leave` Table - Fix Chef Self-View
```sql
CREATE POLICY "Chef can view own leave" ON chef_leave
  FOR SELECT USING (
    chef_id IN (
      SELECT id FROM chefs WHERE user_id = auth.uid()::text
    )
  );
```

### 7. `support_tickets` Table
```sql
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own tickets" ON support_tickets
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "User creates tickets" ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Admin manages all tickets" ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::text 
      AND u.role IN ('admin', 'superadmin')
    )
  );
```

---

## IMPLEMENTATION PRIORITY

| Priority | Tables | Effort | Risk Reduction |
|----------|--------|--------|----------------|
| **P0 - CRITICAL** | users, orders, items, canteens, colleges | High | 80% |
| **P1 - HIGH** | support_tickets, walkin_bills, otp_store, settings | Medium | 15% |
| **P2 - MEDIUM** | ingredients, reviews, subcanteens, settings | Low | 5% |

---

## VERIFICATION CHECKLIST

After implementing policies, verify:

- [ ] `SELECT * FROM users WHERE id != auth.uid()` returns 0 rows for regular user
- [ ] `SELECT * FROM orders WHERE user_id != auth.uid()` returns 0 rows for customer
- [ ] `SELECT * FROM items WHERE canteen_id != 'my_canteen'` returns 0 rows for owner
- [ ] `SELECT * FROM kitchen_tasks WHERE chef_id != 'my_chef_id'` returns 0 rows for chef
- [ ] `SELECT * FROM wallets WHERE user_id != auth.uid()` returns 0 rows for user
- [ ] `SELECT * FROM wallet_transactions WHERE wallet_id NOT IN (SELECT id FROM wallets WHERE user_id = auth.uid())` returns 0 rows
- [ ] SuperAdmin can access all tables
- [ ] Owner can manage own canteen only
- [ ] Admin can manage users in their college only
- [ ] Chef can view/update only own tasks
- [ ] Chef can view own leave records

---

*End of RLS / Supabase Security Audit - Phase 6*