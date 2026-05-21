'use strict';

var _ = require('lodash');
var prisma = require('../prisma');

var DISCOUNT_FIELDS = ['user', 'code', 'start'];

module.exports = {

	// List all Discounts
	list: async function (req, res, next) {
		try {
			var where = {};
			if (req.query.from) {
				var currentTime = new Date();
				where = { start: { gte: new Date(req.query.from), lt: currentTime } };
			}
			var discounts = await prisma.discount.findMany({ where: where, orderBy: { start: 'desc' } });
			var result = discounts.map(function (d) {
				return { _id: d.id, user: d.user, code: d.code, start: d.start };
			});
			return res.json(result);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Show a Discount
	read: async function (req, res, next) {
		try {
			var discount = await prisma.discount.findUnique({ where: { id: req.params.id } });
			if (!discount) {
				return res.json(null);
			}
			var result = { _id: discount.id, user: discount.user, code: discount.code, start: discount.start };
			return res.json(result);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Create new Discount
	create: async function (req, res, next) {
		try {
			var couponCode = req.body.code || '';
			var coupon = await prisma.coupon.findFirst({ where: { code: couponCode.toUpperCase() } });
			if (!coupon) {
				return res.status(404).json('Coupon ‘' + couponCode.toUpperCase() + '’ not found');
			}
			await prisma.discount.upsert({
				where: { user_code: { user: req.body.user, code: req.body.code } },
				create: { user: req.body.user, code: req.body.code },
				update: req.body
			});
			return res.json(req.body);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Update a Discount
	update: async function (req, res, next) {
		try {
			await prisma.discount.update({
				where: { id: req.params.id },
				data: _.pick(req.body, DISCOUNT_FIELDS)
			});
			res.status(200).json('Updated discount ' + req.params.id);
		} catch (err) {
			res.status(500).json(err);
		}
	},

	// Delete a Discount
	delete: async function (req, res, next) {
		try {
			var where;
			if (req.params.id === 'ALL') {
				where = {};
			}
			else {
				where = { id: req.params.id };
			}
			var result = await prisma.discount.deleteMany({ where: where });
			res.status(200).json('Deleted ' + result.count + ' discounts');
		} catch (err) {
			res.status(500).json(err);
		}
	}

}
