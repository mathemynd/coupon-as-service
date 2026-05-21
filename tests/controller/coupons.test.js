'use strict';

var prisma = require('../../app/prisma');
var couponsController = require('../../app/controllers/coupons');

function mockReq(params, body, query) {
	return {
		params: params || {},
		body: body || {},
		query: query || {}
	};
}

function mockRes() {
	var res = {};
	res.statusCode = 200;
	res.body = null;
	res.status = function (code) { res.statusCode = code; return res; };
	res.json = function (data) { res.body = data; return res; };
	return res;
}

describe('Coupons Controller', () => {

	beforeAll(() => {
		process.env.API_PASSWORD = 'testpass';
		process.env.NODE_ENV = 'test';
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

	describe('Create', () => {

		test('1. creates coupon with all business fields', async () => {
			var req = mockReq({}, {
				code: 'SAVE20',
				coupon_usage_type: 'multi_use',
				status: 'active',
				max_redemptions: 10,
				start_date: '2026-01-01T00:00:00Z',
				end_date: '2026-12-31T23:59:59Z',
				metadata: { campaign: 'summer' }
			});
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(200);

			var coupon = await prisma.coupon.findFirst({ where: { code: 'SAVE20' } });
			expect(coupon).not.toBeNull();
			expect(coupon.coupon_usage_type).toBe('multi_use');
			expect(coupon.status).toBe('active');
			expect(coupon.max_redemptions).toBe(10);
			expect(coupon.metadata).toEqual({ campaign: 'summer' });
		});

		test('2. auto-generates 8 uppercase letter code when not provided', async () => {
			var req = mockReq({}, { coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toMatch(/^[A-Z]{8}$/);
		});

		test('3. rejects code with special characters', async () => {
			var req = mockReq({}, { code: 'SAVE-20!', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('alphanumeric');
		});

		test('4. uppercases user-provided code', async () => {
			var req = mockReq({}, { code: 'save20', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'SAVE20' } });
			expect(coupon).not.toBeNull();
		});

		test('5. defaults status to draft', async () => {
			var req = mockReq({}, { code: 'DRAFT1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'DRAFT1' } });
			expect(coupon.status).toBe('draft');
		});

		test('6. sets version to 1.0', async () => {
			var req = mockReq({}, { code: 'VER1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'VER1' } });
			expect(coupon.version).toBe('1.0');
		});

		test('7. rejects when coupon_usage_type missing', async () => {
			var req = mockReq({}, { code: 'NOTYPE' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('coupon_usage_type');
		});

		test('8. rejects multi_use without max_redemptions', async () => {
			var req = mockReq({}, { code: 'MULTI1', coupon_usage_type: 'multi_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('max_redemptions');
		});

		test('9. rejects multi_use with max_redemptions <= 0', async () => {
			var req = mockReq({}, { code: 'MULTI2', coupon_usage_type: 'multi_use', max_redemptions: 0 });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('max_redemptions');
		});

		test('10. sets max_redemptions to 1 for single_use', async () => {
			var req = mockReq({}, { code: 'SINGLE1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'SINGLE1' } });
			expect(coupon.max_redemptions).toBe(1);
		});

		test('11. nulls max_redemptions for unlimited', async () => {
			var req = mockReq({}, { code: 'UNLIM1', coupon_usage_type: 'unlimited' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UNLIM1' } });
			expect(coupon.max_redemptions).toBeNull();
		});

		test('12. rejects when start_date >= end_date', async () => {
			var req = mockReq({}, {
				code: 'BADDATE',
				coupon_usage_type: 'single_use',
				start_date: '2026-12-31T00:00:00Z',
				end_date: '2026-01-01T00:00:00Z'
			});
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('start_date');
		});

		test('13. accepts metadata as JSON', async () => {
			var meta = { discount: '20%', tier: 'gold', tags: ['vip', 'promo'] };
			var req = mockReq({}, { code: 'META1', coupon_usage_type: 'single_use', metadata: meta });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'META1' } });
			expect(coupon.metadata).toEqual(meta);
		});

		test('14. strips system fields from input', async () => {
			var req = mockReq({}, {
				code: 'SYS1',
				coupon_usage_type: 'single_use',
				id: 999,
				created_date: '2020-01-01T00:00:00Z',
				updated_date: '2020-01-01T00:00:00Z',
				is_deleted: true
			});
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'SYS1' } });
			expect(coupon.id).not.toBe(999);
			expect(coupon.is_deleted).toBe(false);
		});

		test('15. strips version from input', async () => {
			var req = mockReq({}, { code: 'VER2', coupon_usage_type: 'single_use', version: '2.0' });
			var res = mockRes();
			await couponsController.create(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'VER2' } });
			expect(coupon.version).toBe('1.0');
		});
	});

	describe('Read', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'READTEST', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active' }
			});
		});

		test('16. returns coupon by code', async () => {
			var req = mockReq({ code: 'READTEST' });
			var res = mockRes();
			await couponsController.read(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toBe('READTEST');
			expect(res.body.coupon_usage_type).toBe('single_use');
		});

		test('17. lookup is case insensitive', async () => {
			var req = mockReq({ code: 'readtest' });
			var res = mockRes();
			await couponsController.read(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toBe('READTEST');
		});

		test('18. returns 404 for non-existent code', async () => {
			var req = mockReq({ code: 'DOESNOTEXIST' });
			var res = mockRes();
			await couponsController.read(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});

		test('19. does not return soft-deleted coupon', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'READTEST' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'READTEST' });
			var res = mockRes();
			await couponsController.read(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});
	});

	describe('Update', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'UPDATEME', coupon_usage_type: 'multi_use', max_redemptions: 5, status: 'active', version: '1.0' }
			});
		});

		test('20. updates business fields', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				status: 'retired',
				max_redemptions: 50
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.status).toBe('retired');
			expect(coupon.max_redemptions).toBe(50);
		});

		test('21. does not update version (immutable)', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				version: '2.0'
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.version).toBe('1.0');
		});

		test('22. does not update system fields', async () => {
			var original = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				is_deleted: true,
				created_date: '2020-01-01T00:00:00Z'
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.is_deleted).toBe(false);
			expect(coupon.created_date.toISOString()).toBe(original.created_date.toISOString());
		});

		test('23. validates date ordering on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				start_date: '2026-12-31T00:00:00Z',
				end_date: '2026-01-01T00:00:00Z'
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('start_date');
		});

		test('24. validates max_redemptions for multi_use on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 0
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('max_redemptions');
		});

		test('25. sets max_redemptions to 1 when changing to single_use', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'single_use'
			});
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.max_redemptions).toBe(1);
		});

		test('26. returns 404 for soft-deleted coupon', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'UPDATEME' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'UPDATEME' }, { status: 'retired' });
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});

		test('27. returns 404 for non-existent coupon', async () => {
			var req = mockReq({ code: 'NOPE' }, { status: 'retired' });
			var res = mockRes();
			await couponsController.update(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});
	});

	describe('Delete', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'DELETEME', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active' }
			});
		});

		test('28. sets is_deleted to true', async () => {
			var req = mockReq({ code: 'DELETEME' });
			var res = mockRes();
			await couponsController.delete(req, res, function () {});

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'DELETEME' } });
			expect(coupon).not.toBeNull();
			expect(coupon.is_deleted).toBe(true);
		});

		test('29. returns 404 when already deleted', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'DELETEME' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'DELETEME' });
			var res = mockRes();
			await couponsController.delete(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});

		test('30. returns 404 for non-existent coupon', async () => {
			var req = mockReq({ code: 'NOPE' });
			var res = mockRes();
			await couponsController.delete(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});
	});
});
