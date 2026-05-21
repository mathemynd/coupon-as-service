'use strict';

var _ = require('lodash');
var prisma = require('../prisma');

var CREATE_FIELDS = ['code', 'coupon_usage_type', 'status', 'max_redemptions', 'start_date', 'end_date', 'metadata'];
var UPDATE_FIELDS = ['code', 'coupon_usage_type', 'status', 'max_redemptions', 'start_date', 'end_date', 'metadata'];

var pickCreateFields = function (obj) {
	return _.pick(obj, CREATE_FIELDS);
};

var pickUpdateFields = function (obj) {
	return _.pick(obj, UPDATE_FIELDS);
};

var prepareResponse = function (coupon) {
	var obj = Object.assign({}, coupon);
	delete obj['id'];
	delete obj['is_deleted'];
	obj.id = obj.code;
	return obj;
};

module.exports = {

	// Get a Coupon by code
	read: async function (req, res, next) {
		try {
			var coupon = await prisma.coupon.findFirst({
				where: { code: req.params.code.toUpperCase(), is_deleted: false }
			});
			if (!coupon) {
				return res.status(404).json('Coupon not found');
			}
			return res.json(prepareResponse(coupon));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Create new Coupon
	create: async function (req, res, next) {
		try {
			var data = pickCreateFields(req.body);

			if (!data.code) {
				var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
				data.code = '';
				for (var i = 0; i < 8; i++) {
					data.code += chars.charAt(Math.floor(Math.random() * chars.length));
				}
			} else {
				data.code = data.code.toUpperCase();
				if (!/^[A-Z0-9]+$/.test(data.code)) {
					return res.status(400).json('Code must be alphanumeric only');
				}
			}

			if (!data.coupon_usage_type) {
				return res.status(400).json('coupon_usage_type is required');
			}

			if (data.coupon_usage_type === 'multi_use') {
				if (!data.max_redemptions || data.max_redemptions <= 0) {
					return res.status(400).json('max_redemptions is required and must be > 0 for multi_use coupons');
				}
			} else if (data.coupon_usage_type === 'single_use') {
				data.max_redemptions = 1;
			} else {
				data.max_redemptions = null;
			}

			if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
				return res.status(400).json('start_date must be before end_date');
			}

			data.version = '1.0';
			var coupon = await prisma.coupon.create({ data: data });
			return res.json(prepareResponse(coupon));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Update a Coupon (full replace)
	update: async function (req, res, next) {
		try {
			var data = pickUpdateFields(req.body);

			if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
				return res.status(400).json('start_date must be before end_date');
			}

			if (data.coupon_usage_type === 'multi_use') {
				if (!data.max_redemptions || data.max_redemptions <= 0) {
					return res.status(400).json('max_redemptions is required and must be > 0 for multi_use coupons');
				}
			} else if (data.coupon_usage_type === 'single_use') {
				data.max_redemptions = 1;
			} else if (data.coupon_usage_type) {
				data.max_redemptions = null;
			}

			data.updated_date = new Date();

			var result = await prisma.coupon.updateMany({
				where: { code: req.params.code.toUpperCase(), is_deleted: false },
				data: data
			});

			if (result.count === 0) {
				return res.status(404).json('Coupon not found');
			}

			res.status(200).json('Updated coupon ' + req.params.code);
		} catch (err) {
			res.status(500).json(err);
		}
	},

	// Redeem a Coupon
	redeem: async function (req, res, next) {
		try {
			var coupon = await prisma.coupon.findFirst({
				where: { code: req.params.code.toUpperCase(), is_deleted: false }
			});

			if (!coupon) {
				return res.status(404).json('Coupon not found');
			}

			if (coupon.status !== 'active') {
				return res.status(400).json('Coupon is not active');
			}

			var now = new Date();
			if (coupon.start_date && now < new Date(coupon.start_date)) {
				return res.status(400).json('Coupon is not yet valid');
			}
			if (coupon.end_date && now > new Date(coupon.end_date)) {
				return res.status(400).json('Coupon has expired');
			}

			var latestUsage = await prisma.couponUsage.findFirst({
				where: { code: coupon.code, is_deleted: false },
				orderBy: { redeemed_at: 'desc' }
			});

			var currentCount = latestUsage ? latestUsage.redemption_count : 0;

			if (coupon.coupon_usage_type === 'single_use' && currentCount >= 1) {
				return res.status(400).json('Coupon has already been redeemed');
			}
			if (coupon.coupon_usage_type === 'multi_use' && currentCount >= coupon.max_redemptions) {
				return res.status(400).json('Coupon has reached maximum redemptions');
			}

			var usage = await prisma.couponUsage.create({
				data: {
					code: coupon.code,
					redemption_count: currentCount + 1,
					metadata: req.body.metadata || undefined
				}
			});

			return res.json(usage);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Soft delete a Coupon
	delete: async function (req, res, next) {
		try {
			var result = await prisma.coupon.updateMany({
				where: { code: req.params.code.toUpperCase(), is_deleted: false },
				data: { is_deleted: true, updated_date: new Date() }
			});

			if (result.count === 0) {
				return res.status(404).json('Coupon not found');
			}

			res.status(200).json('Deleted coupon ' + req.params.code);
		} catch (err) {
			res.status(500).json(err);
		}
	}

}
