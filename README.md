# Coupon as Service

Production-grade REST API for coupon distribution and validation at scale — built to handle millions to billions of coupons. Node.js, Express, PostgreSQL.

## Background

Seeded from [weld-io/coupon-service](https://github.com/weld-io/coupon-service) (a minimal Stripe-inspired Mongoose CRUD app with no tests) and rebuilt from the ground up.

What changed from weld-io (everything):
- **Schema redesigned** — removed `duration`, `duration_in_months`, `duration_ends`, `valid`; replaced Discount model entirely with CouponUsage (append-only audit table); added enums (CouponUsageType, CouponStatus), system fields (created_date, updated_date, is_deleted), soft delete
- **Database migrated** — MongoDB/Mongoose → PostgreSQL/Prisma 7 (adapter-pg)
- **Test suite built** — 0 → 80+ tests across 3 layers (controller, integration, e2e) using Vitest + Supertest
- **Build system replaced** — Grunt → Make
- **Architecture added** — schema-validated config, field whitelisting, response shaping, Swagger UI, Docker Compose
- **API surface changed** — removed list-all, added redeem flow with validation (status, date windows, usage type caps), redemption history endpoints

## Setup

Prerequisites: Docker, Node.js

```bash
docker compose up -d        # Start PostgreSQL (dev on 5432, test on 5433)
npm install                 # Install dependencies
npx prisma db push          # Push schema to database
export API_PASSWORD=secret  # Set API password
npm start                   # Start server on http://localhost:3014
```

## Testing

```bash
make test              # Run all tests (default reporter)
make test r=verbose    # Every test listed
make test r=dot        # Most compact
```

80 tests across 3 layers using Vitest + Supertest against real PostgreSQL.

| Layer       | What                                  | Tests |
| ----------- | ------------------------------------- | ----- |
| Controller  | Business logic, validation rules      | 50    |
| Integration | HTTP contract, status codes, auth     | 22    |
| E2E         | Production scenarios, lifecycle flows | 8     |

## Architecture

```
Client Request
    ↓
Express Server (app/server.js)
    ↓
Middleware (app/express.js) — morgan, bodyParser, cors
    ↓
Routes (app/routes.js)
    ↓
Auth (app/controllers/auth.js) — checks ?password= query param
    ↓
Controller (app/controllers/coupons.js | coupon_usages.js)
    ↓
Prisma ORM (app/prisma.js)
    ↓
PostgreSQL
```

### Directory Structure

```
app/
  server.js                # Entry point
  app.js                   # Express bootstrap + Prisma
  prisma.js                # PrismaClient singleton
  config.js                # Per-env config (dev/test/prod)
  express.js               # Middleware setup
  routes.js                # Route definitions
  controllers/
    auth.js                # Password authentication middleware
    coupons.js             # Coupon CRUD + redeem
    coupon_usages.js       # Redemption history (read-only)
prisma/
  schema.prisma            # Generator + datasource
  coupon.prisma            # Coupon model + enums
  coupon_usage.prisma      # CouponUsage model
tests/
  controller/
    coupons.test.js        # 30 tests
    coupon_usages.test.js  # 20 tests
  integration/
    coupons.test.js        # 12 tests
    coupon_usages.test.js  # 10 tests
  e2e/
    lifecycle.test.js      #  8 tests
```

## Data Models

### Coupon (12 fields)

| Category | Field             | Type      | Notes                                                        |
| -------- | ----------------- | --------- | ------------------------------------------------------------ |
| System   | id                | Int       | Auto-increment PK                                            |
|          | created_date      | DateTime  | Auto-set                                                     |
|          | updated_date      | DateTime  | Auto-updated                                                 |
|          | is_deleted        | Boolean   | Soft delete (default false)                                  |
| Business | code              | String    | Unique, uppercase, auto-gen 8 chars if missing               |
|          | version           | String    | Default "1.0", immutable after creation                      |
|          | coupon_usage_type | Enum      | `single_use`, `multi_use`, `unlimited`                       |
|          | status            | Enum      | `draft`, `active`, `retired` (default draft)                 |
|          | max_redemptions   | Int?      | Required for multi_use, 1 for single_use, null for unlimited |
|          | start_date        | DateTime? | Valid from                                                   |
|          | end_date          | DateTime? | Valid until                                                  |
|          | metadata          | JSON?     | Business-defined payload                                     |

### CouponUsage (8 fields)

Append-only audit table. Rows created via the redeem endpoint.

| Category | Field            | Type          | Notes                               |
| -------- | ---------------- | ------------- | ----------------------------------- |
| System   | id               | String (UUID) | PK                                  |
|          | created_date     | DateTime      | Auto-set                            |
|          | updated_date     | DateTime      | Auto-updated                        |
|          | is_deleted       | Boolean       | Default false                       |
| Business | code             | String        | Coupon code redeemed                |
|          | redemption_count | Int           | Running total after this redemption |
|          | redeemed_at      | DateTime      | Auto-set                            |
|          | metadata         | JSON?         | Business-defined                    |

## REST API

All endpoints require `?password=API_PASSWORD`.

### Coupons

| Method | Endpoint             | Description                   |
| ------ | -------------------- | ----------------------------- |
| GET    | `/api/coupons/:code` | Get coupon by code            |
| POST   | `/api/coupons`       | Create coupon                 |
| PUT    | `/api/coupons/:code` | Full replace (entire payload) |
| DELETE | `/api/coupons/:code` | Soft delete                   |

### Redemption

| Method | Endpoint                             | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| POST   | `/api/coupons/:code/redeem`          | Validate and redeem coupon  |
| GET    | `/api/coupons/:code/redemptions`     | List redemptions for coupon |
| GET    | `/api/coupons/:code/redemptions/:id` | Get specific redemption     |

### Redemption Validation

On redeem, the system checks:
- Status must be `active`
- Current date within `start_date` / `end_date` window
- `single_use`: not already redeemed
- `multi_use`: redemption count < `max_redemptions`
- `unlimited`: no cap

### Examples

```bash
export PW="password=secret"
export BASE="http://localhost:3014"

# Create coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{"code": "SAVE20", "coupon_usage_type": "single_use", "status": "active"}' \
  "$BASE/api/coupons?$PW"

# Get coupon
curl "$BASE/api/coupons/SAVE20?$PW"

# Redeem coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/api/coupons/SAVE20/redeem?$PW"

# View redemption history
curl "$BASE/api/coupons/SAVE20/redemptions?$PW"

# Update coupon
curl -X PUT -H "Content-Type: application/json" \
  -d '{"coupon_usage_type": "single_use", "status": "retired"}' \
  "$BASE/api/coupons/SAVE20?$PW"

# Delete coupon (soft delete)
curl -X DELETE "$BASE/api/coupons/SAVE20?$PW"
```

## Environment Variables

| Variable       | Description                               | Default                 |
| -------------- | ----------------------------------------- | ----------------------- |
| `API_PASSWORD` | API authentication password               | Required                |
| `NODE_ENV`     | Environment (development/test/production) | development             |
| `DATABASE_URL` | PostgreSQL connection string              | See config.js           |
| `PORT`         | Server port                               | 3014 (dev), 3000 (prod) |

## Roadmap

23 items tracked in `docs/todos.md` across 4 categories:

| Priority | Category     | Examples                                                                                                           |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| P0       | Bugs/Gaps    | Prisma error wrapping, status enum validation, update integrity on redeemed coupons                                |
| P0-P1    | Architecture | Request/response schema layer (Joi/Zod), separate db/business/controller layers, concurrency-safe redemption_count |
| P0-P1    | Features     | Per-user coupon support, usage_type enum (redeem/revert), bulk creation via CSV, client tokens                     |
| P1-P2    | Infra        | API error codes, logging, CI/CD, metrics dashboard                                                                 |
