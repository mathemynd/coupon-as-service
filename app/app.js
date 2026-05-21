var express = require('express'),
	config = require('./config'),
	prisma = require('./prisma');

var app = express();
require('./express')(app, config);

module.exports = app;
module.exports.closeDatabase = function () {
	prisma.$disconnect();
}
