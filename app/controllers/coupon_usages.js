'use strict';

var prisma = require('../prisma');

module.exports = {

	// List redemptions for a coupon
	list: async function (req, res, next) {
		try {
			var usages = await prisma.couponUsage.findMany({
				where: { code: req.params.code.toUpperCase(), is_deleted: false },
				orderBy: { redeemed_at: 'desc' }
			});
			return res.json(usages);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Get a specific redemption
	read: async function (req, res, next) {
		try {
			var usage = await prisma.couponUsage.findFirst({
				where: {
					id: req.params.id,
					code: req.params.code.toUpperCase(),
					is_deleted: false
				}
			});
			if (!usage) {
				return res.status(404).json('Redemption not found');
			}
			return res.json(usage);
		} catch (err) {
			return res.status(400).json(err);
		}
	}

}
