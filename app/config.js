var path = require('path'),
	rootPath = path.normalize(__dirname + '/..'),
	env = process.env.NODE_ENV || 'development';

var config = {

	development: {
		root: rootPath,
		app: {
			name: 'coupon-service'
		},
		port: 3014,
		db: 'postgresql://postgres:postgres@localhost:5432/coupon_service_development'
	},

	test: {
		root: rootPath,
		app: {
			name: 'coupon-service'
		},
		port: 3000,
		db: 'postgresql://postgres:postgres@localhost:5433/coupon_service_test'
	},

	production: {
		root: rootPath,
		app: {
			name: 'coupon-service'
		},
		port: 3000,
		db: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/coupon_service_production'
	}

};

module.exports = config[env];
