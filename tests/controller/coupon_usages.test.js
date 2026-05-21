'use strict';

var prisma = require('../../app/prisma');
var couponsController = require('../../app/controllers/coupons');
var couponUsagesController = require('../../app/controllers/coupon_usages');

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

async function createActiveCoupon(code, type, opts) {
	var data = {
		code: code,
		coupon_usage_type: type,
		status: 'active',
		version: '1.0'
	};
	if (type === 'single_use') data.max_redemptions = 1;
	if (type === 'multi_use') data.max_redemptions = opts && opts.max_redemptions || 3;
	if (opts && opts.start_date) data.start_date = new Date(opts.start_date);
	if (opts && opts.end_date) data.end_date = new Date(opts.end_date);
	if (opts && opts.status) data.status = opts.status;
	return prisma.coupon.create({ data: data });
}

async function redeemCoupon(code, metadata) {
	var req = mockReq({ code: code }, { metadata: metadata });
	var res = mockRes();
	await couponsController.redeem(req, res, function () {});
	return res;
}

describe('CouponUsages Controller', () => {

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

	describe('Redeem', () => {

		test('1. redeems active single_use coupon', async () => {
			await createActiveCoupon('SINGLE1', 'single_use');
			var res = await redeemCoupon('SINGLE1');

			expect(res.statusCode).toBe(200);
			expect(res.body.redemption_count).toBe(1);
			expect(res.body.code).toBe('SINGLE1');
		});

		test('2. redeems active multi_use coupon', async () => {
			await createActiveCoupon('MULTI1', 'multi_use', { max_redemptions: 5 });
			var res = await redeemCoupon('MULTI1');

			expect(res.statusCode).toBe(200);
			expect(res.body.redemption_count).toBe(1);
		});

		test('3. redeems active unlimited coupon', async () => {
			await createActiveCoupon('UNLIM1', 'unlimited');
			var res = await redeemCoupon('UNLIM1');

			expect(res.statusCode).toBe(200);
			expect(res.body.redemption_count).toBe(1);
		});

		test('4. rejects draft coupon', async () => {
			await createActiveCoupon('DRAFT1', 'single_use', { status: 'draft' });
			var res = await redeemCoupon('DRAFT1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('not active');
		});

		test('5. rejects retired coupon', async () => {
			await createActiveCoupon('RETIRED1', 'single_use', { status: 'retired' });
			var res = await redeemCoupon('RETIRED1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('not active');
		});

		test('6. rejects before start_date', async () => {
			var tomorrow = new Date(Date.now() + 86400000).toISOString();
			await createActiveCoupon('FUTURE1', 'single_use', { start_date: tomorrow });
			var res = await redeemCoupon('FUTURE1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('not yet valid');
		});

		test('7. rejects after end_date', async () => {
			var yesterday = new Date(Date.now() - 86400000).toISOString();
			await createActiveCoupon('PAST1', 'single_use', { end_date: yesterday });
			var res = await redeemCoupon('PAST1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('expired');
		});

		test('8. rejects single_use already redeemed', async () => {
			await createActiveCoupon('USED1', 'single_use');
			await redeemCoupon('USED1');
			var res = await redeemCoupon('USED1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('already been redeemed');
		});

		test('9. rejects multi_use at max_redemptions', async () => {
			await createActiveCoupon('MAXED1', 'multi_use', { max_redemptions: 2 });
			await redeemCoupon('MAXED1');
			await redeemCoupon('MAXED1');
			var res = await redeemCoupon('MAXED1');

			expect(res.statusCode).toBe(400);
			expect(res.body).toContain('maximum redemptions');
		});

		test('10. unlimited has no cap', async () => {
			await createActiveCoupon('NOCAP1', 'unlimited');
			for (var i = 0; i < 10; i++) {
				var res = await redeemCoupon('NOCAP1');
				expect(res.statusCode).toBe(200);
			}
		});

		test('11. redemption_count increments correctly across multiple redeems', async () => {
			await createActiveCoupon('COUNT1', 'multi_use', { max_redemptions: 5 });

			var res1 = await redeemCoupon('COUNT1');
			expect(res1.body.redemption_count).toBe(1);

			var res2 = await redeemCoupon('COUNT1');
			expect(res2.body.redemption_count).toBe(2);

			var res3 = await redeemCoupon('COUNT1');
			expect(res3.body.redemption_count).toBe(3);
		});

		test('12. rejects soft-deleted coupon', async () => {
			await createActiveCoupon('DELETED1', 'single_use');
			await prisma.coupon.updateMany({
				where: { code: 'DELETED1' },
				data: { is_deleted: true }
			});
			var res = await redeemCoupon('DELETED1');

			expect(res.statusCode).toBe(404);
		});

		test('13. stores metadata on usage row', async () => {
			await createActiveCoupon('METAUSE1', 'single_use');
			var res = await redeemCoupon('METAUSE1', { source: 'mobile', campaign: 'spring' });

			expect(res.statusCode).toBe(200);
			expect(res.body.metadata).toEqual({ source: 'mobile', campaign: 'spring' });
		});
	});

	describe('List redemptions', () => {

		test('14. returns all usages for a coupon code', async () => {
			await createActiveCoupon('LIST1', 'multi_use', { max_redemptions: 5 });
			await redeemCoupon('LIST1');
			await redeemCoupon('LIST1');

			var req = mockReq({ code: 'LIST1' });
			var res = mockRes();
			await couponUsagesController.list(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveLength(2);
		});

		test('15. returns empty array when no redemptions', async () => {
			await createActiveCoupon('EMPTY1', 'single_use');

			var req = mockReq({ code: 'EMPTY1' });
			var res = mockRes();
			await couponUsagesController.list(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveLength(0);
		});

		test('16. ordered by redeemed_at desc', async () => {
			await createActiveCoupon('ORDER1', 'multi_use', { max_redemptions: 5 });
			await redeemCoupon('ORDER1');
			await redeemCoupon('ORDER1');
			await redeemCoupon('ORDER1');

			var req = mockReq({ code: 'ORDER1' });
			var res = mockRes();
			await couponUsagesController.list(req, res, function () {});

			expect(res.body[0].redemption_count).toBe(3);
			expect(res.body[1].redemption_count).toBe(2);
			expect(res.body[2].redemption_count).toBe(1);
		});

		test('17. does not return is_deleted usage rows', async () => {
			await createActiveCoupon('DELUSE1', 'multi_use', { max_redemptions: 5 });
			await redeemCoupon('DELUSE1');
			await redeemCoupon('DELUSE1');

			await prisma.couponUsage.updateMany({
				where: { code: 'DELUSE1' },
				data: { is_deleted: true }
			});

			var req = mockReq({ code: 'DELUSE1' });
			var res = mockRes();
			await couponUsagesController.list(req, res, function () {});

			expect(res.body).toHaveLength(0);
		});
	});

	describe('Get redemption by ID', () => {

		test('18. returns specific usage by ID', async () => {
			await createActiveCoupon('GETID1', 'multi_use', { max_redemptions: 5 });
			var redeemRes = await redeemCoupon('GETID1');
			var usageId = redeemRes.body.id;

			var req = mockReq({ code: 'GETID1', id: usageId });
			var res = mockRes();
			await couponUsagesController.read(req, res, function () {});

			expect(res.statusCode).toBe(200);
			expect(res.body.id).toBe(usageId);
			expect(res.body.code).toBe('GETID1');
		});

		test('19. returns 404 for wrong ID', async () => {
			await createActiveCoupon('WRONGID1', 'single_use');

			var req = mockReq({ code: 'WRONGID1', id: '999999' });
			var res = mockRes();
			await couponUsagesController.read(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});

		test('20. returns 404 for ID belonging to different coupon code', async () => {
			await createActiveCoupon('CODEA', 'single_use');
			await createActiveCoupon('CODEB', 'single_use');
			var redeemRes = await redeemCoupon('CODEA');
			var usageId = redeemRes.body.id;

			var req = mockReq({ code: 'CODEB', id: usageId });
			var res = mockRes();
			await couponUsagesController.read(req, res, function () {});

			expect(res.statusCode).toBe(404);
		});
	});
});
