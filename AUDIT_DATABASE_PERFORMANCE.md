# Esc(Q) - Database Performance Audit (Phase 5)
**Query Analysis & Optimization Opportunities**

---

## QUERY PATTERN ANALYSIS

### High-Frequency Queries (from server.ts)

| Query Pattern | Table | Current Index | Estimated Frequency | Risk |
|---------------|-------|---------------|---------------------|------|
| `SELECT * FROM items WHERE canteen_id = ?` | items | idx_items_canteen | Very High (menu loads) | Low |
| `SELECT * FROM orders WHERE canteen_id = ? AND status = ?` | orders | idx_orders_canteen + idx_orders_status | High (owner dashboard) | Medium |
| `SELECT * FROM orders WHERE user_id = ?` | orders | idx_orders_user | High (customer history) | Low |
| `SELECT * FROM chefs WHERE canteen_id = ?` | chefs | idx_chefs_canteen | High (chef management) | Low |
| `SELECT * FROM kitchen_tasks WHERE canteen_id = ? AND status = ?` | kitchen_tasks | idx_kitchen_tasks_canteen + idx_kitchen_tasks_status | High (chef/owner dashboard) | Medium |
| `SELECT * FROM kitchen_tasks WHERE chef_id = ? AND status = ?` | kitchen_tasks | idx_kitchen_tasks_chef + idx_kitchen_tasks_status | High (chef dashboard) | Medium |
| `SELECT * FROM users WHERE email = ?` | users | idx_users_email (unique) | High (auth) | Low |
| `SELECT * FROM items WHERE id = ?` | items | PK | High (item details) | Low |
| `SELECT * FROM orders WHERE id = ?` | orders | PK | High (order details) | Low |
| `SELECT * FROM chefs WHERE id = ?` | chefs | PK | Medium | Low |

---

## QUERY PERFORMANCE RISKS

### 🔴 HIGH RISK - Missing Composite Indexes

| Query Pattern | Current Indexes | Missing Composite Index | Impact |
|---------------|-----------------|-------------------------|--------|
| `orders WHERE canteen_id = ? AND status = ? ORDER BY created_at DESC` | idx_orders_canteen, idx_orders_status, idx_orders_created | `(canteen_id, status, created_at DESC)` | Owner dashboard slow with 1000+ orders |
| `orders WHERE user_id = ? AND status = ?` | idx_orders_user, idx_orders_status | `(user_id, status)` | Customer history slow |
| `kitchen_tasks WHERE chef_id = ? AND status = ?` | idx_kitchen_tasks_chef, idx_kitchen_tasks_status | `(chef_id, status, created_at DESC)` | Chef dashboard slow |
| `kitchen_tasks WHERE canteen_id = ? AND status = ?` | idx_kitchen_tasks_canteen, idx_kitchen_tasks_status | `(canteen_id, status, created_at DESC)` | Owner kitchen view slow |
| `items WHERE canteen_id = ? AND available = true AND is_paused = false` | idx_items_canteen | `(canteen_id, available, is_paused)` | Menu loading with filters |
| `kitchen_tasks WHERE chef_id = ? AND status IN ('PENDING','ACCEPTED','PREPARING')` | idx_kitchen_tasks_chef, idx_kitchen_tasks_status | `(chef_id, status, created_at DESC)` | Chef active tasks query |
| `wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC` | idx_wallet_transactions_wallet | `(wallet_id, created_at DESC)` | Wallet history pagination |

### 🟡 MEDIUM RISK - Suboptimal Queries in Code

| Location | Query Pattern | Issue |
|----------|---------------|-------|
| `server.ts:2238` | `pgGetWhere('items', { canteen_id })` | No availability filter - returns paused items |
| `server.ts:2247` | `pgGetWhere('items', { canteen_id, is_paused: false })` | Good - uses partial filter |
| `server.ts:2008` | `pgGetWhere('orders', { canteen_id, pickupSlot })` | Missing status filter |
| `server.ts:2035` | `pgGetWhere('orders', { canteenId })` | Returns ALL orders - no pagination |
| `server.ts:2037` | `pgGetWhere('orders', { userId })` | Returns ALL user orders - no pagination |
| `server.ts:2060` | `pgGetWhere('chefs', { canteen_id })` | Good - simple filter |
| `server.ts:2069` | `pgGetWhere('kitchen_tasks', { canteenId })` | No status filter - returns all tasks |

