# Esc(Q) - Database Audit (Phase 4)
**PostgreSQL/Supabase Schema Analysis**

---

## SCHEMA INVENTORY

### Core Tables

| Table | Columns | PK | FKs | Indexes | RLS |
|-------|---------|----|-----|---------|-----|
| **colleges** | 15 | id | - | - | ❌ |
| **canteens** | 9 | id | college_id → colleges | idx_canteens_college | ❌ |
| **subcanteens** | 4 | id | canteen_id → canteens | idx_subcanteens_canteen | ❌ |
| **users** | 16 | id | college_id, canteen_id, sub_canteen_id | idx_users_canteen, idx_users_college, idx_users_role | ❌ |
| **items** | 21 | id | canteen_id, sub_canteen_id, college_id | idx_items_canteen, idx_items_subcanteen | ❌ |
| **orders** | 32 | id | user_id, canteen_id, sub_canteen_id, college_id | idx_orders_canteen, idx_orders_user, idx_orders_status, idx_orders_created | ❌ |
| **reviews** | 15 | id | canteen_id, sub_canteen_id, user_id | idx_reviews_canteen | ❌ |
| **ingredients** | 7 | id | canteen_id, sub_canteen_id | idx_ingredients_canteen | ❌ |
| **settings** | 2 | canteen_id | - | - | ❌ |
| **otp_store** | 4 | email | - | - | ❌ |
| **support_tickets** | 18 | id | user_id, canteen_id, college_id | idx_support_tickets_user, idx_support_tickets_status | ❌ |
| **walkin_bills** | 25 | id | canteen_id, sub_canteen_id, college_id | idx_walkin_bills_canteen | ❌ |

### Chef & Kitchen Tables (from chef_migration.sql)

| Table | Columns | PK | FKs | Indexes | RLS |
|-------|---------|----|-----|---------|-----|
| **chefs** | 13 | id (UUID) | canteen_id → canteens, user_id → users, created_by → users | idx_chefs_canteen, idx_chefs_user, idx_chefs_status | ✅ |
| **chef_leave** | 8 | id (UUID) | chef_id → chefs, created_by → users | idx_chef_leave_chef, idx_chef_leave_dates | ✅ |
| **kitchen_tasks** | 15 | id (UUID) | canteen_id → canteens, chef_id → chefs, item_id → items, order_id | idx_kitchen_tasks_canteen, idx_kitchen_tasks_chef, idx_kitchen_tasks_status, idx_kitchen_tasks_order, idx_kitchen_tasks_item | ✅ |
| **chef_availability** | 8 | id (UUID) | chef_id → chefs | - | ❌ |

### Wallet Tables (from wallet_migration.sql)

| Table | Columns | PK | FKs | Indexes | RLS |
|-------|---------|----|-----|---------|-----|
| **wallets** | 6 | id (UUID) | user_id → users | idx_wallets_user | ✅ |
| **wallet_transactions** | 11 | id (UUID) | wallet_id → wallets | idx_wallet_transactions_wallet, idx_wallet_transactions_created, idx_wallet_transactions_ref, idx_wallet_transactions_idempotency | ✅ |
| **wallet_topups** | 10 | id (UUID) | wallet_id → wallets | idx_wallet_topups_wallet, idx_wallet_topups_status, idx_wallet_topups_idempotency | ✅ |

---

## SCHEMA ANALYSIS

### ✅ STRENGTHS

1. **UUID Primary Keys** for new tables (chefs, kitchen_tasks, wallets) - good for distributed systems
2. **Foreign Key Constraints** with proper CASCADE/SET NULL on delete
3. **Check Constraints** on status fields (e.g., chef status, kitchen_task status, wallet status)
4. **JSONB** for flexible fields (tags, branding, items in orders)
5. **Indexes** on frequently queried columns (canteen_id, user_id, status, created_at)
5. **RLS Enabled** on new tables (chefs, kitchen_tasks, chef_leave, wallets, wallet_transactions, wallet_topups)
6. **Unique Constraints** where needed (users.email, wallets.user_id, wallet_transactions.idempotency_key)
7. **Triggers** for updated_at timestamps on new tables
8. **PostgreSQL Functions** for wallet operations (atomic transactions, balance calculation)
8. **Views** for reconciliation (wallet_reconciliation)

### ⚠️ ISSUES IDENTIFIED

