# Esc(Q) - Feature Regression Audit (Phase 2)
**Testing Every Existing Critical Workflow**

---

## AUDIT STATUS LEGEND
- ✅ **PASS** - Tested and working
- ⚠️ **PARTIAL** - Partially working / needs investigation
- ❌ **FAIL** - Broken / not working
- 🔄 **PENDING** - Not yet tested
- 📝 **NOTES** - Requires manual verification

---

## CUSTOMER WORKFLOWS

| Workflow | Status | Notes |
|----------|--------|-------|
| **Registration** | 🔄 PENDING | Need to test email validation, password strength, college selection |
| **Login** | 🔄 PENDING | Test email/password, OTP for superadmin, session creation |
| **Logout** | 🔄 PENDING | Test session cleanup, token invalidation |
| **Session Persistence** | 🔄 PENDING | Test app restart, token refresh, offline handling |
| **College Selection** | 🔄 PENDING | Test college list loading, selection persistence |
| **Canteen Selection** | 🔄 PENDING | Test canteen list per college, sub-canteen selection |
| **Menu Loading** | 🔄 PENDING | Test menu fetch, caching, real-time updates |
| **Menu Availability** | 🔄 PENDING | Test stock, daily limits, isPaused, prep time |
| **Item Details** | 🔄 PENDING | Test image, description, tags, nutrition |
| **Cart** | 🔄 PENDING | Test add/remove, quantity changes, persistence |
| **Quantity Changes** | 🔄 PENDING | Test min/max, stock validation |
| **Pickup Selection** | 🔄 PENDING | Test ASAP vs scheduled slots, capacity limits |
| **Checkout** | 🔄 PENDING | Test order summary, platform fee display |
| **Platform Fee** | 🔄 PENDING | Test free/flat/percentage/tiered/custom fee types |
| **Payment** | 🔄 PENDING | Test Razorpay, Vyapar, wallet, UPI |
| **Payment Verification** | 🔄 PENDING | Test server-side verification, webhook handling |
| **Order Creation** | 🔄 PENDING | Test order ID generation, item linkage, total calc |
| **Order Status** | 🔄 PENDING | Test real-time status updates (pending→preparing→ready) |
| **QR Generation** | 🔄 PENDING | Test QR code generation, payload structure |
| **QR Display** | 🔄 PENDING | Test QR rendering, refresh, expiry |
| **QR Verification** | 🔄 PENDING | Test server-side verification, duplicate detection |
| **Pickup** | 🔄 PENDING | Test QR scan, status transition to collected |
| **Order History** | 🔄 PENDING | Test pagination, filtering, details |
| **Notifications** | 🔄 PENDING | Test push, in-app, email, ordering |
| **Reviews** | 🔄 PENDING | Test rating, sentiment analysis, display |
| **Support** | 🔄 PENDING | Test ticket creation, replies, status |

---

## OWNER WORKFLOWS

| Workflow | Status | Notes |
|----------|--------|-------|
| **Login** | 🔄 PENDING | Test owner role routing to CanteenAdmin |
| **Dashboard** | 🔄 PENDING | Test stats, charts, real-time updates |
| **Canteen Management** | 🔄 PENDING | Test canteen CRUD, settings |
| **Menu Management** | 🔄 PENDING | Test item CRUD, categories, tags |
| **Item Creation** | 🔄 PENDING | Test all fields: name, price, stock, recipe, chef assignment |
| **Item Editing** | 🔄 PENDING | Test partial updates, image upload |
| **Item Availability** | 🔄 PENDING | Test stock, daily limits, isPaused toggle |
| **Order Management** | 🔄 PENDING | Test order list, status updates, slot editing |
| **Chef Management** | 🔄 PENDING | Test chef CRUD, specialization, status |
| **Kitchen Management** | 🔄 PENDING | Test task board, status updates, routing |
| **Staff Functionality** | 🔄 PENDING | Test staff workflow, permissions |
| **Reports/Analytics** | 🔄 PENDING | Test existing reports, dashboard metrics |

---

## CHEF WORKFLOWS

| Workflow | Status | Notes |
|----------|--------|-------|
| **Login** | 🔄 PENDING | Test chef role routing to MyTasksScreen |
| **Assigned Tasks** | 🔄 PENDING | Test task filtering by chef ID |
| **Task Visibility** | 🔄 PENDING | Test only assigned tasks visible |
| **Task Status** | 🔄 PENDING | Test PENDING→ACCEPTED→PREPARING→READY |
| **Start Cooking** | 🔄 PENDING | Test ACCEPTED→PREPARING transition |
| **Mark Ready** | 🔄 PENDING | Test PREPARING→READY transition |
| **Notifications** | 🔄 PENDING | Test push for new tasks, status changes |
| **Leave/Availability** | 🔄 PENDING | Test leave creation, auto-routing |
| **Backup Chef Routing** | 🔄 PENDING | Test primary unavailable → backup assignment |