### 🟢 LOW RISK - Well-Indexed Queries
| Query | Table | Index Used |
|-------|-------|------------|
| `pgGetById('items', id)` | items | PK |
| `pgGetById('orders', id)` | orders | PK |
| `pgGetById('chefs', id)` | chefs | PK |
| `pgGetByEmail('users', email)` | users | Unique index |
| `pgGetById('canteens', id)` | canteens | PK |

---

## CACHE EFFECTIVENESS

### Current Cache Strategy (server.ts)
```typescript
const dataCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 60000;        // 60 seconds for static data
const CANTEEN_CACHE_TTL = 30000; // 30 seconds for canteen data
```

| Cached Query | TTL | Hit Rate Estimate | Issue |
|--------------|-----|-------------------|-------|
| `/api/canteen?canteenId=` | 30s | Medium | Invalidate on menu/order changes? |
| `/api/colleges` | 60s | High | Rarely changes |
| `/api/offers/active` | 60s | Medium | Should invalidate on offer CRUD |
| `/api/offers/apply` | Not cached | - | Should not be cached |

### ⚠️ Cache Invalidation Issues
| Cache Key | Invalidation Trigger | Status |
|-----------|---------------------|--------|
| `canteen_${canteenId}` | `invalidateCanteenCache(canteenId)` | Called on menu CRUD, order status change |
| `colleges` | None | ❌ Never invalidated |
| `offers` | None | ❌ Never invalidated |
| `canteens` (list) | None | ❌ Never invalidated |

---

## CONNECTION POOL ANALYSIS

### Current Configuration (Supabase)
| Setting | Value | Assessment |
|---------|-------|------------|
| Pool Mode | Transaction | ✅ Good for serverless |
| Max Connections | ~100 (default) | ⚠️ May exhaust at 500 concurrent |
| Idle Timeout | 60s (default) | ✅ Standard |
| Max Client Conn (PgBouncer) | 100 (configured) | ✅ Good |

### Connection Usage Patterns
| Operation | Connections | Duration |
|-----------|-------------|----------|
| Menu load | 1-2 | ~50ms |
| Order placement | 3-5 | ~200-500ms |
| Order status update | 1-2 | ~50ms |
| Chef task update | 1-2 | ~50ms |
| Kitchen task fetch | 1-2 | ~50ms |

### Projected at 500 Concurrent Users
| Scenario | Concurrent Connections | Risk |
|----------|------------------------|------|
| Normal load | ~50-100 | ✅ Safe |
| Lunch peak (100 orders/min) | ~200-300 | ⚠️ Near limit |
| Spike (500 users active) | 300-400 | ❌ Exhaustion likely |

**Recommendation**: Increase PgBouncer pool to 200-300, enable `pool_mode = transaction` (already set), consider read replicas for read-heavy endpoints.

---

## QUERY OPTIMIZATION RECOMMENDATIONS

### 1. Add Composite Indexes (Priority: HIGH)

```sql
-- Order queries (owner dashboard)
CREATE INDEX CONCURRENTLY idx_orders_canteen_status_created 
ON orders(canteen_id, status, created_at DESC);

-- Order queries (customer history)
CREATE INDEX CONCURRENTLY idx_orders_user_status 
ON orders(user_id, status);

-- Kitchen tasks (chef dashboard)
CREATE INDEX CONCURRENTLY idx_kitchen_tasks_chef_status_created 
ON kitchen_tasks(chef_id, status, created_at DESC);

-- Kitchen tasks (owner view)
CREATE INDEX CONCURRENTLY idx_kitchen_tasks_canteen_status_created 
ON kitchen_tasks(canteen_id, status, created_at DESC);

-- Menu items with availability filter
CREATE INDEX CONCURRENTLY idx_items_canteen_available_paused 
ON items(canteen_id, available, is_paused) 
WHERE available = true AND is_paused = false;

-- Wallet transaction pagination
CREATE INDEX CONCURRENTLY idx_wallet_transactions_wallet_created 
ON wallet_transactions(wallet_id, created_at DESC);
```

