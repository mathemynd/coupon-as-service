# Coupon as Service - Architecture & Development Guide

## Overview

REST API service for discount coupons/vouchers built with Node.js, Express, and MongoDB. Provides CRUD operations for coupons and discounts with simple password-based authentication.

## Architecture

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | - |
| Web Framework | Express | ^4.22.1 |
| Database | MongoDB | - |
| ODM | Mongoose | ^9.6.1 |
| Testing | Tape + Supertest | ^4.4.0 / ^7.2.2 |
| Process Manager | Grunt | ^1.6.2 |

### Directory Structure

```
coupon-as-service/
├── app/
│   ├── app.js              # Application bootstrap, Mongoose setup, model loading
│   ├── server.js           # Server entry point (listens on port)
│   ├── config.js           # Environment configurations (dev/test/prod)
│   ├── express.js          # Express middleware setup
│   ├── routes.js           # Route definitions
│   ├── controllers/
│   │   ├── auth.js         # Password authentication middleware
│   │   ├── coupons.js      # Coupon CRUD operations
│   │   └── discounts.js    # Discount CRUD operations
│   └── models/
│       ├── coupon.js       # Coupon Mongoose schema
│       └── discount.js     # Discount Mongoose schema
├── test/
│   └── app.js              # Tape test suite
├── package.json            # Dependencies and scripts
├── Gruntfile.js            # Grunt task configuration
└── README.md               # API documentation
```

### Request Flow

```
Client Request
    ↓
Express Server (app.js)
    ↓
Middleware Stack (express.js)
    - morgan (logging)
    - bodyParser (JSON parsing)
    - cookieParser
    - methodOverride
    - cors
    ↓
Routes (routes.js)
    ↓
Auth Middleware (auth.js) - checks ?password= query param
    ↓
Controller (coupons.js / discounts.js)
    ↓
Mongoose Model (coupon.js / discount.js)
    ↓
MongoDB
```

## Data Models

### Coupon Schema (`app/models/coupon.js`)

```javascript
{
  created: Date (default: now),
  
  // Qualifiers (how to identify the coupon)
  code: String (unique, sparse, uppercase),
  email: String (unique, sparse),  // e.g., "mit.edu" for .edu emails
  
  // Constraints (when coupon is valid)
  duration: String (default: 'once'),  // 'forever', 'once', 'repeating'
  duration_in_months: Number,          // required if duration='repeating'
  redeem_by: Date,                     // expiration date
  max_redemptions: Number,             // max total uses
  times_redeemed: Number (default: 0),
  
  // Reward (what discount is given)
  percent_off: Number,                 // 0-100
  amount_off: Number,                  // in currency units
  currency: String,                    // e.g., 'usd'
  metadata: Object,                    // arbitrary key/value pairs
}
```

**Indexes:**
- `code`: unique, sparse (allows nulls, but unique when present)
- `email`: unique, sparse

**Notes:**
- Either `code` OR `email` should be provided (not both required due to sparse indexes)
- If `code` not provided on create, auto-generated via MD5 hash
- `times_redeemed` is incremented manually (not auto-managed in current implementation)

### Discount Schema (`app/models/discount.js`)

```javascript
{
  user: String (required),              // User ID
  code: String (required),              // Coupon code applied
  coupon: ObjectId (ref: 'Coupon'),     // Reference to Coupon
  start: Date (default: now),
  end: Date,                            // Calculated based on coupon duration
}
```

**Notes:**
- Represents application of a coupon to a specific user
- `coupon` field stores ObjectId reference for population if needed
- No unique constraint on (user, code) - commented out in schema

## API Endpoints

### Authentication

All endpoints require `?password=YOUR_PASSWORD` query parameter.

Set via environment variable:
```bash
export API_PASSWORD=your_secret_password
```

### Coupons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coupons` | List all coupons |
| GET | `/api/coupons/:id` | Get coupon by code or `@email` |
| POST | `/api/coupons` | Create new coupon |
| PUT | `/api/coupons/:id` | Update coupon by code |
| DELETE | `/api/coupons/:id` | Delete coupon by code or `ALL` |

**Email-based lookup:** Use `@mit.edu` format to search by email domain.

### Discounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discounts` | List all discounts (optional `?from=ISO_DATE` filter) |
| GET | `/api/discounts/:id` | Get discount by ID |
| POST | `/api/discounts` | Apply coupon to user (upsert by user+code) |
| PUT | `/api/discounts/:id` | Update discount by ID |
| DELETE | `/api/discounts/:id` | Delete discount by ID or `ALL` |

## Configuration

### Environment Configs (`app/config.js`)

```javascript
development: {
  port: 3014,
  db: 'mongodb://localhost/coupon-service-development'
}

test: {
  port: 3000,
  db: 'mongodb://localhost/coupon-service-test'
}

production: {
  port: 3000,
  db: process.env.MONGOLAB_URI || 'mongodb://localhost/coupon-service-production'
}
```

