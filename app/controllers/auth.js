'use strict';

var config = require('../config');

module.exports = {

	isAuthenticated: function (req, res, next) {
		if (req.query.password === config.password) {
			return next();
		}
		return res.status(401).json('Unauthorized');
	}

}
