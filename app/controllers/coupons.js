'use strict';

var _ = require('lodash');
var md5 = require('md5');
var prisma = require('../prisma');

var COUPON_FIELDS = ['code', 'email', 'redeem_by', 'max_redemptions', 'times_redeemed', 'percent_off', 'amount_off', 'currency'];

var pickCouponFields = function (obj) {
	return _.pick(obj, COUPON_FIELDS);
};

var cleanUpCoupon = function (coupon) {
	var obj = Object.assign({}, coupon);
	delete obj['id'];
	obj.id = obj.code;
	return obj;
};

module.exports = {

	// List all Coupons
	list: async function (req, res, next) {
		try {
			var coupons = await prisma.coupon.findMany({ orderBy: { code: 'asc' } });
			_.forEach(coupons, function (coupon, index) {
				coupons[index] = cleanUpCoupon(coupon);
			});
			return res.json(coupons);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Show a Coupon
	read: async function (req, res, next) {
		try {
			var coupon;
			if (req.params.id.indexOf('@') !== -1) {
				var email = req.params.id.substring(1);
				coupon = await prisma.coupon.findFirst({ where: { email: email } });
			}
			else {
				coupon = await prisma.coupon.findFirst({ where: { code: req.params.id.toUpperCase() } });
			}
			if (!coupon) {
				return res.status(404).json('Coupon not found');
			}
			return res.json(cleanUpCoupon(coupon));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Create new Coupon
	create: async function (req, res, next) {
		try {
			var data = pickCouponFields(req.body);
			if (!data.code)
				data.code = md5(Date.now() + Math.random());
			data.code = data.code.toUpperCase();
			var coupon = await prisma.coupon.create({ data: data });
			return res.json(cleanUpCoupon(coupon));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Update a Coupon
	update: async function (req, res, next) {
		try {
			await prisma.coupon.updateMany({
				where: { code: req.params.id.toUpperCase() },
				data: pickCouponFields(req.body)
			});
			res.status(200).json('Updated coupon ' + req.params.id);
		} catch (err) {
			res.status(500).json(err);
		}
	},

	// Delete a Coupon
	delete: async function (req, res, next) {
		try {
			var where;
			if (req.params.id === 'ALL') {
				where = {};
			}
			else {
				where = { code: req.params.id.toUpperCase() };
			}
			var result = await prisma.coupon.deleteMany({ where: where });
			res.status(200).json('Deleted ' + result.count + ' coupons');
		} catch (err) {
			res.status(500).json(err);
		}
	}

}
