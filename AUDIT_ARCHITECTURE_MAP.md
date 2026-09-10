# Esc(Q) - Architecture Map & System Inventory
**Phase 0 & 1: Freeze & System Inventory**

---

## 1. REPOSITORY & DEPLOYMENT BASELINE

### Current Working Branch/Version
- **Branch**: `main`
- **Latest Commit**: `011692a` - "feat: Production infrastructure & observability"
- **Working Tree**: Clean (no uncommitted changes)

### Deployment Configuration
| Component | Platform | Status |
|-----------|----------|--------|
| **Web Application** | Vercel | Auto-deploy from `main` |
| **API/Backend** | Vercel (serverless) | Auto-deploy from `main` |
| **Flutter Mobile** | GitHub Actions → APK | Manual tag-based builds |
| **Database** | Supabase (PostgreSQL) | Managed |
| **Auth** | Supabase Auth | Managed |

### Build Configuration
- **Web**: Vite + React 18 + TypeScript → `dist/`
- **API**: esbuild bundling `server.ts` → `dist/server.cjs`
- **Mobile**: Flutter 3.24.3 → `build/app/outputs/flutter-apk/app-release.apk`
- **CI/CD**: GitHub Actions (APK build on tag push `v*.*.*`)

### Key Files
| File | Purpose |
|------|---------|
| `server.ts` | Express API (21KB, 5372 lines) |
| `src/types.ts` | TypeScript interfaces (342 lines) |
| `src/App.tsx` | Main React app routing |
| `src/components/CustomerApp.tsx` | Customer web app (160KB) |
| `src/components/CanteenAdmin.tsx` | Owner/Chef/Staff admin (204KB) |
| `src/components/ServicePanel.tsx` | SuperAdmin panel (162KB) |
| `db.ts` | PostgreSQL/Supabase abstraction layer |
| `src/components/ServicePanel.tsx` | SuperAdmin panel |

---