Set `NODE_ENV` to switch environments:
```bash
NODE_ENV=test npm test
NODE_ENV=production node app/server.js
```

## Setup & Installation

### Prerequisites

- Node.js (v14+ recommended)
- MongoDB (local or remote)
- npm

### Installation Steps

1. **Clone and install dependencies:**
   ```bash
   cd coupon-as-service
   npm install
   ```

2. **Start MongoDB:**
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Or run directly
   mongod --config /usr/local/etc/mongod.conf
   ```

3. **Set API password:**
   ```bash
   export API_PASSWORD=your_secret_password
   ```

4. **Start the server:**
   ```bash
   # Direct node
   node app/server.js
   
   # Or with grunt (watches for changes)
   grunt
   ```

Server will start on **http://localhost:3014** (development).

## Testing

### Running Tests

```bash
# Set password and run tests
API_PASSWORD=testpass npm test

# Or with NODE_ENV
API_PASSWORD=testpass NODE_ENV=test npm test
```

### Test Structure (`test/app.js`)

Uses **Tape** (minimal TAP-producing test framework) + **Supertest** (HTTP assertions).

**Current tests:**
- `Correct coupons returned` - Verifies GET /api/coupons returns 200 with coupon list

**Example test:**
```javascript
var test = require('tape');
var request = require('supertest');

test('Correct coupons returned', function (t) {
  var app = require('../app/app');
  request(app)
    .get('/api/coupons?password=' + process.env.API_PASSWORD)
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function (err, res) {
      t.error(err, 'No error');
      t.ok(res.body.length, 'Returned coupons list');
      t.ok(res.body[0].code, 'Coupon #0 existed');
      t.end();
      app.closeDatabase();
    });
});
```

### Manual API Testing

**Using curl:**

```bash
# Set password
export API_PASSWORD=testpass
export BASE_URL="http://localhost:3014"

# 1. List coupons
curl "$BASE_URL/api/coupons?password=$API_PASSWORD"

# 2. Create coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{"code": "SAVE20", "percent_off": 20, "duration": "once"}' \
  "$BASE_URL/api/coupons?password=$API_PASSWORD"

# 3. Get coupon
curl "$BASE_URL/api/coupons/SAVE20?password=$API_PASSWORD"

# 4. Update coupon
curl -X PUT -H "Content-Type: application/json" \
  -d '{"max_redemptions": 100}' \
  "$BASE_URL/api/coupons/SAVE20?password=$API_PASSWORD"

# 5. Create email-based coupon
curl -X POST -H "Content-Type: application/json" \
  -d '{"email": "mit.edu", "percent_off": 15}' \
  "$BASE_URL/api/coupons?password=$API_PASSWORD"

# 6. Get email-based coupon
curl "$BASE_URL/api/coupons/@mit.edu?password=$API_PASSWORD"

# 7. Apply discount to user
curl -X POST -H "Content-Type: application/json" \
  -d '{"code": "SAVE20", "user": "user123"}' \
  "$BASE_URL/api/discounts?password=$API_PASSWORD"

# 8. List discounts
curl "$BASE_URL/api/discounts?password=$API_PASSWORD"

# 9. Delete coupon
curl -X DELETE "$BASE_URL/api/coupons/SAVE20?password=$API_PASSWORD"
```

**Using HTTPie:**
```bash
# Install: brew install httpie

http GET localhost:3014/api/coupons password==testpass
http POST localhost:3014/api/coupons password==testpass code=SAVE20 percent_off:=20
```

## Development Guide

### Code Style

- **Strict mode:** All files use `'use strict';`
- **Async/await:** Controllers use async/await for Mongoose operations
- **Error handling:** Try/catch blocks with appropriate HTTP status codes

### Important Patterns

**1. Always use `.lean()` for queries that return data:**

```javascript
// ✅ GOOD - returns plain JavaScript objects
var coupons = await Coupon.find(query).lean().exec();

