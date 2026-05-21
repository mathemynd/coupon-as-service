'use strict';

var request = require('supertest');
var prisma = require('../../app/prisma');

describe('Coupons API — HTTP Contract', () => {
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

	describe('POST /api/coupons', () => {

		test('1. returns 200 with valid payload', async () => {
			var res = await request(app)
				.post(`/api/coupons?password=${password}`)
				.send({ code: 'HTTP1', coupon_usage_type: 'single_use' })
				.expect('Content-Type', /json/)
				.expect(200);

			expect(res.body).toHaveProperty('id', 'HTTP1');
			expect(res.body).toHaveProperty('coupon_usage_type', 'single_use');
			expect(res.body).toHaveProperty('status', 'draft');
			expect(res.body).toHaveProperty('version', '1.0');
			expect(res.body).not.toHaveProperty('is_deleted');
		});

		test('2. returns 400 with invalid payload', async () => {
			var res = await request(app)
				.post(`/api/coupons?password=${password}`)
				.send({ code: 'NOTYPE' })
				.expect(400);

			expect(res.body).toContain('coupon_usage_type');
		});

		test('3. returns 401 without password', async () => {
			await request(app)
				.post('/api/coupons')
				.send({ code: 'NOAUTH', coupon_usage_type: 'single_use' })
				.expect(401);
		});
	});

	describe('GET /api/coupons/:code', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'GETHTTP', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active', version: '1.0' }
			});
		});

		test('4. returns 200 when found', async () => {
			var res = await request(app)
				.get(`/api/coupons/GETHTTP?password=${password}`)
				.expect('Content-Type', /json/)
				.expect(200);

			expect(res.body).toHaveProperty('id', 'GETHTTP');
			expect(res.body).toHaveProperty('coupon_usage_type');
			expect(res.body).not.toHaveProperty('is_deleted');
		});

		test('5. returns 404 when not found', async () => {
			await request(app)
				.get(`/api/coupons/NOPE?password=${password}`)
				.expect(404);
		});

		test('6. returns 401 without password', async () => {
			await request(app)
				.get('/api/coupons/GETHTTP')
				.expect(401);
		});
	});

	describe('PUT /api/coupons/:code', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'PUTHTTP', coupon_usage_type: 'multi_use', max_redemptions: 5, status: 'active', version: '1.0' }
			});
		});

		test('7. returns 200 on success', async () => {
			var res = await request(app)
				.put(`/api/coupons/PUTHTTP?password=${password}`)
				.send({ coupon_usage_type: 'multi_use', max_redemptions: 10, status: 'retired' })
				.expect(200);

			expect(res.body).toContain('Updated');
		});

		test('8. returns 404 when not found', async () => {
			await request(app)
				.put(`/api/coupons/NOPE?password=${password}`)
				.send({ status: 'retired' })
				.expect(404);
		});

		test('9. returns 401 without password', async () => {
			await request(app)
				.put('/api/coupons/PUTHTTP')
				.send({ status: 'retired' })
				.expect(401);
		});
	});

	describe('DELETE /api/coupons/:code', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'DELHTTP', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active', version: '1.0' }
			});
		});

		test('10. returns 200 on success', async () => {
			var res = await request(app)
				.delete(`/api/coupons/DELHTTP?password=${password}`)
				.expect(200);

			expect(res.body).toContain('Deleted');
		});

		test('11. returns 404 when not found', async () => {
			await request(app)
				.delete(`/api/coupons/NOPE?password=${password}`)
				.expect(404);
		});

		test('12. returns 401 without password', async () => {
			await request(app)
				.delete('/api/coupons/DELHTTP')
				.expect(401);
		});
	});
});