### 2. Add Pagination to Unbounded Queries (HIGH PRIORITY)

| Endpoint | Current | Recommended |
|----------|---------|-------------|
| `GET /api/canteen/order?canteenId=...` | All orders | `?limit=50&offset=0&status=` |
| `GET /api/user/orders?userId=` | All orders | `?limit=20&offset=0` |
| `GET /api/kitchen/tasks?canteenId=` | All tasks | `?limit=100&status=` |
| `GET /api/chefs?canteenId=` | All chefs | `?limit=50` |

### 3. Cache Invalidation Fixes
```typescript
// Add to all CRUD operations
function invalidateCanteenCache(canteenId: string) {
  dataCache.delete(`canteen_${canteenId}`);
  dataCache.delete(`menu_${canteenId}`);
  dataCache.delete(`offers_${canteenId}`);
  dataCache.delete(`kitchen_tasks_${canteenId}`);
}

// Call after: menu CRUD, order status change, chef CRUD, offer CRUD
```

### 4. Query Refactoring Opportunities

| Current | Optimized |
|---------|-----------|
| `pgGetWhere('orders', { canteenId })` → returns ALL | Add `status`, `limit`, `offset` params |
| `pgGetWhere('items', { canteenId })` → includes paused | Add `available: true, isPaused: false` default |
| `pgGetWhere('kitchen_tasks', { canteenId })` → all statuses | Add `status` filter param |
| `orders.items` stored as JSONB - full scan for item analytics | Add materialized view or separate order_items table |

---

## LOAD TEST SIMULATION PROJECTIONS

### 500 Concurrent Users - Read/Write Mix

| Operation | % of Traffic | QPS | P95 Latency Target | Current Index Support |
|-----------|--------------|-----|-------------------|----------------------|
| Menu browse | 40% | 200 | < 200ms | ✅ Good |
| Item detail | 15% | 75 | < 100ms | ✅ Good |
| Cart operations | 15% | 75 | < 100ms | N/A (client-side) |
| Order placement | 10% | 50 | < 500ms | ⚠️ Needs composite index |
| Order status polling | 10% | 50 | < 200ms | ⚠️ Needs composite index |
| Kitchen task updates | 5% | 25 | < 100ms | ✅ Good |
| Chef task polling | 5% | 25 | < 200ms | ⚠️ Needs composite index |

---

## DATABASE SIZING ESTIMATES (500 Users)

| Table | Current Rows | Projected (1 yr) | Storage | Index Size |
|-------|--------------|------------------|---------|------------|
| users | ~10 | 5,000 | ~2 MB | ~1 MB |
| items | ~10 | 500 | ~2 MB | ~1 MB |
| orders | ~10 | 50,000/month | ~50 MB | ~20 MB |
| orders (1 yr) | - | 600,000 | ~600 MB | ~200 MB |
| kitchen_tasks | ~10 | 200,000/month | ~200 MB | ~80 MB |
| wallet_transactions | ~10 | 100,000/month | ~100 MB | ~40 MB |
| reviews | ~10 | 10,000 | ~5 MB | ~2 MB |

### Partitioning Strategy (Future)
```sql
-- When orders > 1M rows
CREATE TABLE orders_2025_q1 PARTITION OF orders
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

-- Or use pg_partman for automated partitioning
```

---

## MONITORING QUERIES

```sql
-- Slow queries (>100ms)
SELECT query, mean_exec_time, calls, rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Table bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Connection usage
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

---

*End of Database Performance Audit - Phase 5*