// ❌ BAD - returns Mongoose documents (can cause serialization issues)
var coupons = await Coupon.find(query);
```

**2. Convert Mongoose documents before modification:**

```javascript
// In cleanUpCoupon function
var obj = coupon.toObject ? coupon.toObject() : coupon;
delete obj['_id'];
delete obj['__v'];
return obj;
```

**3. Authentication middleware:**

```javascript
// app/controllers/auth.js
isAuthenticated: function (req, res, next) {
  if (process.env.API_PASSWORD && req.query.password === process.env.API_PASSWORD) {
    return next();
  } else {
    return res.status(401).json('Unauthorized');
  }
}
```

### Common Pitfalls

**1. Compression middleware disabled:**
- `app.use(compress())` is commented out in `express.js`
- Causes response hanging when serializing Mongoose documents
- Re-enable only if all responses use plain objects

**2. Mongoose document serialization:**
- Never pass Mongoose documents directly to `res.json()`
- Always use `.lean()` or `.toObject()` first

**3. Sparse unique indexes:**
- `code` and `email` are both `unique` + `sparse`
- Allows multiple nulls but enforces uniqueness on non-null values
- Means you can have many coupons without codes, but codes must be unique when present

**4. Email lookup format:**
- Must use `@` prefix: `/api/coupons/@mit.edu`
- Controller strips `@` and searches `email` field

## Known Issues & Limitations

### Current Limitations

1. **No validation:**
   - `percent_off` / `amount_off` not validated (should have at least one)
   - `duration` not validated against enum values
   - `duration_in_months` not required when `duration='repeating'`
   - Email format not validated

2. **Business logic not implemented:**
   - `times_redeemed` not auto-incremented on discount creation
   - `valid` field not calculated (should check `redeem_by`, `max_redemptions`, `times_redeemed`)
   - `duration_ends` not calculated for repeating coupons
   - No check if coupon is expired before applying discount

3. **Discount application:**
   - No validation that coupon exists before creating discount (actually does check)
   - No check for `max_redemptions` limit
   - No check for `redeem_by` date
   - Email-based coupons not resolved when applying discount

4. **Security:**
   - Password in query string (visible in logs, browser history)
   - No rate limiting
   - No HTTPS enforcement
   - No input sanitization

### Fixed Issues

1. ✅ **POST/PUT requests hanging** - Fixed by converting Mongoose docs to plain objects
2. ✅ **Email lookup not implemented** - Now works with `@email` format
3. ✅ **Discounts `from` filter broken** - Changed `dateCreated` to `start` field
4. ✅ **Compression middleware** - Disabled due to serialization conflicts

## Deployment

### Heroku

```bash
# Create app
heroku create my-coupon-service

# Add MongoDB
heroku addons:create mongolab

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set API_PASSWORD=your_secure_password

# Deploy
git push heroku main
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `API_PASSWORD` | Password for API authentication | Yes |
| `NODE_ENV` | Environment (development/test/production) | No (default: development) |
| `PORT` | Server port | No (default: 3014 dev, 3000 prod) |
| `MONGOLAB_URI` | MongoDB connection string (production) | No |

## Grunt Tasks

**Gruntfile.js** configures:
- `grunt-develop`: Restart server on file changes
- `grunt-contrib-watch`: Watch files for changes
- `grunt-contrib-compass`: Compile Sass (if used)

**Usage:**
```bash
grunt          # Start server with watch
grunt develop  # Start server only
```

## Database Management

### MongoDB Shell

```bash
# Connect to development DB
mongosh coupon-service-development

# Show collections
show collections

# Query coupons
db.coupons.find().pretty()

# Query discounts
db.discounts.find().pretty()

# Count documents
db.coupons.countDocuments()
db.discounts.countDocuments()

# Drop database (careful!)
db.dropDatabase()
```

### Backup & Restore

```bash
# Backup
mongodump --db coupon-service-development --out ./backup

# Restore
mongorestore --db coupon-service-development ./backup/coupon-service-development
```

## Troubleshooting

### Server won't start

**Error:** `unable to connect to database`
- **Solution:** Ensure MongoDB is running: `brew services start mongodb-community`

**Error:** `EADDRINUSE: address already in use :::3014`
- **Solution:** Kill existing process: `lsof -ti:3014 | xargs kill -9`

### Tests fail

**Error:** `401 Unauthorized`
- **Solution:** Set API_PASSWORD: `API_PASSWORD=testpass npm test`

**Error:** `ECONNREFUSED`
- **Solution:** Start MongoDB

### API returns empty array

- Check if password is correct
- Check if database has data: `mongosh coupon-service-development --eval "db.coupons.find()"`
- Check NODE_ENV matches database name

## Future Improvements

### High Priority
- [ ] Add input validation (Joi or express-validator)
- [ ] Implement business logic (validity checks, redemption counting)
- [ ] Add proper error messages
- [ ] Implement email-based coupon resolution in discounts

### Medium Priority
- [ ] Add pagination to list endpoints
- [ ] Add filtering/sorting options
- [ ] Implement rate limiting
- [ ] Move password to Authorization header
- [ ] Add HTTPS support
- [ ] Add request logging

### Low Priority
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add more comprehensive tests
- [ ] Add coupon usage analytics
- [ ] Implement webhooks for redemption events
- [ ] Add bulk operations

## References

- **Express.js**: https://expressjs.com/
- **Mongoose**: https://mongoosejs.com/
- **Tape**: https://github.com/substack/tape
- **Supertest**: https://github.com/visionmedia/supertest
- **MongoDB**: https://docs.mongodb.com/
