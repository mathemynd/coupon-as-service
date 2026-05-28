'use strict';

var config = require('../config');
var { CodedAPIError, ERRORS } = require('../api_errors');

module.exports = {

	isAuthenticated: function (req, res, next) {
		if (req.query.password === config.password) {
			return next();
		}
		throw new CodedAPIError(ERRORS.UNAUTHORIZED);
	}

}
