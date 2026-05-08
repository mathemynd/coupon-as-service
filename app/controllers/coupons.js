'use strict';

var _ = require('lodash');
var md5 = require('md5');
var mongoose = require('mongoose');
var Coupon = mongoose.model('Coupon');

var cleanUpCoupon = function (coupon) {
	delete coupon['_id'];
	delete coupon['__v'];
	coupon.id = coupon.code; // to mirror Stripe API
	return coupon;
};

module.exports = {

	// List all Coupons
	list: async function (req, res, next) {
		try {
			var searchQuery = {};
			var coupons = await Coupon.find(searchQuery, null, { sort: { code: 1 } }).lean().exec();
			_.forEach(coupons, cleanUpCoupon);
			return res.json(coupons);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Show a Coupon
	read: async function (req, res, next) {
		try {
			var searchQuery = {};
			if (req.params.id.indexOf('@') !== -1) {
				// TODO: make email search work
			}
			else {
				searchQuery.code = req.params.id.toUpperCase();
			}
			var coupons = await Coupon.find(searchQuery).lean().exec();
			if (coupons.length === 0) {
				return res.status(404).json('Coupon not found');
			}
			return res.json(cleanUpCoupon(coupons[0]));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Create new Coupon
	create: async function (req, res, next) {
		try {
			var newCoupon = new Coupon(req.body);
			if (!newCoupon.code)
				newCoupon.code = md5(Date.now() + Math.random());
			newCoupon.code = newCoupon.code.toUpperCase();
			await newCoupon.save();
			return res.json(cleanUpCoupon(newCoupon));
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Update a Coupon
	update: async function (req, res, next) {
		try {
			await Coupon.updateOne(
				{ code: req.params.id.toUpperCase() },
				req.body
			);
			res.status(200).json('Updated coupon ' + req.params.id);
		} catch (err) {
			res.status(500).json(err);
		}
	},

	// Delete a Coupon
	delete: async function (req, res, next) {
		try {
			var searchQuery;
			if (req.params.id === 'ALL') {
				searchQuery = {};
			}
			else {
				searchQuery = { code: req.params.id.toUpperCase() }
			}
			var result = await Coupon.deleteMany(searchQuery);
			res.status(200).json('Deleted ' + result.deletedCount + ' coupons');
		} catch (err) {
			res.status(500).json(err);
		}
	}

}
