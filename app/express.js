var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var cors = require('cors');
var swaggerUi = require('swagger-ui-express');
var swaggerSpec = require('./swagger.json');

module.exports = function (app, config) {

	if (app.get('env') !== 'test') {
		app.use(logger('dev'));
	}
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(cors());

	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

	require('./routes')(app, config);

	app.use(function (req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});

	if(app.get('env') === 'development'){
		app.use(function (err, req, res, next) {
			res.status(err.status || 500);
			res.json({
				message: err.message,
				error: err,
				title: 'error'
			});
		});
	}

	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.json({
			message: err.message,
			error: {},
			title: 'error'
		});
	});

};