'use strict';

var prisma = require('../prisma');
var { CodedAPIError, ERRORS } = require('../api_errors');

var prepareResponse = function (usage) {
	return {
		id: usage.id,
		code: usage.code,
		redemption_count: usage.redemption_count,
		redeemed_at: usage.redeemed_at,
		metadata: usage.metadata
	};
};

module.exports = {

	// List redemptions for a coupon
	list: async function (req, res, next) {
		try {
			var usages = await prisma.couponUsage.findMany({
				where: { code: req.params.code.toUpperCase(), is_deleted: false },
				orderBy: { redeemed_at: 'desc' }
			});
			return res.json(usages.map(prepareResponse));
		} catch (err) {
			next(CodedAPIError.handleError(err));
		}
	},

	// Get a specific redemption
	read: async function (req, res, next) {
		try {
			var id = parseInt(req.params.id);
			if (isNaN(id)) {
				throw new CodedAPIError(ERRORS.COUPON_INVALID_REDEMPTION_ID);
			}

			var usage = await prisma.couponUsage.findFirst({
				where: {
					id: id,
					code: req.params.code.toUpperCase(),
					is_deleted: false
				}
			});
			if (!usage) {
				throw new CodedAPIError(ERRORS.COUPON_REDEMPTION_NOT_FOUND);
			}
			return res.json(prepareResponse(usage));
		} catch (err) {
			next(CodedAPIError.handleError(err));
		}
	}

}
