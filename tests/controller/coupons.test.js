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

function mockNext() {
	var fn = function (err) { fn.error = err; };
	fn.error = null;
	return fn;
}

async function redeemCoupon(code) {
	var req = mockReq({ code: code }, {});
	var res = mockRes();
	await couponsController.redeem(req, res, mockNext());
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
			await couponsController.create(req, res, mockNext());

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
			await couponsController.create(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toMatch(/^[A-Z]{8}$/);
		});

		test('3. rejects code with special characters', async () => {
			var req = mockReq({}, { code: 'SAVE-20!', coupon_usage_type: 'single_use' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_CODE_FORMAT');
		});

		test('4. uppercases user-provided code', async () => {
			var req = mockReq({}, { code: 'save20', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'SAVE20' } });
			expect(coupon).not.toBeNull();
		});

		test('5. defaults status to draft', async () => {
			var req = mockReq({}, { code: 'DRAFT1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'DRAFT1' } });
			expect(coupon.status).toBe('draft');
		});

		test('6. sets version to 1.0', async () => {
			var req = mockReq({}, { code: 'VER1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'VER1' } });
			expect(coupon.version).toBe('1.0');
		});

		test('7. rejects when coupon_usage_type missing', async () => {
			var req = mockReq({}, { code: 'NOTYPE' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_MISSING_USAGE_TYPE');
		});

		test('8. rejects multi_use without max_redemptions', async () => {
			var req = mockReq({}, { code: 'MULTI1', coupon_usage_type: 'multi_use' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_MAX_REDEMPTIONS');
		});

		test('9. rejects multi_use with max_redemptions <= 0', async () => {
			var req = mockReq({}, { code: 'MULTI2', coupon_usage_type: 'multi_use', max_redemptions: 0 });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_MAX_REDEMPTIONS');
		});

		test('10. sets max_redemptions to 1 for single_use', async () => {
			var req = mockReq({}, { code: 'SINGLE1', coupon_usage_type: 'single_use' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'SINGLE1' } });
			expect(coupon.max_redemptions).toBe(1);
		});

		test('11. nulls max_redemptions for unlimited', async () => {
			var req = mockReq({}, { code: 'UNLIM1', coupon_usage_type: 'unlimited' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

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
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_DATE_RANGE');
		});

		test('13. accepts metadata as JSON', async () => {
			var meta = { discount: '20%', tier: 'gold', tags: ['vip', 'promo'] };
			var req = mockReq({}, { code: 'META1', coupon_usage_type: 'single_use', metadata: meta });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

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
			await couponsController.create(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'SYS1' } });
			expect(coupon.id).not.toBe(999);
			expect(coupon.is_deleted).toBe(false);
		});

		test('15. strips version from input', async () => {
			var req = mockReq({}, { code: 'VER2', coupon_usage_type: 'single_use', version: '2.0' });
			var res = mockRes();
			await couponsController.create(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'VER2' } });
			expect(coupon.version).toBe('1.0');
		});

		test('16. rejects invalid status on create', async () => {
			var req = mockReq({}, { code: 'BADST1', coupon_usage_type: 'single_use', status: 'banana' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_STATUS');
		});

		test('17. rejects invalid coupon_usage_type on create', async () => {
			var req = mockReq({}, { code: 'BADUT1', coupon_usage_type: 'triple_use' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.create(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_USAGE_TYPE');
		});
	});

	describe('Read', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'READTEST', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active' }
			});
		});

		test('18. returns coupon by code', async () => {
			var req = mockReq({ code: 'READTEST' });
			var res = mockRes();
			await couponsController.read(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toBe('READTEST');
			expect(res.body.coupon_usage_type).toBe('single_use');
		});

		test('19. lookup is case insensitive', async () => {
			var req = mockReq({ code: 'readtest' });
			var res = mockRes();
			await couponsController.read(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			expect(res.body.code).toBe('READTEST');
		});

		test('20. returns 404 for non-existent code', async () => {
			var req = mockReq({ code: 'DOESNOTEXIST' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.read(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});

		test('21. does not return soft-deleted coupon', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'READTEST' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'READTEST' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.read(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});
	});

	describe('Update', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'UPDATEME', coupon_usage_type: 'multi_use', max_redemptions: 5, status: 'active', version: '1.0' }
			});
		});

		test('22. updates business fields', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				status: 'retired',
				max_redemptions: 50
			});
			var res = mockRes();
			await couponsController.update(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.status).toBe('retired');
			expect(coupon.max_redemptions).toBe(50);
		});

		test('23. does not update version (immutable)', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				version: '2.0'
			});
			var res = mockRes();
			await couponsController.update(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.version).toBe('1.0');
		});

		test('24. does not update system fields', async () => {
			var original = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				is_deleted: true,
				created_date: '2020-01-01T00:00:00Z'
			});
			var res = mockRes();
			await couponsController.update(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.is_deleted).toBe(false);
			expect(coupon.created_date.toISOString()).toBe(original.created_date.toISOString());
		});

		test('25. validates date ordering on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 5,
				start_date: '2026-12-31T00:00:00Z',
				end_date: '2026-01-01T00:00:00Z'
			});
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_DATE_RANGE');
		});

		test('26. validates max_redemptions for multi_use on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'multi_use',
				max_redemptions: 0
			});
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_MAX_REDEMPTIONS');
		});

		test('27. sets max_redemptions to 1 when changing to single_use', async () => {
			var req = mockReq({ code: 'UPDATEME' }, {
				coupon_usage_type: 'single_use'
			});
			var res = mockRes();
			await couponsController.update(req, res, mockNext());

			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.max_redemptions).toBe(1);
		});

		test('28. returns 404 for soft-deleted coupon', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'UPDATEME' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'UPDATEME' }, { status: 'retired' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});

		test('29. returns 404 for non-existent coupon', async () => {
			var req = mockReq({ code: 'NOPE' }, { status: 'retired' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});

		test('30. rejects invalid status on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, { status: 'invalid_status' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_STATUS');
		});

		test('31. rejects invalid coupon_usage_type on update', async () => {
			var req = mockReq({ code: 'UPDATEME' }, { coupon_usage_type: 'double_use' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(400);
			expect(next.error.error_code).toBe('COUPON_INVALID_USAGE_TYPE');
		});

		test('32. blocks code change after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { code: 'NEWCODE' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_UPDATE_BLOCKED');
		});

		test('33. blocks metadata change after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { metadata: { new: 'data' } });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_UPDATE_BLOCKED');
		});

		test('34. blocks coupon_usage_type change after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { coupon_usage_type: 'unlimited' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_UPDATE_BLOCKED');
		});

		test('35. blocks start_date change after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { start_date: '2025-01-01T00:00:00Z' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_UPDATE_BLOCKED');
		});

		test('36. allows retiring after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { status: 'retired' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).toBeNull();
			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.status).toBe('retired');
		});

		test('37. rejects non-retired status transition after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { status: 'draft' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_INVALID_STATUS_TRANSITION');
		});

		test('38. allows max_redemptions >= usage count after redemption', async () => {
			await redeemCoupon('UPDATEME');
			var req = mockReq({ code: 'UPDATEME' }, { max_redemptions: 10 });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).toBeNull();
			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'UPDATEME' } });
			expect(coupon.max_redemptions).toBe(10);
		});

		test('39. rejects max_redemptions < usage count after redemption', async () => {
			await redeemCoupon('UPDATEME');
			await prisma.coupon.updateMany({ where: { code: 'UPDATEME' }, data: { status: 'active' } });
			await redeemCoupon('UPDATEME');
			await prisma.coupon.updateMany({ where: { code: 'UPDATEME' }, data: { status: 'active' } });
			await redeemCoupon('UPDATEME');

			var req = mockReq({ code: 'UPDATEME' }, { max_redemptions: 2 });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_INVALID_MAX_REDEMPTIONS');
		});

		test('40. allows end_date >= latest redemption date', async () => {
			await redeemCoupon('UPDATEME');
			var futureDate = new Date(Date.now() + 86400000).toISOString();
			var req = mockReq({ code: 'UPDATEME' }, { end_date: futureDate });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).toBeNull();
			expect(res.statusCode).toBe(200);
		});

		test('41. rejects end_date < latest redemption date', async () => {
			await redeemCoupon('UPDATEME');
			var pastDate = new Date(Date.now() - 86400000).toISOString();
			var req = mockReq({ code: 'UPDATEME' }, { end_date: pastDate });
			var res = mockRes();
			var next = mockNext();
			await couponsController.update(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.error_code).toBe('COUPON_INVALID_END_DATE');
		});
	});

	describe('Delete', () => {

		beforeEach(async () => {
			await prisma.coupon.create({
				data: { code: 'DELETEME', coupon_usage_type: 'single_use', max_redemptions: 1, status: 'active' }
			});
		});

		test('42. sets is_deleted to true', async () => {
			var req = mockReq({ code: 'DELETEME' });
			var res = mockRes();
			await couponsController.delete(req, res, mockNext());

			expect(res.statusCode).toBe(200);
			var coupon = await prisma.coupon.findFirst({ where: { code: 'DELETEME' } });
			expect(coupon).not.toBeNull();
			expect(coupon.is_deleted).toBe(true);
		});

		test('43. returns 404 when already deleted', async () => {
			await prisma.coupon.updateMany({
				where: { code: 'DELETEME' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'DELETEME' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.delete(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});

		test('44. returns 404 for non-existent coupon', async () => {
			var req = mockReq({ code: 'NOPE' });
			var res = mockRes();
			var next = mockNext();
			await couponsController.delete(req, res, next);

			expect(next.error).not.toBeNull();
			expect(next.error.http_response_code).toBe(404);
			expect(next.error.error_code).toBe('COUPON_NOT_FOUND');
		});
	});
});