---

## STAFF WORKFLOWS

| Workflow | Status | Notes |
|----------|--------|-------|
| **Login** | 🔄 PENDING | Test staff role routing to StaffHomeScreen |
| **Order Fulfilment** | 🔄 PENDING | Test order list, QR scanning |
| **Pickup Workflow** | 🔄 PENDING | Test QR verification, collected status |
| **QR Verification** | 🔄 PENDING | Test server-side verification |
| **Existing Permissions** | 🔄 PENDING | Test staff cannot access owner/chef features |

---

## ADMIN/SUPERADMIN WORKFLOWS

| Workflow | Status | Notes |
|----------|--------|-------|
| **Login** | 🔄 PENDING | Test superadmin role routing to ServicePanel |
| **User Management** | 🔄 PENDING | Test CRUD, role assignment |
| **College Management** | 🔄 PENDING | Test CRUD, branding, platform fees |
| **Canteen Management** | 🔄 PENDING | Test CRUD, owner assignment |
| **Sub-Canteen Management** | 🔄 PENDING | Test CRUD, canteen linking |
| **Existing Permissions** | 🔄 PENDING | Test admin cannot access superadmin features |
| **Support Tickets** | 🔄 PENDING | Test all tickets view, replies, status |

---

## SMART CHEF ROUTING WORKFLOWS (Phase 3)

| Scenario | Status | Expected Behavior | Notes |
|----------|--------|-------------------|-------|
| Dosa → Chef 1 | 🔄 PENDING | Chef 1 receives task | Primary assignment |
| Fried Rice → Chef 2 | 🔄 PENDING | Chef 2 receives task | Primary assignment |
| Biscuit → Ready-to-serve | 🔄 PENDING | No chef task created | preparationType = READY_TO_SERVE |

### Mixed Order Routing
| Order Items | Expected Routing | Status |
|-------------|------------------|--------|
| Dosa × 1 | → Chef 1 | 🔄 PENDING |
| Fried Rice × 1 | → Chef 2 | 🔄 PENDING |
| Parotta × 2 | → Chef 3 | 🔄 PENDING |
| Biscuit × 1 | → Existing fulfilment (no chef) | 🔄 PENDING |
| **Customer sees ONE order** | ✅ | 🔄 PENDING |

### Primary + Backup Routing
| Scenario | Expected | Status |
|----------|----------|--------|
| Chef 1 available | → Chef 1 | 🔄 PENDING |
| Chef 1 unavailable | → Chef 2 (backup) | 🔄 PENDING |

### No Backup Scenario
| Scenario | Expected | Status |
|----------|----------|--------|
| Chef 1 unavailable, no backup | No random assignment, owner warning | 🔄 PENDING |

### Leave Scenario
| Scenario | Expected | Status |
|----------|----------|--------|
| Chef 1 ON LEAVE, pending tasks | Remain with Chef 1 | 🔄 PENDING |
| Chef 1 ON LEAVE, new tasks | Use backup/reassignment | 🔄 PENDING |

### Reassignment Scenario
| Scenario | Expected | Status |
|----------|----------|--------|
| Owner changes Chef 1 → Chef 2 | Future orders → Chef 2 | 🔄 PENDING |
| Existing pending tasks | Remain with Chef 1 unless reassigned | 🔄 PENDING |

---

## TESTING CHECKLIST SUMMARY

| Category | Total Workflows | Tested | Pass | Fail | Pending |
|----------|-----------------|--------|------|------|---------|
| Customer | 26 | 0 | 0 | 0 | 26 |
| Owner | 11 | 0 | 0 | 0 | 11 |
| Chef | 9 | 0 | 0 | 0 | 9 |
| Staff | 5 | 0 | 0 | 0 | 5 |
| Admin/SuperAdmin | 7 | 0 | 0 | 0 | 7 |
| Smart Chef Routing | 12 | 0 | 0 | 0 | 12 |
| **TOTAL** | **76** | **0** | **0** | **0** | **76** |

---

## NEXT STEPS
1. Create automated test scripts for critical paths
2. Set up staging environment for testing
3. Begin systematic testing of each workflow
2. Document failures with reproduction steps
3. Prioritize fixes by severity (CRITICAL → HIGH → MEDIUM)

---

*End of Feature Regression Audit Template - Ready for Testing*