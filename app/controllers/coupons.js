'use strict';

var _ = require('lodash');
var prisma = require('../prisma');
var { CodedAPIError, ERRORS } = require('../api_errors');

var CREATE_FIELDS = ['code', 'coupon_usage_type', 'status', 'max_redemptions', 'start_date', 'end_date', 'metadata'];
var UPDATE_FIELDS = ['code', 'coupon_usage_type', 'status', 'max_redemptions', 'start_date', 'end_date', 'metadata'];
var VALID_STATUSES = ['draft', 'active', 'retired'];
var VALID_USAGE_TYPES = ['single_use', 'multi_use', 'unlimited'];

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
	delete obj['version'];
	delete obj['created_date'];
	delete obj['updated_date'];
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
				throw new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			}
			return res.json(prepareResponse(coupon));
		} catch (err) {
			next(CodedAPIError.handleError(err));
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
					throw new CodedAPIError(ERRORS.COUPON_INVALID_CODE_FORMAT);
				}
			}

			if (!data.coupon_usage_type) {
				throw new CodedAPIError(ERRORS.COUPON_MISSING_USAGE_TYPE);
			}

			if (VALID_USAGE_TYPES.indexOf(data.coupon_usage_type) === -1) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_USAGE_TYPE);
			}

			if (data.status && VALID_STATUSES.indexOf(data.status) === -1) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_STATUS);
			}

			if (data.coupon_usage_type === 'multi_use') {
				if (!data.max_redemptions || data.max_redemptions <= 0) {
					throw new CodedAPIError(ERRORS.COUPON_INVALID_MAX_REDEMPTIONS);
				}
			} else if (data.coupon_usage_type === 'single_use') {
				data.max_redemptions = 1;
			} else {
				data.max_redemptions = null;
			}

			if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_DATE_RANGE);
			}

			data.version = '1.0';
			var coupon = await prisma.coupon.create({ data: data });
			return res.json(prepareResponse(coupon));
		} catch (err) {
			next(CodedAPIError.handleError(err));
		}
	},

	// Update a Coupon (full replace)
	update: async function (req, res, next) {
		try {
			var code = req.params.code.toUpperCase();
			var data = pickUpdateFields(req.body);

			if (data.coupon_usage_type && VALID_USAGE_TYPES.indexOf(data.coupon_usage_type) === -1) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_USAGE_TYPE);
			}

			if (data.status && VALID_STATUSES.indexOf(data.status) === -1) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_STATUS);
			}

			var usageCount = await prisma.couponUsage.count({
				where: { code: code, is_deleted: false }
			});

			if (usageCount > 0) {
				var ALLOWED_AFTER_REDEMPTION = ['end_date', 'max_redemptions', 'status'];
				var blockedFields = Object.keys(data).filter(function (key) {
					return ALLOWED_AFTER_REDEMPTION.indexOf(key) === -1;
				});
				if (blockedFields.length > 0) {
					throw new CodedAPIError(ERRORS.COUPON_UPDATE_BLOCKED);
				}

				if (data.status && data.status !== 'retired') {
					throw new CodedAPIError(ERRORS.COUPON_INVALID_STATUS_TRANSITION);
				}

				if (data.max_redemptions && data.max_redemptions < usageCount) {
					throw new CodedAPIError(ERRORS.COUPON_INVALID_MAX_REDEMPTIONS);
				}

				if (data.end_date) {
					var latestUsage = await prisma.couponUsage.findFirst({
						where: { code: code, is_deleted: false },
						orderBy: { redeemed_at: 'desc' }
					});
					if (new Date(data.end_date) < new Date(latestUsage.redeemed_at)) {
						throw new CodedAPIError(ERRORS.COUPON_INVALID_END_DATE);
					}
				}
			} else {
				if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
					throw new CodedAPIError(ERRORS.COUPON_INVALID_DATE_RANGE);
				}

				if (data.coupon_usage_type === 'multi_use') {
					if (!data.max_redemptions || data.max_redemptions <= 0) {
						throw new CodedAPIError(ERRORS.COUPON_INVALID_MAX_REDEMPTIONS);
					}
				} else if (data.coupon_usage_type === 'single_use') {
					data.max_redemptions = 1;
				} else if (data.coupon_usage_type) {
					data.max_redemptions = null;
				}
			}

			data.updated_date = new Date();

			var result = await prisma.coupon.updateMany({
				where: { code: code, is_deleted: false },
				data: data
			});

			if (result.count === 0) {
				throw new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			}

			res.status(200).json('Updated coupon ' + code);
		} catch (err) {
			next(CodedAPIError.handleError(err));
		}
	},

	// Redeem a Coupon
	redeem: async function (req, res, next) {
		try {
			var coupon = await prisma.coupon.findFirst({
				where: { code: req.params.code.toUpperCase(), is_deleted: false }
			});

			if (!coupon) {
				throw new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			}

			if (coupon.status !== 'active') {
				throw new CodedAPIError(ERRORS.COUPON_NOT_ACTIVE);
			}

			var now = new Date();
			if (coupon.start_date && now < new Date(coupon.start_date)) {
				throw new CodedAPIError(ERRORS.COUPON_NOT_YET_VALID);
			}
			if (coupon.end_date && now > new Date(coupon.end_date)) {
				throw new CodedAPIError(ERRORS.COUPON_EXPIRED);
			}

			var latestUsage = await prisma.couponUsage.findFirst({
				where: { code: coupon.code, is_deleted: false },
				orderBy: { redeemed_at: 'desc' }
			});

			var currentCount = latestUsage ? latestUsage.redemption_count : 0;

			if (coupon.coupon_usage_type === 'single_use' && currentCount >= 1) {
				throw new CodedAPIError(ERRORS.COUPON_ALREADY_REDEEMED);
			}
			if (coupon.coupon_usage_type === 'multi_use' && currentCount >= coupon.max_redemptions) {
				throw new CodedAPIError(ERRORS.COUPON_MAX_REDEMPTIONS);
			}

			var usage = await prisma.couponUsage.create({
				data: {
					code: coupon.code,
					redemption_count: currentCount + 1,
					metadata: req.body.metadata || undefined
				}
			});

			return res.json({
				id: usage.id,
				code: usage.code,
				redemption_count: usage.redemption_count,
				redeemed_at: usage.redeemed_at,
				metadata: usage.metadata
			});
		} catch (err) {
			next(CodedAPIError.handleError(err));
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
				throw new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			}

			res.status(200).json('Deleted coupon ' + req.params.code);
		} catch (err) {
			next(CodedAPIError.handleError(err));
		}
	}

}
