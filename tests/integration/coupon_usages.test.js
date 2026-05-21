'use strict';

var request = require('supertest');
var prisma = require('../../app/prisma');

describe('CouponUsages API — HTTP Contract', () => {
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

	async function createActiveCoupon(code, type, maxRedemptions) {
		return prisma.coupon.create({
			data: {
				code: code,
				coupon_usage_type: type,
				status: 'active',
				version: '1.0',
				max_redemptions: maxRedemptions || (type === 'single_use' ? 1 : null)
			}
		});
	}

	describe('POST /api/coupons/:code/redeem', () => {

		test('1. returns 200 on success', async () => {
			await createActiveCoupon('REDEEM1', 'single_use');
			var res = await request(app)
				.post(`/api/coupons/REDEEM1/redeem?password=${password}`)
				.send({})
				.expect('Content-Type', /json/)
				.expect(200);

			expect(res.body).toHaveProperty('code', 'REDEEM1');
			expect(res.body).toHaveProperty('redemption_count', 1);
			expect(res.body).toHaveProperty('id');
			expect(res.body).toHaveProperty('redeemed_at');
		});

		test('2. returns 400 for invalid state', async () => {
			await prisma.coupon.create({
				data: { code: 'DRAFT1', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'draft', version: '1.0' }
			});

			var res = await request(app)
				.post(`/api/coupons/DRAFT1/redeem?password=${password}`)
				.send({})
				.expect(400);

			expect(res.body).toContain('not active');
		});

		test('3. returns 404 when coupon not found', async () => {
			await request(app)
				.post(`/api/coupons/NOPE/redeem?password=${password}`)
				.send({})
				.expect(404);
		});

		test('4. returns 401 without password', async () => {
			await request(app)
				.post('/api/coupons/REDEEM1/redeem')
				.send({})
				.expect(401);
		});
	});

	describe('GET /api/coupons/:code/redemptions', () => {

		test('5. returns 200 with list', async () => {
			await createActiveCoupon('LISTHTTP', 'multi_use', 5);
			await request(app)
				.post(`/api/coupons/LISTHTTP/redeem?password=${password}`)
				.send({});
			await request(app)
				.post(`/api/coupons/LISTHTTP/redeem?password=${password}`)
				.send({});

			var res = await request(app)
				.get(`/api/coupons/LISTHTTP/redemptions?password=${password}`)
				.expect('Content-Type', /json/)
				.expect(200);

			expect(res.body).toBeInstanceOf(Array);
			expect(res.body).toHaveLength(2);
		});

		test('6. returns 401 without password', async () => {
			await request(app)
				.get('/api/coupons/LISTHTTP/redemptions')
				.expect(401);
		});
	});

	describe('GET /api/coupons/:code/redemptions/:id', () => {

		test('7. returns 200 when found', async () => {
			await createActiveCoupon('GETUSE1', 'single_use');
			var redeemRes = await request(app)
				.post(`/api/coupons/GETUSE1/redeem?password=${password}`)
				.send({});
			var usageId = redeemRes.body.id;

			var res = await request(app)
				.get(`/api/coupons/GETUSE1/redemptions/${usageId}?password=${password}`)
				.expect('Content-Type', /json/)
				.expect(200);

			expect(res.body).toHaveProperty('id', usageId);
			expect(res.body).toHaveProperty('code', 'GETUSE1');
		});

		test('8. returns 404 when not found', async () => {
			await createActiveCoupon('GETUSE2', 'single_use');
			await request(app)
				.get(`/api/coupons/GETUSE2/redemptions/00000000-0000-0000-0000-000000000000?password=${password}`)
				.expect(404);
		});

		test('9. returns 401 without password', async () => {
			await request(app)
				.get('/api/coupons/GETUSE1/redemptions/someid')
				.expect(401);
		});
	});

	describe('Response shape', () => {

		test('10. no internal fields leaked in coupon responses', async () => {
			await createActiveCoupon('SHAPE1', 'single_use');

			var res = await request(app)
				.get(`/api/coupons/SHAPE1?password=${password}`)
				.expect(200);

			expect(res.body).toHaveProperty('code', 'SHAPE1');
			expect(res.body).not.toHaveProperty('id');
			expect(res.body).not.toHaveProperty('is_deleted');
			expect(res.body).not.toHaveProperty('version');
			expect(res.body).not.toHaveProperty('created_date');
			expect(res.body).not.toHaveProperty('updated_date');
		});
	});
});