#### 1. **DUPLICATE TABLE DEFINITIONS**
| Issue | Location | Impact |
|-------|----------|--------|
| `chef_leave` defined 3 times in chef_migration.sql | Lines 25-33, 59-67, 80-88 | Duplicate table creation, potential conflicts |
| `chef_leave` indexes duplicated | Lines 109-110, 116-117, 200-201, 206-207, 216-217, 223-224 | Redundant index creation |
| `idx_kitchen_tasks_canteen_status` defined 3 times | Lines 118, 123, 221 | Redundant |
| `idx_kitchen_tasks_chef_status` defined 3 times | Lines 119, 124, 222 | Redundant |
| `idx_chef_leave_chef` defined 3 times | Lines 109, 116, 206 | Redundant |
| `idx_chef_leave_dates` defined 3 times | Lines 110, 117, 207 | Redundant |

#### 2. **MISSING RLS ON CORE TABLES**
| Table | Risk |
|-------|------|
| `colleges` | No RLS - superadmin access only via API middleware |
| `canteens` | No RLS - owner/admin access only via API middleware |
| `users` | No RLS - email unique but no row-level access control |
| `items` | No RLS - canteen-scoped access only via API middleware |
| `orders` | No RLS - user/canteen scoped via API middleware |
| `orders` | No RLS - user/canteen scoped via API middleware |
| `ingredients` | No RLS |
| `reviews` | No RLS |
| `support_tickets` | No RLS |
| `walkin_bills` | No RLS |
| `settings` | No RLS |
| `otp_store` | No RLS |
| `ingredients` | No RLS |
| `chef_availability` | No RLS |

#### 3. **SCHEMA INCONSISTENCIES**
| Issue | Details |
|-------|---------|
| `users.password` stored in plaintext | Should be hashed (currently handled by Supabase Auth) |
| `users.password` in schema but Supabase Auth manages passwords | Redundant column |
| `items.recipe` as JSONB but no schema validation | Flexible but no validation |
| `orders.items` as JSONB but no schema validation | Flexible but no validation |
| `orders.grand_total` vs `orders.total_price` | Duplicate amount fields |
| `orders.type` field added but not in types.ts | Schema drift |
| `orders.bill_number`, `customer_name`, `customer_email` etc. | Walk-in fields mixed with regular orders |
| `canteens.owner_id` as TEXT not UUID | Inconsistent with chefs.user_id (UUID) |
| `chefs.canteen_id` as TEXT not UUID | Inconsistent with canteens.id (TEXT) |

#### 4. **MISSING INDEXES**
| Query Pattern | Missing Index |
|---------------|---------------|
| Orders by user + status | `(user_id, status)` |
| Orders by canteen + status + created_at | `(canteen_id, status, created_at)` |
| Items by canteen + available + is_paused | `(canteen_id, available, is_paused)` |
| Kitchen tasks by chef + status + created_at | `(chef_id, status, created_at)` |
| Wallet transactions by wallet + created_at | `(wallet_id, created_at)` |
| Reviews by menu_item + rating | `(menu_item_id, rating)` |

#### 5. **DATA TYPE INCONSISTENCIES**
| Table | Column | Current Type | Suggested |
|-------|--------|--------------|-----------|
| `users.created_at` | BIGINT | TIMESTAMPTZ |
| `orders.created_at` | BIGINT | TIMESTAMPTZ |
| `orders.timestamp` | TEXT | TIMESTAMPTZ |
| `reviews.timestamp` | TEXT | TIMESTAMPTZ |
| `settings.no_show_minutes` | INTEGER | SMALLINT |
| `items.prep_time` | INTEGER | SMALLINT |
| `items.stock` | INTEGER | SMALLINT |
| `items.daily_limit` | INTEGER | SMALLINT |
| `items.booked_today` | INTEGER | SMALLINT |

---

## FOREIGN KEY ANALYSIS

