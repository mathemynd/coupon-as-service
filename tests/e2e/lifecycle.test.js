'use strict';

var request = require('supertest');
var prisma = require('../../app/prisma');

describe('E2E — Production Scenarios', () => {
	var app;
	var password = process.env.API_PASSWORD || 'testpass';

	beforeAll(() => {
		process.env.API_PASSWORD = password;
		process.env.NODE_ENV = 'test';
		app = require('../../app/app');
	});

	afterAll(async () => {
		await prisma.couponUsage.deleteMany();
		await prisma.coupon.deleteMany();
		await prisma.$disconnect();
	});

	beforeEach(async () => {
		await prisma.couponUsage.deleteMany();
		await prisma.coupon.deleteMany();
	});

	function post(path, body) {
		return request(app).post(`${path}?password=${password}`).send(body || {});
	}
	function get(path) {
		return request(app).get(`${path}?password=${password}`);
	}
	function put(path, body) {
		return request(app).put(`${path}?password=${password}`).send(body);
	}
	function del(path) {
		return request(app).delete(`${path}?password=${password}`);
	}

	test('1. Full coupon CRUD lifecycle', async () => {
		// Business creates a coupon
		var createRes = await post('/api/coupons', {
			code: 'WELCOME10',
			coupon_usage_type: 'single_use',
			status: 'active',
			metadata: { discount: '10%' }
		}).expect(200);
		expect(createRes.body.id).toBe('WELCOME10');

		// Business verifies it exists
		var readRes = await get('/api/coupons/WELCOME10').expect(200);
		expect(readRes.body.coupon_usage_type).toBe('single_use');
		expect(readRes.body.metadata).toEqual({ discount: '10%' });

		// Business updates its terms
		await put('/api/coupons/WELCOME10', {
			coupon_usage_type: 'single_use',
			status: 'retired'
		}).expect(200);

		// Verify update applied
		var updatedRes = await get('/api/coupons/WELCOME10').expect(200);
		expect(updatedRes.body.status).toBe('retired');

		// Business removes the coupon
		await del('/api/coupons/WELCOME10').expect(200);

		// Coupon is hidden from API
		await get('/api/coupons/WELCOME10').expect(404);

		// But record still exists in DB with is_deleted=true
		var dbRecord = await prisma.coupon.findFirst({ where: { code: 'WELCOME10' } });
		expect(dbRecord).not.toBeNull();
		expect(dbRecord.is_deleted).toBe(true);
	});

	test('2. Single use coupon — one-time discount', async () => {
		// Business issues a one-time-use coupon
		await post('/api/coupons', {
			code: 'ONETIME50',
			coupon_usage_type: 'single_use',
			status: 'active'
		}).expect(200);

		// Customer redeems it
		var redeemRes = await post('/api/coupons/ONETIME50/redeem').expect(200);
		expect(redeemRes.body.redemption_count).toBe(1);

		// Second customer tries — rejected
		var failRes = await post('/api/coupons/ONETIME50/redeem').expect(400);
		expect(failRes.body).toContain('already been redeemed');

		// History shows exactly 1 redemption
		var historyRes = await get('/api/coupons/ONETIME50/redemptions').expect(200);
		expect(historyRes.body).toHaveLength(1);
		expect(historyRes.body[0].redemption_count).toBe(1);
	});

	test('3. Multi use campaign — limited quantity promotion', async () => {
		// Business runs a campaign with 3 redemptions max
		await post('/api/coupons', {
			code: 'SUMMER3',
			coupon_usage_type: 'multi_use',
			max_redemptions: 3,
			status: 'active'
		}).expect(200);

		// Customers redeem until exhausted
		var res1 = await post('/api/coupons/SUMMER3/redeem').expect(200);
		expect(res1.body.redemption_count).toBe(1);

		var res2 = await post('/api/coupons/SUMMER3/redeem').expect(200);
		expect(res2.body.redemption_count).toBe(2);

		var res3 = await post('/api/coupons/SUMMER3/redeem').expect(200);
		expect(res3.body.redemption_count).toBe(3);

		// 4th redemption fails
		var failRes = await post('/api/coupons/SUMMER3/redeem').expect(400);
		expect(failRes.body).toContain('maximum redemptions');

		// History shows 3 entries with correct counts
		var historyRes = await get('/api/coupons/SUMMER3/redemptions').expect(200);
		expect(historyRes.body).toHaveLength(3);
		var counts = historyRes.body.map(function (u) { return u.redemption_count; }).sort();
		expect(counts).toEqual([1, 2, 3]);
	});

	test('4. Unlimited coupon — ongoing promotion', async () => {
		// Business creates an unlimited coupon for an ongoing promotion
		await post('/api/coupons', {
			code: 'FOREVER20',
			coupon_usage_type: 'unlimited',
			status: 'active'
		}).expect(200);

		// Any number of redemptions succeed
		for (var i = 0; i < 5; i++) {
			await post('/api/coupons/FOREVER20/redeem').expect(200);
		}

		// History shows all 5
		var historyRes = await get('/api/coupons/FOREVER20/redemptions').expect(200);
		expect(historyRes.body).toHaveLength(5);
		var counts = historyRes.body.map(function (u) { return u.redemption_count; }).sort();
		expect(counts).toEqual([1, 2, 3, 4, 5]);
	});

	test('5. Draft to active — staged rollout', async () => {
		// Business creates a coupon as draft
		await post('/api/coupons', {
			code: 'STAGED',
			coupon_usage_type: 'single_use'
		}).expect(200);

		// Redemption fails while in draft
		var failRes = await post('/api/coupons/STAGED/redeem').expect(400);
		expect(failRes.body).toContain('not active');

		// Business activates the coupon
		await put('/api/coupons/STAGED', {
			coupon_usage_type: 'single_use',
			status: 'active'
		}).expect(200);

		// Now redemption succeeds
		var redeemRes = await post('/api/coupons/STAGED/redeem').expect(200);
		expect(redeemRes.body.redemption_count).toBe(1);
	});

	test('6. Retire mid-campaign — emergency pullback', async () => {
		// Business creates an active coupon
		await post('/api/coupons', {
			code: 'OOPS',
			coupon_usage_type: 'multi_use',
			max_redemptions: 100,
			status: 'active'
		}).expect(200);

		// One redemption succeeds
		await post('/api/coupons/OOPS/redeem').expect(200);

		// Business discovers pricing error and retires coupon
		await put('/api/coupons/OOPS', {
			coupon_usage_type: 'multi_use',
			max_redemptions: 100,
			status: 'retired'
		}).expect(200);

		// Further redemptions fail
		var failRes = await post('/api/coupons/OOPS/redeem').expect(400);
		expect(failRes.body).toContain('not active');

		// History shows only the one redemption before retirement
		var historyRes = await get('/api/coupons/OOPS/redemptions').expect(200);
		expect(historyRes.body).toHaveLength(1);
	});

	test('7. Time-windowed coupon — future campaign', async () => {
		var tomorrow = new Date(Date.now() + 86400000).toISOString();

		// Business creates a coupon for a future Black Friday campaign
		await post('/api/coupons', {
			code: 'BLACKFRI',
			coupon_usage_type: 'single_use',
			status: 'active',
			start_date: tomorrow
		}).expect(200);

		// Redemption before the window opens is rejected
		var failRes = await post('/api/coupons/BLACKFRI/redeem').expect(400);
		expect(failRes.body).toContain('not yet valid');
	});

	test('8. Expired coupon — past campaign', async () => {
		var yesterday = new Date(Date.now() - 86400000).toISOString();

		// Customer tries to redeem a coupon from a campaign that has ended
		await post('/api/coupons', {
			code: 'EXPIRED1',
			coupon_usage_type: 'single_use',
			status: 'active',
			end_date: yesterday
		}).expect(200);

		var failRes = await post('/api/coupons/EXPIRED1/redeem').expect(400);
		expect(failRes.body).toContain('expired');
	});
});
