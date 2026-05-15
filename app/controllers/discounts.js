'use strict';

var _ = require('lodash');
var mongoose = require('mongoose');
var Discount = mongoose.model('Discount');
var Coupon = mongoose.model('Coupon');

module.exports = {

	// List all Discounts
	list: async function (req, res, next) {
		try {
			var searchQuery = {};
			if (req.query.from) {
				var currentTime = new Date();
				searchQuery = { start: { "$gte": new Date(req.query.from), "$lt": currentTime } };
			}
			var discounts = await Discount.find(searchQuery, null, { sort: {start: -1} }).lean().exec();
			return res.json(discounts);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Show a Discount
	read: async function (req, res, next) {
		try {
			var discount = await Discount.findById(req.params.id).lean().exec();
			return res.json(discount);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Create new Discount
	create: async function (req, res, next) {
		try {
			var couponCode = req.body.code || '';
			var coupons = await Coupon.find({ code: couponCode.toUpperCase() }).exec();
			if (coupons.length === 0) {
				return res.status(404).json('Coupon ‘' + couponCode.toUpperCase() + '’ not found');
			}
			req.body.coupon = coupons[0]._id;
			await Discount.updateOne({ code: req.body.code, user: req.body.user }, { $set: req.body }, { upsert: true });
			console.log('Applied discount %s to user %s.', req.body.code, req.body.user);
			return res.json(req.body);
		} catch (err) {
			return res.status(400).json(err);
		}
	},

	// Update a Discount
	update: async function (req, res, next) {
		try {
			await Discount.updateOne(
				{ _id: req.params.id },
				req.body
			);
			res.status(200).json('Updated discount ' + req.params.id);
		} catch (err) {
			res.status(500).json(err);
		}
	},

	// Delete a Discount
	delete: async function (req, res, next) {
		try {
			var searchParams;
			if (req.params.id === 'ALL') {
				searchParams = {};
			}
			else {
				searchParams = { _id: req.params.id }
			}
			var result = await Discount.deleteMany(searchParams);
			res.status(200).json('Deleted ' + result.deletedCount + ' discounts');
		} catch (err) {
			res.status(500).json(err);
		}
	}

}