## 2. ARCHITECTURE MAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ESC(Q) SYSTEM ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MOBILE     │     │     WEB      │     │   ADMIN      │
│  (Flutter)   │     │   (React)    │     │  (React)     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS API (server.ts)                               │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Auth    │  │ Orders   │  │ Menu    │  │ Chef/    │  │ Admin/       │    │
│  │ /api/   │  │ /api/    │  │ /api/   │  │ Kitchen  │  │ SuperAdmin   │    │
│  │ auth/*  │  │ canteen/ │  │ canteen/│  │ /api/    │  │ /api/*       │    │
│  │         │  │ order*   │  │ menu*   │  │ chefs*   │  │              │    │
│  └─────────┘  └──────────┘  └─────────┘  └──────────┘  └──────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (PostgreSQL + Auth)                         │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Auth     │ │ Database │ │ Realtime    │ │ Storage  │ │ Edge Funcs   │   │
│  │ (JWT)    │ │ (Postgres)│ │ (WebSockets)│ │ (Images) │ │ (Edge)       │   │
│  └──────────┘ └──────────┘ └─────────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     │
│  │ Razorpay │ │ Vyapar   │ │ Resend   │ │ Google   │ │ Sentry       │     │
│  │ (Payment)│ │ UPI QR   │ │ Email    │ │ Gemini   │ │ Errors       │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. TECHNOLOGY STACK INVENTORY

### Frontend (Web)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type Safety |
| Vite | 6.x | Build Tool |
| Lucide React | Latest | Icons |
| CSS | Native | Styling (no framework) |

### Frontend (Mobile)
| Technology | Version | Purpose |
|------------|---------|---------|
| Flutter | 3.24.3 | Cross-platform UI |
| Dart | 3.x | Language |
| Provider | 6.x | State Management |
| http | 1.x | HTTP Client |
| mobile_scanner | 5.x | QR Scanning |
| firebase_messaging | 15.x | Push Notifications |

### Backend (API)
| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 4.x | Web Framework |
| TypeScript | 5.x | Type Safety |
| Supabase JS | 2.x | Database/Auth Client |
| @google/genai | Latest | AI Integration |
| Razorpay | Latest | Payment Gateway |
| express-rate-limit | 7.x | Rate Limiting |
| helmet | 7.x | Security Headers |
| pino | 8.x | Structured Logging |
| @sentry/node | 10.x | Error Tracking |

### Database & Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL (Supabase) | Primary Data Store |
| Auth | Supabase Auth | JWT-based Authentication |
| Realtime | Supabase Realtime | WebSocket Subscriptions |
| Cache | In-Memory (Map) | Read Caching |
| Rate Limit | In-Memory Map | IP-based Rate Limiting |
| Logging | pino | Structured Logging |
| Error Tracking | Sentry | Error Monitoring |

### CI/CD & Deployment
| Tool | Purpose |
|------|---------|
| Vercel | Web + API Hosting (Serverless) |
| GitHub Actions | APK Build Pipeline |
| Docker | Containerization (Production) |
| Docker Compose | Local/Production Stack |
| Nginx | Reverse Proxy (Production) |
| GitHub Actions | APK Build on Tag Push |

---

## 4. KEY DATA MODELS

### Core Entities
| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| **User** | id, email, role, collegeId, canteenId, subCanteenId | Central auth entity |
| **College** | id, name, location, branding, platformFees | Top-level tenant |
| **Canteen** | id, collegeId, ownerId, items[], orders[] | College-scoped |
| **SubCanteen** | id, canteenId, name | Canteen-scoped counter |
| **MenuItem** | id, canteenId, price, recipe[], primaryChefId | Canteen-scoped |
| **Order** | id, userId, canteenId, items[], totalPrice, status | User + Canteen scoped |
| **OrderItem** | itemId, name, price, quantity | Order-scoped |
| **Chef** | id, canteenId, userId, specialization, status | Canteen-scoped |
| **KitchenTask** | id, orderId, canteenId, chefId, items[], status | Order + Chef scoped |
| **ChefLeave** | chefId, startDate, endDate, reason | Chef-scoped |
| **Ingredient** | id, canteenId, stockGrams, unit | Canteen-scoped |
| **Review** | userId, menuItemId, rating, sentiment | User + Item scoped |

### Payment & Financial
| Entity | Key Fields |
|--------|------------|
| **PlatformFeesConfig** | type (free/flat/percentage/tiered/custom), tiers[], razorpayEnabled |
| **RazorpayConfig** | enabled, accountId, keyId, keySecret, webhookSecret |
| **PaytmConfig** | enabled, merchantId, merchantKey, website |
| **PlatformFeeTier** | minAmount, maxAmount, feeAmount |

### Kitchen & Chef Routing
| Entity | Key Fields |
|--------|------------|
| **MenuItem** | requiresChef, primaryChefId, backupChefId, preparationType (COOKABLE/READY_TO_SERVE) |
| **Chef** | specialization[], status (AVAILABLE/UNAVAILABLE/ON_LEAVE/INACTIVE), userId |
| **KitchenTask** | orderId, chefId, items[], status (PENDING/ACCEPTED/PREPARING/READY/CANCELLED/COMPLETED) |
| **ChefLeave** | chefId, startDate, endDate, reason |

---

## 5. API ENDPOINT INVENTORY

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | User registration |
| POST | `/api/auth/login` | None | User login |
| POST | `/api/auth/generate-otp` | None | Superadmin OTP generation |
| POST | `/api/auth/verify-otp` | None | Superadmin OTP verification |

### Canteen Data
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/canteen?canteenId=...` | JWT | Get canteen data (menu, orders, reviews) |

### Menu Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/offers?canteenId=...` | JWT | List active offers |
| POST | `/api/offers/apply` | JWT | Apply offer to cart |
| GET | `/api/canteen/menu` | JWT | Get menu (owner) |
| POST | `/api/canteen/menu` | Owner | Add menu item |
| PUT | `/api/canteen/menu/:id` | Owner | Update menu item |
| DELETE | `/api/canteen/menu/:id` | Owner | Delete menu item |

### Order Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/canteen/order` | JWT | Place order |
| POST | `/api/canteen/order/status` | JWT | Update order status |
| POST | `/api/canteen/order/update-slot` | Owner | Update pickup slot |
| POST | `/api/canteen/order/batch-status` | Owner | Batch update status |
| GET | `/api/user/orders?userId=...` | JWT | Get user orders |

### Chef & Kitchen Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/chefs?canteenId=...` | Owner/Admin | List chefs |
| POST | `/api/chefs` | Owner/Admin | Create chef |
| PUT | `/api/chefs/:id` | Owner/Admin | Update chef |
| DELETE | `/api/chefs/:id` | Owner/Admin | Delete chef |
| POST | `/api/chefs/:id/leave` | Owner/Admin | Set chef leave |
| GET | `/api/chefs/leaves?canteenId=...` | Owner/Admin | List chef leaves |
| GET | `/api/kitchen/tasks?canteenId=...` | Owner/Chef | List kitchen tasks |
| POST | `/api/kitchen/tasks/:id/status` | Chef/Owner | Update task status |

### Item Chef Assignment
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/items/:id/assign-chef` | Owner | Assign chef to item |

### Payment & Wallet
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/wallet/topup` | JWT | Initiate wallet topup |
| POST | `/api/wallet/topup/confirm` | JWT | Confirm wallet topup |
| POST | `/api/wallet/pay` | JWT | Pay with wallet |
| POST | `/api/wallet/refund` | JWT | Request refund |
| GET | `/api/wallet/balance` | JWT | Get wallet balance |
| POST | `/api/razorpay/verify` | JWT | Verify Razorpay payment |
| POST | `/api/vyapar/verify` | JWT | Verify Vyapar payment |
| POST | `/api/vyapar/status` | JWT | Check Vyapar status |

### College & Canteen Management (SuperAdmin)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/colleges` | SuperAdmin | List colleges |
| POST | `/api/colleges` | SuperAdmin | Create college |
| PUT | `/api/colleges/:id` | SuperAdmin | Update college |
| DELETE | `/api/colleges/:id` | SuperAdmin | Delete college |
| GET | `/api/canteens` | SuperAdmin | List canteens |
| POST | `/api/canteens` | SuperAdmin | Create canteen |
| PUT | `/api/canteens/:id` | SuperAdmin | Update canteen |
| DELETE | `/api/canteens/:id` | SuperAdmin | Delete canteen |
| GET | `/api/subcanteens` | SuperAdmin | List subcanteens |

### User Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/:email/role` | Admin | Update user role |
| DELETE | `/api/users/:email` | Admin | Delete user |

### Support
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/support/user?userId=...` | JWT | Get user tickets |
| POST | `/api/support/submit` | JWT | Submit ticket |
| GET | `/api/support/all` | Admin | All tickets |
| POST | `/api/support/reply` | Admin | Reply to ticket |

### Canteen Settings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/canteen/settings` | Owner | Update settings |
| GET | `/api/canteen/settings` | Owner | Get settings |

### QR & Verification
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/canteen/qr/verify?code=...` | None | Verify QR code |

### Utility
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/test` | None | Health check |
| GET | `/api/app-version` | None | App version |
| GET | `/api/health` | None | Health check |
| GET | `/api/ready` | None | Readiness check |
| GET | `/api/stats/active-users` | None | Active users count |

---

## 6. ROLE-BASED ACCESS CONTROL MATRIX

| Endpoint Pattern | Customer | Staff | Chef | Owner | Admin | SuperAdmin |
|-----------------|----------|-------|------|-------|-------|------------|
| `/api/auth/*` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/canteen?canteenId=` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/canteen/order` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/canteen/menu` (GET) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/canteen/menu` (POST/PUT/DELETE) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/api/offers/*` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/canteen/order/status` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/chefs` (GET) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/api/chefs` (POST/PUT/DELETE) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/api/kitchen/*` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/api/items/*` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/api/offers` (POST/PUT/DELETE) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/api/users/*` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/api/colleges/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/canteens/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/subcanteens/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/users/*` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 6. FRONTEND ROLE ROUTING (App.tsx)

| Role | Web Route | Mobile Route |
|------|-----------|--------------|
| `superadmin` | `ServicePanel` | N/A |
| `admin` | `ServicePanel` | N/A |
| `owner` | `CanteenAdmin` | N/A |
| `chef` | `KitchenDashboardScreen` | `MyTasksScreen` |
| `staff` | `StaffHomeScreen` | N/A |
| `customer` | `CustomerApp` | `HomeScreen` |

---

## 7. ENVIRONMENT VARIABLES

### Required (Production)
```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Database
POSTGRES_URL=postgresql://...

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
VYAPAR_API_KEY=
VYAPAR_MERCHANT_ID=
VYAPAR_SECRET=
VYAPAR_BASE_URL=

# Email
RESEND_API_KEY=
SUPERADMIN_EMAIL=

# AI
GEMINI_API_KEY=

# Monitoring
SENTRY_DSN=

# App
NODE_ENV=production
LOG_LEVEL=info
```

---

## 8. BUILD & DEPLOYMENT ARTIFACTS

| Artifact | Location | Trigger |
|----------|----------|---------|
| Web Build | `dist/` | `npm run build` |
| API Bundle | `dist/server.cjs` | `esbuild server.ts` |
| Mobile APK | `escq_canteen/build/app/outputs/flutter-apk/app-release.apk` | Git tag `v*.*.*` |
| Docker Image | `docker build` | Manual/CI |
| Production Stack | `docker-compose.yml` | Manual |

---

## 9. TEST INFRASTRUCTURE

| Test Type | Tool | Location | Status |
|-----------|------|----------|--------|
| Unit/Integration | Vitest + Supertest | `tests/unit/api/` | 22 tests ✓ |
| E2E Web | Playwright | `tests/e2e/` | Config ready |
| Flutter Unit | flutter_test | `escq_canteen/test/` | 1 test ✓ |
| Linting | TypeScript | `npm run lint` | ✓ |

---

## 10. DOCUMENTATION FILES

| File | Description |
|------|-------------|
| `PROJECT-DOCUMENTATION.txt` | Project overview |
| `DATABASE_STRUCTURE.txt` | Database schema docs |
| `ROLE_DIAGRAMS.txt` | Role diagrams |
| `chef_migration.sql` | Chef/kitchen migration |
| `wallet_migration.sql` | Wallet migration |
| `schema.sql` | Base schema |
| `supabase_setup.sql` | Supabase setup |
| `chef_migration.sql` | Chef/kitchen migration |
| `PROJECT-DOCUMENTATION.txt` | Project documentation |
| `chef_migration.sql` | Chef/kitchen migration |
| `wallet_migration.sql` | Wallet migration |

---

*End of Architecture Map - Phase 0 & 1 Complete*