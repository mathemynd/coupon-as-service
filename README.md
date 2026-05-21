# Coupon as Service

REST API for discount coupons/vouchers, built with Node.js, Express, and PostgreSQL.

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
npm test                    # 48 tests against test DB on port 5433
```

Uses Vitest + Supertest. Tests run serially against a real PostgreSQL instance.

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
Controller (app/controllers/coupons.js | discounts.js)
    ↓
Prisma ORM (app/prisma.js)
    ↓
PostgreSQL
```

### Directory Structure

```
app/
  server.js              # Entry point
  app.js                 # Express bootstrap + Prisma
  prisma.js              # PrismaClient singleton
  config.js              # Per-env config (dev/test/prod)
  express.js             # Middleware setup
  routes.js              # Route definitions
  controllers/
    auth.js              # Password authentication middleware
    coupons.js           # Coupon CRUD operations
    discounts.js         # Discount CRUD operations
prisma/
  schema.prisma          # Generator + datasource
  coupon.prisma          # Coupon model
  discount.prisma        # Discount model
test/
  coupons.test.js        # 17 tests
  discounts.test.js      # 16 tests
  integration.test.js    # 8 tests (lifecycle flows)
```

## Data Models

### Coupon

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| code | String | Unique, uppercase |
| email | String | Unique, partial match (e.g. "mit.edu") |
| percent_off | Float | Percentage discount |
| amount_off | Float | Fixed amount discount |
| currency | String | Currency for amount_off |
| max_redemptions | Int | Max total uses |
| times_redeemed | Int | Current redemption count (default: 0) |
| redeem_by | DateTime | Expiration date |
| duration | String | 'once', 'forever', 'repeating' |
| duration_in_months | Int | For repeating duration |
| metadata | JSON | Arbitrary key/value pairs |
| created | DateTime | Auto-set |

Either `code` or `email` identifies a coupon. If `code` is omitted on create, one is auto-generated.

### Discount

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| user | String | User identifier |
| code | String | Coupon code applied |
| start | DateTime | Auto-set |

Compound unique on `(user, code)` — a user can apply each coupon once.

## REST API

All endpoints require `?password=API_PASSWORD`.

### Coupons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coupons` | List all coupons |
| GET | `/api/coupons/:id` | Get by code or `@email` |
| POST | `/api/coupons` | Create coupon |
| PUT | `/api/coupons/:id` | Update coupon by code |
| DELETE | `/api/coupons/:id` | Delete by code, or `ALL` to delete everything |

### Discounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discounts` | List all (optional `?from=ISO_DATE` filter) |
| GET | `/api/discounts/:id` | Get by ID |
| POST | `/api/discounts` | Apply coupon to user (upserts) |
| PUT | `/api/discounts/:id` | Update by ID |
| DELETE | `/api/discounts/:id` | Delete by ID, or `ALL` to delete everything |

### Examples

```bash
export PW="password=secret"
export BASE="http://localhost:3014"

# Create coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{"code": "SAVE20", "percent_off": 20}' \
  "$BASE/api/coupons?$PW"

# Get coupon
curl "$BASE/api/coupons/SAVE20?$PW"

# Email-based coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{"email": "mit.edu", "percent_off": 15}' \
  "$BASE/api/coupons?$PW"

# Look up by email
curl "$BASE/api/coupons/@mit.edu?$PW"

# Apply discount to user
curl -X POST -H "Content-Type: application/json" \
  -d '{"code": "SAVE20", "user": "user123"}' \
  "$BASE/api/discounts?$PW"

# List discounts
curl "$BASE/api/discounts?$PW"

# Delete coupon
curl -X DELETE "$BASE/api/coupons/SAVE20?$PW"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PASSWORD` | API authentication password | Required |
| `NODE_ENV` | Environment (development/test/production) | development |
| `DATABASE_URL` | PostgreSQL connection string | See config.js |
| `PORT` | Server port | 3014 (dev), 3000 (prod) |
