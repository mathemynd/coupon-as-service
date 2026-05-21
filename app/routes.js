'use strict';

var express = require('express');

module.exports = function (app, config) {

	var router = express.Router();
	app.use('/', router);

	var authController = require(config.root + '/app/controllers/auth');
	var couponsController = require(config.root + '/app/controllers/coupons');
	var couponUsagesController = require(config.root + '/app/controllers/coupon_usages');

	// Coupons
	router.get('/api/coupons/:code', authController.isAuthenticated, couponsController.read);
	router.post('/api/coupons', authController.isAuthenticated, couponsController.create);
	router.put('/api/coupons/:code', authController.isAuthenticated, couponsController.update);
	router.delete('/api/coupons/:code', authController.isAuthenticated, couponsController.delete);

	// Redemption
	router.post('/api/coupons/:code/redeem', authController.isAuthenticated, couponsController.redeem);

	// Redemption history (read-only)
	router.get('/api/coupons/:code/redemptions', authController.isAuthenticated, couponUsagesController.list);
	router.get('/api/coupons/:code/redemptions/:id', authController.isAuthenticated, couponUsagesController.read);

};