| FK Relationship | Status | Notes |
|-----------------|--------|-------|
| `canteens.college_id → colleges.id` | ✅ | CASCADE not specified |
| `subcanteens.canteen_id → canteens.id` | ✅ | CASCADE not specified |
| `users.college_id → colleges.id` | ❌ | No FK constraint |
| `users.canteen_id → canteens.id` | ❌ | No FK constraint |
| `users.sub_canteen_id → subcanteens.id` | ❌ | No FK constraint |
| `items.canteen_id → canteens.id` | ✅ | In schema.sql only |
| `items.sub_canteen_id → subcanteens.id` | ❌ | No FK constraint |
| `orders.canteen_id → canteens.id` | ❌ | No FK constraint |
| `orders.user_id → users.id` | ❌ | No FK constraint |
| `reviews.canteen_id → canteens.id` | ❌ | No FK constraint |
| `reviews.user_id → users.id` | ❌ | No FK constraint |
| `ingredients.canteen_id → canteens.id` | ❌ | No FK constraint |
| `chefs.canteen_id → canteens.id` | ✅ | CASCADE in migration |
| `chefs.user_id → users.id` | ✅ | SET NULL in migration |
| `kitchen_tasks.canteen_id → canteens.id` | ✅ | CASCADE in migration |
| `kitchen_tasks.chef_id → chefs.id` | ✅ | SET NULL in migration |
| `chef_leave.chef_id → chefs.id` | ✅ | CASCADE in migration |
| `wallets.user_id → users.id` | ✅ | CASCADE in migration |
| `wallet_transactions.wallet_id → wallets.id` | ✅ | CASCADE in migration |
| `wallet_topups.wallet_id → wallets.id` | ✅ | CASCADE in migration |

---

## RLS POLICY ANALYSIS

### ✅ IMPLEMENTED (New Tables)
| Table | Policy | Coverage |
|-------|--------|----------|
| `chefs` | View in canteen, Owner manage | Good |
| `kitchen_tasks` | View in canteen, Chef own tasks, Owner manage | Good |
| `chef_leave` | Owner manage | Good |
| `wallets` | User own wallet | Good |
| `wallet_transactions` | User own via wallet | Good |
| `wallet_topups` | User own via wallet | Good |

### ❌ MISSING (Core Tables)
| Table | Required Policies |
|-------|-------------------|
| `users` | User own row, Admin manage |
| `canteens` | Owner view/manage own, SuperAdmin all |
| `colleges` | SuperAdmin all, Admin own college |
| `items` | Canteen-scoped read, Owner write |
| `orders` | User own, Canteen-scoped for owner/staff |
| `reviews` | User own, Public read for canteen |
| `ingredients` | Canteen-scoped |
| `support_tickets` | User own, Admin all |
| `walkin_bills` | Canteen-scoped |

---

## DATA INTEGRITY CHECKS

| Check | Status | Notes |
|-------|--------|-------|
| Duplicate `chef_leave` table | ❌ FAIL | 3 definitions |
| Duplicate indexes | ❌ FAIL | Multiple duplicates |
| Missing FK constraints | ⚠️ PARTIAL | ~50% missing |
| RLS on core tables | ⚠️ PARTIAL | Only new tables |
| Unique constraints | ✅ PASS | Email, idempotency keys |
| Check constraints | ✅ PASS | Status enums |
| Trigger functions | ✅ PASS | updated_at triggers |
| Wallet functions | ✅ PASS | Atomic operations |

---

## RECOMMENDATIONS

### CRITICAL (Fix Immediately)
1. **Remove duplicate table/index definitions** in chef_migration.sql
2. **Add missing FK constraints** on core tables
3. **Enable RLS** on all core tables with proper policies
4. **Fix duplicate `chef_leave` table definition** (3x)

### HIGH (Fix Soon)
5. Add missing indexes for query performance
6. Standardize timestamp columns to TIMESTAMPTZ
6. Add missing FK constraints on core relationships
7. Remove `users.password` column (Supabase Auth handles auth)
8. Reconcile `orders.grand_total` vs `total_price`

### MEDIUM (Technical Debt)
9. Add schema validation for JSONB fields
10. Add composite indexes for common query patterns
11. Document RLS policies in code comments
12. Add migration versioning system

---

## RLS POLICY TESTS NEEDED

| Test Case | Expected | Status |
|-----------|----------|--------|
| Customer A reads Customer B's orders | DENY | 🔄 PENDING |
| Customer A reads Customer B's wallet | DENY | 🔄 PENDING |
| Chef A reads Chef B's kitchen tasks | DENY | 🔄 PENDING |
| Owner A reads Owner B's canteen orders | DENY | 🔄 PENDING |
| SuperAdmin reads all | ALLOW | 🔄 PENDING |
| Chef reads own assigned tasks | ALLOW | 🔄 PENDING |
| Owner reads own canteen orders | ALLOW | 🔄 PENDING |
| Staff reads canteen orders | ALLOW | 🔄 PENDING |

---

*End of Database Audit - Phase 4*