# Coupon as Service

REST API service for discount coupons/vouchers, built in Node.js.

## How to Run

Prerequisites: Docker

	# Start PostgreSQL
	docker compose up -d

	# Install dependencies
	npm install

	# Push database schema
	npx prisma db push

	# Set password used in API requests
	export API_PASSWORD=MYPASSWORD

	# Start server
	npm start

Server will default to **http://localhost:3014**

## Testing

	npm test

Tests run against a separate PostgreSQL instance on port 5433.

## Entities

### Coupon

* `id` (string): same as `code`
* `created` (date)

**Qualifiers:**

* `code` (string): the coupon code. Will be generated if not provided when coupon created.
* `email` (string): a _partial_ email address (e.g. all with ".edu" in email gets the discount).

**Constraints:**

* `redeem_by` (date): Date after which the coupon can no longer be redeemed
* `max_redemptions` (positive integer): Maximum number of times this coupon can be redeemed, in total, before it is no longer valid.
* `times_redeemed` (positive integer or zero): Number of times this coupon has been applied to a customer.

**What is rewarded:**

* `percent_off` (number): Percent that will be taken off the subtotal of any invoices for this customer for the duration of the coupon. For example, a coupon with percent_off of 50 will make a kr100 invoice kr50 instead.
* `amount_off` (number): Amount (in the currency specified) that will be taken off the subtotal of any invoices for this customer.
* `currency` (string): If amount_off has been set, the currency of the amount to take off.

### Discount (i.e. the application of a coupon to a particular user)

	{
		_id,   // discount ID (UUID string)
		user,  // a user ID you can refer to (string)
		code,  // coupon code (string)
		start, // start date (date)
	}


## REST API

### Coupons

List coupons

	curl http://localhost:3014/api/coupons?password=MYPASSWORD

Get coupon by code (return code `404` if not found)

	curl http://localhost:3014/api/coupons/MYCOUPON?password=MYPASSWORD
	// The '@' prefix is needed to look up an email-based coupon
	curl http://localhost:3014/api/coupons/@mit.edu?password=MYPASSWORD

Create new coupon:

	curl -X POST -H "Content-Type: application/json" -d '{ "code": "MYCOUPON", "percent_off": 10 }' http://localhost:3014/api/coupons?password=MYPASSWORD

	// Email-based: when creating a discount, if user's email contains "mit.edu", discount will be applied
	curl -X POST -H "Content-Type: application/json" -d '{ "email": "mit.edu", "percent_off": 10 }' http://localhost:3014/api/coupons?password=MYPASSWORD

Update coupon:

	curl -X PUT -H "Content-Type: application/json" -d '{ "percent_off": 20 }' http://localhost:3014/api/coupons/MYCOUPON?password=MYPASSWORD

Delete coupon:

	curl -X DELETE http://localhost:3014/api/coupons/MYCOUPON?password=MYPASSWORD

Delete all coupons:

	curl -X DELETE http://localhost:3014/api/coupons/ALL?password=MYPASSWORD


### Discounts

List applied discounts:

	curl http://localhost:3014/api/discounts?password=MYPASSWORD

Filter discounts by start date:

	curl http://localhost:3014/api/discounts?password=MYPASSWORD&from=2024-01-01

Apply/create new discount:

	curl -X POST -H "Content-Type: application/json" -d '{ "code": "MYCOUPON", "user": "user123" }' http://localhost:3014/api/discounts?password=MYPASSWORD

Delete discount:

	curl -X DELETE http://localhost:3014/api/discounts/DISCOUNT_ID?password=MYPASSWORD

Delete all discounts:

	curl -X DELETE http://localhost:3014/api/discounts/ALL?password=MYPASSWORD


## Implementation

Built on Node.js, Express, PostgreSQL, and Prisma.
